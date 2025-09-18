// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import {IHooks} from "../lib/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "../lib/v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "../lib/v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "../lib/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta} from "../lib/v4-core/src/types/BeforeSwapDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "../lib/v4-core/src/types/PoolOperation.sol";
import "../src/CCRHook.sol";

/**
 * @title HookMiner
 * @notice Utility contract to deploy hooks with valid addresses for testing
 */
contract HookMiner {

    /**
     * @notice Deploy a CCRHook with the correct address pattern
     */
    function mineCCRHook(AttestationRegistry registry) external returns (CCRHook hook) {
        // Calculate target flags for beforeSwap and beforeAddLiquidity
        uint160 targetFlags = uint160(
            Hooks.BEFORE_SWAP_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG
        );

        // Try different salts until we find one that creates a valid hook address
        for (uint256 salt = 0; salt < 100000; salt++) {
            try new CCRHook{salt: bytes32(salt)}(registry) returns (CCRHook newHook) {
                // Check if the address has the correct flags
                if ((uint160(address(newHook)) & 0xFFFF) == targetFlags) {
                    return newHook;
                }
                // If not, the hook will be destroyed by going out of scope
            } catch {
                // Continue trying with next salt
                continue;
            }
        }

        revert("Could not find valid hook address");
    }
}

/**
 * @title MockHookImplementation
 * @notice Mock implementation for testing hook address validation without mining
 */
contract MockHookImplementation is IHooks {
    AttestationRegistry public immutable attestationRegistry;

    constructor(AttestationRegistry _attestationRegistry) {
        attestationRegistry = _attestationRegistry;
    }

    // Implement all IHooks functions to avoid compilation errors
    function beforeInitialize(address, PoolKey calldata, uint160) external pure override returns (bytes4) {
        return IHooks.beforeInitialize.selector;
    }

    function afterInitialize(address, PoolKey calldata, uint160, int24) external pure override returns (bytes4) {
        return IHooks.afterInitialize.selector;
    }

    function beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return IHooks.beforeAddLiquidity.selector;
    }

    function afterAddLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure override returns (bytes4, BalanceDelta) {
        return (IHooks.afterAddLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return IHooks.beforeRemoveLiquidity.selector;
    }

    function afterRemoveLiquidity(
        address,
        PoolKey calldata,
        ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external pure override returns (bytes4, BalanceDelta) {
        return (IHooks.afterRemoveLiquidity.selector, BalanceDelta.wrap(0));
    }

    function beforeSwap(address, PoolKey calldata, SwapParams calldata, bytes calldata)
        external
        pure
        override
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        return (IHooks.beforeSwap.selector, BeforeSwapDelta.wrap(0), 0);
    }

    function afterSwap(address, PoolKey calldata, SwapParams calldata, BalanceDelta, bytes calldata)
        external
        pure
        override
        returns (bytes4, int128)
    {
        return (IHooks.afterSwap.selector, 0);
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return IHooks.beforeDonate.selector;
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return IHooks.afterDonate.selector;
    }
}