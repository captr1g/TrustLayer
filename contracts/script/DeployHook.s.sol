// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Script.sol";
import "../src/CCRHook.sol";
import "../src/AttestationRegistry.sol";
import {IHooks} from "../lib/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "../lib/v4-core/src/libraries/Hooks.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";

/**
 * @title DeployHook
 * @notice Script to deploy CCRHook with correct address that matches hook permissions
 */
contract DeployHook is Script {

    function run() external {
        vm.startBroadcast();

        // Deploy AttestationRegistry first
        AttestationRegistry registry = new AttestationRegistry(msg.sender);

        // Calculate the correct salt to get a valid hook address
        uint160 targetFlags = uint160(
            Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG
        );

        bytes32 salt = _findSalt(targetFlags, type(CCRHook).creationCode, abi.encode(registry), msg.sender);

        // Deploy hook with the calculated salt
        CCRHook hook = new CCRHook{salt: salt}(registry);

        console.log("AttestationRegistry deployed at:", address(registry));
        console.log("CCRHook deployed at:", address(hook));
        console.log("Hook address ends with required flags:", uint160(address(hook)) & 0xFFFF);

        vm.stopBroadcast();
    }

    function _findSalt(uint160 targetFlags, bytes memory creationCode, bytes memory constructorArgs, address deployer)
        internal
        pure
        returns (bytes32)
    {
        bytes32 initCodeHash = keccak256(abi.encodePacked(creationCode, constructorArgs));

        for (uint256 i = 0; i < 1000000; i++) {
            bytes32 salt = bytes32(i);
            address predicted = Create2.computeAddress(salt, initCodeHash, deployer);

            if ((uint160(predicted) & 0xFFFF) == targetFlags) {
                return salt;
            }
        }

        revert("Could not find valid salt");
    }
}