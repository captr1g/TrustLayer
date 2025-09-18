// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../src/CCRHook.sol";
import "../src/AttestationRegistry.sol";

/**
 * @title DeploySimple
 * @notice Simple deployment script without hook address mining
 */
contract DeploySimple is Script {

    function run() external {
        vm.startBroadcast();

        // Deploy AttestationRegistry first
        AttestationRegistry registry = new AttestationRegistry(msg.sender);
        console.log("AttestationRegistry deployed at:", address(registry));

        // Deploy CCRHook (note: for production Uniswap v4, specific address flags are needed)
        CCRHook hook = new CCRHook(registry);
        console.log("CCRHook deployed at:", address(hook));

        // Log addresses for easy copying
        console.log("");
        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("AttestationRegistry:", address(registry));
        console.log("CCRHook:", address(hook));
        console.log("Deployer:", msg.sender);

        vm.stopBroadcast();
    }
}