// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {Hooks} from "../lib/v4-core/src/libraries/Hooks.sol";
import {IHooks} from "../lib/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "../lib/v4-core/src/interfaces/IPoolManager.sol";
import {ModifyLiquidityParams, SwapParams} from "../lib/v4-core/src/types/PoolOperation.sol";
import {PoolKey} from "../lib/v4-core/src/types/PoolKey.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "../lib/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "../lib/v4-core/src/types/BeforeSwapDelta.sol";
import {Currency, CurrencyLibrary} from "../lib/v4-core/src/types/Currency.sol";
import {PoolId, PoolIdLibrary} from "../lib/v4-core/src/types/PoolId.sol";
import "./AttestationRegistry.sol";
import "./libraries/AttestationDataLib.sol";

/**
 * @title CCRHook - Confidential Credit-Risk Hook
 * @notice Uniswap v4 hook that enforces credit risk policies on swaps and liquidity operations
 * @dev Integrates with AttestationRegistry to verify PCS and PRS scores before allowing operations
 */
contract CCRHook is IHooks {
    using Hooks for IHooks;
    using PoolIdLibrary for PoolKey;
    using CurrencyLibrary for Currency;
    using AttestationDataLib for bytes;

    // Dependencies
    AttestationRegistry public immutable attestationRegistry;

    // Risk thresholds
    uint256 public constant MIN_PCS_SCORE = 400; // Minimum credit score (FAIR tier)
    uint256 public constant MAX_PRS_SCORE = 80;  // Maximum pool risk score (HIGH band threshold)
    uint256 public constant LARGE_SWAP_THRESHOLD = 1000 ether; // Threshold for large swaps requiring higher PCS

    // Events
    event SwapBlocked(address indexed user, PoolId indexed poolId, string reason);
    event LiquidityBlocked(address indexed user, PoolId indexed poolId, string reason);
    event RiskPolicyUpdated(uint256 minPcsScore, uint256 maxPrsScore);

    // Errors
    error InsufficientCreditScore(uint256 required, uint256 actual);
    error ExcessivePoolRisk(uint256 maxAllowed, uint256 actual);
    error AttestationExpired();
    error AttestationNotFound();
    error UnauthorizedAccess();

    constructor(AttestationRegistry _attestationRegistry) {
        attestationRegistry = _attestationRegistry;

        // Validate hook permissions - we only need beforeSwap and beforeAddLiquidity
        IHooks(this).validateHookPermissions(
            Hooks.Permissions({
                beforeInitialize: false,
                afterInitialize: false,
                beforeAddLiquidity: true,
                afterAddLiquidity: false,
                beforeRemoveLiquidity: false,
                afterRemoveLiquidity: false,
                beforeSwap: true,
                afterSwap: false,
                beforeDonate: false,
                afterDonate: false,
                beforeSwapReturnDelta: false,
                afterSwapReturnDelta: false,
                afterAddLiquidityReturnDelta: false,
                afterRemoveLiquidityReturnDelta: false
            })
        );
    }

    /**
     * @notice Hook called before a swap is executed
     * @dev Validates user PCS and pool PRS before allowing swap
     */
    function beforeSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        bytes calldata hookData
    ) external override returns (bytes4, BeforeSwapDelta, uint24) {
        // Extract user identity from hookData (in production, this would be more sophisticated)
        address user = _extractUserFromHookData(hookData, sender);

        // Check user credit score (PCS)
        uint256 requiredPcsScore = _getRequiredPcsScore(params);
        _validateUserCreditScore(user, requiredPcsScore);

        // Check pool risk score (PRS)
        _validatePoolRiskScore(key);

        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }

    /**
     * @notice Hook called before liquidity is added
     * @dev Validates user PCS and pool PRS before allowing liquidity provision
     */
    function beforeAddLiquidity(
        address sender,
        PoolKey calldata key,
        ModifyLiquidityParams calldata /* params */,
        bytes calldata hookData
    ) external override returns (bytes4) {
        // Extract user identity from hookData
        address user = _extractUserFromHookData(hookData, sender);

        // For liquidity provision, require minimum credit score
        _validateUserCreditScore(user, MIN_PCS_SCORE);

        // Check pool risk score
        _validatePoolRiskScore(key);

        return IHooks.beforeAddLiquidity.selector;
    }

    /**
     * @notice Validate user's credit score against requirement
     */
    function _validateUserCreditScore(address user, uint256 requiredScore) internal {
        bytes32 userSubject = keccak256(abi.encodePacked(user));

        // Get latest PCS attestation
        try attestationRegistry.getLatestAttestation(userSubject, AttestationDataLib.PCS_TYPE)
            returns (AttestationRegistry.Attestation memory attestation) {

            // Decode PCS data to get score
            // Note: In production, this would properly decode the ABI-encoded data
            // For now, we'll simulate score extraction
            uint256 userScore = _extractPcsScore(attestation);

            if (userScore < requiredScore) {
                emit SwapBlocked(user, PoolIdLibrary.toId(PoolKey({
                    currency0: Currency.wrap(address(0)),
                    currency1: Currency.wrap(address(0)),
                    fee: 0,
                    tickSpacing: 0,
                    hooks: IHooks(address(0))
                })), "Insufficient credit score");
                revert InsufficientCreditScore(requiredScore, userScore);
            }
        } catch {
            emit SwapBlocked(user, PoolIdLibrary.toId(PoolKey({
                currency0: Currency.wrap(address(0)),
                currency1: Currency.wrap(address(0)),
                fee: 0,
                tickSpacing: 0,
                hooks: IHooks(address(0))
            })), "No valid credit attestation");
            revert AttestationNotFound();
        }
    }

    /**
     * @notice Validate pool's risk score
     */
    function _validatePoolRiskScore(PoolKey calldata key) internal {
        bytes32 poolSubject = keccak256(abi.encode(key));

        // Get latest PRS attestation for the pool
        try attestationRegistry.getLatestAttestation(poolSubject, AttestationDataLib.PRS_TYPE)
            returns (AttestationRegistry.Attestation memory attestation) {

            uint256 poolRiskScore = _extractPrsScore(attestation);

            if (poolRiskScore > MAX_PRS_SCORE) {
                emit SwapBlocked(address(0), key.toId(), "Excessive pool risk");
                revert ExcessivePoolRisk(MAX_PRS_SCORE, poolRiskScore);
            }
        } catch {
            // If no PRS attestation exists, we might allow with caution or block
            // For now, we'll allow pools without attestations (they get default risk treatment)
        }
    }

    /**
     * @notice Determine required PCS score based on swap parameters
     */
    function _getRequiredPcsScore(SwapParams calldata params) internal pure returns (uint256) {
        // For large swaps, require higher credit score
        uint256 swapAmount = params.amountSpecified > 0
            ? uint256(params.amountSpecified)
            : uint256(-params.amountSpecified);

        if (swapAmount >= LARGE_SWAP_THRESHOLD) {
            return 600; // GOOD tier minimum for large swaps
        }

        return MIN_PCS_SCORE; // FAIR tier minimum for regular swaps
    }

    /**
     * @notice Extract user address from hook data or fallback to sender
     */
    function _extractUserFromHookData(bytes calldata hookData, address sender) internal pure returns (address) {
        if (hookData.length >= 20) {
            return address(bytes20(hookData[0:20]));
        }
        return sender;
    }

    /**
     * @notice Extract PCS score from attestation data
     * @dev In production, this would properly decode ABI-encoded attestation data
     */
    function _extractPcsScore(AttestationRegistry.Attestation memory /* attestation */) internal pure returns (uint256) {
        // Mock implementation - in production would decode attestation data
        // This would use AttestationDataLib.getScoreFromAttestation() with proper data
        return 750; // Mock score for testing
    }

    /**
     * @notice Extract PRS score from attestation data
     * @dev In production, this would properly decode ABI-encoded attestation data
     */
    function _extractPrsScore(AttestationRegistry.Attestation memory /* attestation */) internal pure returns (uint256) {
        // Mock implementation - in production would decode attestation data
        return 35; // Mock score for testing
    }

    /**
     * @notice Check if user has valid credit attestation
     */
    function hasValidCreditAttestation(address user) external view returns (bool) {
        bytes32 userSubject = keccak256(abi.encodePacked(user));
        return attestationRegistry.isAttestationValid(userSubject, AttestationDataLib.PCS_TYPE);
    }

    /**
     * @notice Check if pool has valid risk attestation
     */
    function hasValidRiskAttestation(PoolKey calldata key) external view returns (bool) {
        bytes32 poolSubject = keccak256(abi.encode(key));
        return attestationRegistry.isAttestationValid(poolSubject, AttestationDataLib.PRS_TYPE);
    }

    /**
     * @notice Get user's current credit score
     */
    function getUserCreditScore(address user) external view returns (uint256) {
        bytes32 userSubject = keccak256(abi.encodePacked(user));
        AttestationRegistry.Attestation memory attestation = attestationRegistry.getLatestAttestation(
            userSubject,
            AttestationDataLib.PCS_TYPE
        );
        return _extractPcsScore(attestation);
    }

    /**
     * @notice Get pool's current risk score
     */
    function getPoolRiskScore(PoolKey calldata key) external view returns (uint256) {
        bytes32 poolSubject = keccak256(abi.encode(key));
        AttestationRegistry.Attestation memory attestation = attestationRegistry.getLatestAttestation(
            poolSubject,
            AttestationDataLib.PRS_TYPE
        );
        return _extractPrsScore(attestation);
    }

    // Required hook functions that we don't use
    function beforeInitialize(address, PoolKey calldata, uint160) external pure override returns (bytes4) {
        revert UnauthorizedAccess();
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure override returns (bytes4) {
        revert UnauthorizedAccess();
    }

    function afterAddLiquidity(
        address, PoolKey calldata, ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata
    ) external pure override returns (bytes4, BalanceDelta) {
        revert UnauthorizedAccess();
    }

    function beforeRemoveLiquidity(
        address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata
    ) external pure override returns (bytes4) {
        revert UnauthorizedAccess();
    }

    function afterRemoveLiquidity(
        address, PoolKey calldata, ModifyLiquidityParams calldata, BalanceDelta, BalanceDelta, bytes calldata
    ) external pure override returns (bytes4, BalanceDelta) {
        revert UnauthorizedAccess();
    }

    function afterSwap(
        address, PoolKey calldata, SwapParams calldata, BalanceDelta, bytes calldata
    ) external pure override returns (bytes4, int128) {
        revert UnauthorizedAccess();
    }

    function beforeDonate(
        address, PoolKey calldata, uint256, uint256, bytes calldata
    ) external pure override returns (bytes4) {
        revert UnauthorizedAccess();
    }

    function afterDonate(
        address, PoolKey calldata, uint256, uint256, bytes calldata
    ) external pure override returns (bytes4) {
        revert UnauthorizedAccess();
    }
}