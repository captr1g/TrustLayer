// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../src/AttestationRegistry.sol";

/**
 * @title DeploySimpleHook
 * @notice Minimal CCRHook without address validation for testing
 */
contract DeploySimpleHook is Script {

    function run() external {
        vm.startBroadcast();

        // Use existing AttestationRegistry
        AttestationRegistry registry = AttestationRegistry(0x781C2068dB28b5969bF3985B055D6D24e958FDCF);
        console.log("Using existing AttestationRegistry at:", address(registry));

        // Deploy simplified hook without Uniswap v4 validation
        SimpleHook hook = new SimpleHook(registry);

        console.log("");
        console.log("=== SIMPLE HOOK DEPLOYMENT COMPLETE ===");
        console.log("SimpleHook deployed at:", address(hook));
        console.log("Hook address flags:", uint160(address(hook)) & 0xFFFF);

        vm.stopBroadcast();
    }
}

/**
 * @title SimpleHook
 * @notice Simplified version of CCRHook without Uniswap v4 validation
 */
contract SimpleHook {
    AttestationRegistry public immutable attestationRegistry;

    // Risk thresholds
    uint256 public constant MIN_PCS_SCORE = 400;
    uint256 public constant MAX_PRS_SCORE = 80;

    constructor(AttestationRegistry _attestationRegistry) {
        attestationRegistry = _attestationRegistry;
    }

    /**
     * @notice Check if user has valid credit attestation
     */
    function hasValidCreditAttestation(address user) external view returns (bool) {
        bytes32 userSubject = keccak256(abi.encodePacked(user));
        return attestationRegistry.isAttestationValid(userSubject, "PCS");
    }

    /**
     * @notice Get user's current credit score (mock implementation)
     */
    function getUserCreditScore(address /* user */) external pure returns (uint256) {
        return 750; // Mock score for testing
    }
}