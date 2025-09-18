// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../src/CCRHook.sol";
import "../src/AttestationRegistry.sol";
import {Hooks} from "../lib/v4-core/src/libraries/Hooks.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";

/**
 * @title FindSalt
 * @notice Script to pre-compute valid salt for CCRHook deployment
 */
contract FindSalt is Script {

    function run() external view {
        address deployer = 0x42bF14b6AAd3CaE6f9fD32f8934524072707Cc7C; // Your deployer address
        address registry = 0x781C2068dB28b5969bF3985B055D6D24e958FDCF; // Deployed registry

        uint160 targetFlags = uint160(
            Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG
        );

        bytes memory creationCode = type(CCRHook).creationCode;
        bytes memory constructorArgs = abi.encode(registry);
        bytes32 initCodeHash = keccak256(abi.encodePacked(creationCode, constructorArgs));

        console.log("Searching for valid salt...");
        console.log("Target flags:", targetFlags);
        console.log("Deployer:", deployer);
        console.log("Registry:", registry);

        for (uint256 i = 0; i < 2000000; i++) {
            bytes32 salt = bytes32(i);
            address predicted = Create2.computeAddress(salt, initCodeHash, deployer);
            uint160 addressFlags = uint160(predicted) & 0xFFFF;

            if (addressFlags == targetFlags) {
                console.log("FOUND VALID SALT!");
                console.log("Salt:", uint256(salt));
                console.log("Hook address:", predicted);
                console.log("Address flags:", addressFlags);
                break;
            }

            // Log progress every 100k iterations
            if (i % 100000 == 0 && i > 0) {
                console.log("Checked", i, "iterations...");
            }
        }
    }
}