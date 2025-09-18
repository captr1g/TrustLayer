// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Policy
 * @notice Manages credit risk policies and ELP (Enhanced Liquidity Parameters) computation
 * @dev Computes maximum notional amounts and fee adjustments based on PCS and PRS scores
 */
contract Policy is Ownable {

    struct PolicyParams {
        uint256 version;
        uint256 baseFee; // Base fee in basis points (10000 = 100%)
        uint256 maxNotionalBase; // Base maximum notional amount
        uint256 pcsMultiplier; // Multiplier for PCS impact (scaled by 1e18)
        uint256 prsMultiplier; // Multiplier for PRS impact (scaled by 1e18)
        uint256 minNotional; // Minimum allowed notional
        uint256 maxNotional; // Maximum allowed notional (hard cap)
        uint256 maxFeeBps; // Maximum fee in basis points
        bool active;
    }

    struct ELPResult {
        uint256 maxNotional;
        uint256 feeBps;
        string riskTier;
    }

    // PCS Tier definitions
    enum PCSTier { Bronze, Silver, Gold, Platinum, Diamond }

    // PRS Band definitions
    enum PRSBand { Calm, Normal, Volatile, Turbulent }

    // Current policy parameters
    PolicyParams public currentPolicy;

    // PCS tier thresholds (0-1000 scale)
    mapping(PCSTier => uint256) public pcsThresholds;

    // PRS band thresholds (0-100 scale)
    mapping(PRSBand => uint256) public prsBandThresholds;

    // Tier-specific multipliers
    mapping(PCSTier => uint256) public tierMultipliers;
    mapping(PRSBand => uint256) public bandMultipliers;

    // Events
    event PolicyUpdated(uint256 indexed version, address indexed updater);
    event ThresholdsUpdated(string indexed paramType, address indexed updater);
    event ELPComputed(
        uint256 indexed pcsValue,
        uint256 indexed prsValue,
        uint256 maxNotional,
        uint256 feeBps,
        string riskTier
    );

    // Errors
    error InvalidPolicyParams();
    error PolicyNotActive();
    error InvalidScore();

    constructor(address initialOwner) Ownable(initialOwner) {
        _initializeDefaultPolicy();
        _initializeThresholds();
    }

    /**
     * @notice Compute Enhanced Liquidity Parameters based on PCS and PRS
     * @param pcsValue Personal Credit Score (0-1000)
     * @param prsValue Pool Risk Score (0-100)
     * @return result ELP computation result
     */
    function computeELP(
        uint256 pcsValue,
        uint256 prsValue
    ) external returns (ELPResult memory result) {
        if (!currentPolicy.active) {
            revert PolicyNotActive();
        }

        if (pcsValue > 1000 || prsValue > 100) {
            revert InvalidScore();
        }

        // Determine tiers and bands
        PCSTier pcsTier = _getPCSTier(pcsValue);
        PRSBand prsBand = _getPRSBand(prsValue);

        // Calculate risk-adjusted parameters
        uint256 pcsMultiplier = tierMultipliers[pcsTier];
        uint256 prsMultiplier = bandMultipliers[prsBand];

        // Compute maximum notional
        // Higher PCS = higher limit, Higher PRS = lower limit
        uint256 maxNotional = (currentPolicy.maxNotionalBase * pcsMultiplier) / 1e18;
        maxNotional = (maxNotional * 1e18) / prsMultiplier; // Inverse for PRS

        // Apply bounds
        if (maxNotional < currentPolicy.minNotional) {
            maxNotional = currentPolicy.minNotional;
        }
        if (maxNotional > currentPolicy.maxNotional) {
            maxNotional = currentPolicy.maxNotional;
        }

        // Compute fee adjustment
        // Higher risk = higher fee
        uint256 feeBps = currentPolicy.baseFee;

        // Adjust fee based on risk
        uint256 riskAdjustment = (1e18 * 1e18) / (pcsMultiplier * prsMultiplier / 1e18);
        feeBps = (feeBps * riskAdjustment) / 1e18;

        // Apply fee bounds
        if (feeBps > currentPolicy.maxFeeBps) {
            feeBps = currentPolicy.maxFeeBps;
        }

        // Determine risk tier
        string memory riskTier = _getRiskTier(pcsTier, prsBand);

        result = ELPResult({
            maxNotional: maxNotional,
            feeBps: feeBps,
            riskTier: riskTier
        });

        emit ELPComputed(pcsValue, prsValue, maxNotional, feeBps, riskTier);

        return result;
    }

    /**
     * @notice Update policy parameters
     * @param newPolicy New policy parameters
     */
    function updatePolicy(PolicyParams calldata newPolicy) external onlyOwner {
        if (newPolicy.maxNotionalBase == 0 || newPolicy.pcsMultiplier == 0 || newPolicy.prsMultiplier == 0) {
            revert InvalidPolicyParams();
        }

        currentPolicy = newPolicy;
        currentPolicy.version++;

        emit PolicyUpdated(currentPolicy.version, msg.sender);
    }

    /**
     * @notice Update PCS tier thresholds
     * @param thresholds Array of threshold values for each tier
     */
    function updatePCSThresholds(uint256[5] calldata thresholds) external onlyOwner {
        for (uint i = 0; i < 5; i++) {
            pcsThresholds[PCSTier(i)] = thresholds[i];
        }
        emit ThresholdsUpdated("PCS", msg.sender);
    }

    /**
     * @notice Update PRS band thresholds
     * @param thresholds Array of threshold values for each band
     */
    function updatePRSThresholds(uint256[4] calldata thresholds) external onlyOwner {
        for (uint i = 0; i < 4; i++) {
            prsBandThresholds[PRSBand(i)] = thresholds[i];
        }
        emit ThresholdsUpdated("PRS", msg.sender);
    }

    /**
     * @notice Update tier multipliers
     * @param multipliers Array of multiplier values for each tier
     */
    function updateTierMultipliers(uint256[5] calldata multipliers) external onlyOwner {
        for (uint i = 0; i < 5; i++) {
            tierMultipliers[PCSTier(i)] = multipliers[i];
        }
        emit ThresholdsUpdated("TierMultipliers", msg.sender);
    }

    /**
     * @notice Update band multipliers
     * @param multipliers Array of multiplier values for each band
     */
    function updateBandMultipliers(uint256[4] calldata multipliers) external onlyOwner {
        for (uint i = 0; i < 4; i++) {
            bandMultipliers[PRSBand(i)] = multipliers[i];
        }
        emit ThresholdsUpdated("BandMultipliers", msg.sender);
    }

    /**
     * @notice Get current policy version
     * @return version Current policy version
     */
    function getPolicyVersion() external view returns (uint256 version) {
        return currentPolicy.version;
    }

    /**
     * @notice Check if policy is active
     * @return active True if policy is active
     */
    function isPolicyActive() external view returns (bool active) {
        return currentPolicy.active;
    }

    /**
     * @notice Internal function to determine PCS tier
     * @param pcsValue PCS value
     * @return tier PCS tier
     */
    function _getPCSTier(uint256 pcsValue) internal view returns (PCSTier tier) {
        if (pcsValue >= pcsThresholds[PCSTier.Diamond]) return PCSTier.Diamond;
        if (pcsValue >= pcsThresholds[PCSTier.Platinum]) return PCSTier.Platinum;
        if (pcsValue >= pcsThresholds[PCSTier.Gold]) return PCSTier.Gold;
        if (pcsValue >= pcsThresholds[PCSTier.Silver]) return PCSTier.Silver;
        return PCSTier.Bronze;
    }

    /**
     * @notice Internal function to determine PRS band
     * @param prsValue PRS value
     * @return band PRS band
     */
    function _getPRSBand(uint256 prsValue) internal view returns (PRSBand band) {
        if (prsValue >= prsBandThresholds[PRSBand.Turbulent]) return PRSBand.Turbulent;
        if (prsValue >= prsBandThresholds[PRSBand.Volatile]) return PRSBand.Volatile;
        if (prsValue >= prsBandThresholds[PRSBand.Normal]) return PRSBand.Normal;
        return PRSBand.Calm;
    }

    /**
     * @notice Internal function to determine risk tier
     * @param pcsTier PCS tier
     * @param prsBand PRS band
     * @return riskTier Combined risk tier string
     */
    function _getRiskTier(PCSTier pcsTier, PRSBand prsBand) internal pure returns (string memory riskTier) {
        // Combine PCS tier and PRS band into a risk tier
        if (pcsTier >= PCSTier.Gold && prsBand <= PRSBand.Normal) {
            return "LOW";
        } else if (pcsTier >= PCSTier.Silver && prsBand <= PRSBand.Volatile) {
            return "MEDIUM";
        } else {
            return "HIGH";
        }
    }

    /**
     * @notice Initialize default policy parameters
     */
    function _initializeDefaultPolicy() internal {
        currentPolicy = PolicyParams({
            version: 1,
            baseFee: 30, // 0.3% base fee
            maxNotionalBase: 10000 ether, // Base maximum of 10,000 ETH
            pcsMultiplier: 1e18, // 1x base multiplier
            prsMultiplier: 1e18, // 1x base multiplier
            minNotional: 0.1 ether, // Minimum 0.1 ETH
            maxNotional: 100000 ether, // Hard cap at 100,000 ETH
            maxFeeBps: 500, // Max 5% fee
            active: true
        });
    }

    /**
     * @notice Initialize default thresholds and multipliers
     */
    function _initializeThresholds() internal {
        // PCS thresholds (0-1000 scale)
        pcsThresholds[PCSTier.Bronze] = 0;
        pcsThresholds[PCSTier.Silver] = 300;
        pcsThresholds[PCSTier.Gold] = 500;
        pcsThresholds[PCSTier.Platinum] = 700;
        pcsThresholds[PCSTier.Diamond] = 850;

        // PRS band thresholds (0-100 scale)
        prsBandThresholds[PRSBand.Calm] = 0;
        prsBandThresholds[PRSBand.Normal] = 25;
        prsBandThresholds[PRSBand.Volatile] = 50;
        prsBandThresholds[PRSBand.Turbulent] = 75;

        // Tier multipliers (scaled by 1e18)
        tierMultipliers[PCSTier.Bronze] = 0.5e18;    // 50% of base
        tierMultipliers[PCSTier.Silver] = 0.75e18;   // 75% of base
        tierMultipliers[PCSTier.Gold] = 1e18;        // 100% of base
        tierMultipliers[PCSTier.Platinum] = 1.5e18;  // 150% of base
        tierMultipliers[PCSTier.Diamond] = 2e18;     // 200% of base

        // Band multipliers (scaled by 1e18) - higher values for higher risk
        bandMultipliers[PRSBand.Calm] = 0.8e18;      // Low risk - 80% reduction in risk penalty
        bandMultipliers[PRSBand.Normal] = 1e18;      // Normal risk - base
        bandMultipliers[PRSBand.Volatile] = 1.5e18;  // High risk - 50% penalty
        bandMultipliers[PRSBand.Turbulent] = 2e18;   // Very high risk - 100% penalty
    }
}