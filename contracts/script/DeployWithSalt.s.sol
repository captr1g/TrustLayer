// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../src/CCRHook.sol";
import "../src/AttestationRegistry.sol";

/**
 * @title DeployWithSalt
 * @notice Deploy CCRHook with pre-computed salt
 */
contract DeployWithSalt is Script {

    function run() external {
        vm.startBroadcast();

        // Use existing AttestationRegistry
        AttestationRegistry registry = AttestationRegistry(0x781C2068dB28b5969bF3985B055D6D24e958FDCF);
        console.log("Using existing AttestationRegistry at:", address(registry));

        // Deploy CCRHook with pre-computed salt
        bytes32 salt = bytes32(uint256(174976));
        CCRHook hook = new CCRHook{salt: salt}(registry);

        console.log("");
        console.log("=== CCRHOOK DEPLOYMENT COMPLETE ===");
        console.log("CCRHook deployed at:", address(hook));
        console.log("Hook address flags:", uint160(address(hook)) & 0xFFFF);
        console.log("Salt used:", uint256(salt));

        vm.stopBroadcast();
    }
}