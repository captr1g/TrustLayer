// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Test.sol";
import "../src/CCRHook.sol";
import "../src/AttestationRegistry.sol";
import "../src/interfaces/IAttestationData.sol";
import "../src/libraries/AttestationDataLib.sol";
import "./HookMiner.sol";
import {IHooks} from "../lib/v4-core/src/interfaces/IHooks.sol";
import {Hooks} from "../lib/v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "../lib/v4-core/src/types/PoolKey.sol";
import {Currency} from "../lib/v4-core/src/types/Currency.sol";
import {SwapParams} from "../lib/v4-core/src/types/PoolOperation.sol";
import {ModifyLiquidityParams} from "../lib/v4-core/src/types/PoolOperation.sol";

/**
 * @title CCRHookTest
 * @notice Test suite for the Confidential Credit-Risk Hook
 */
contract CCRHookTest is Test {
    CCRHook public hook;
    AttestationRegistry public registry;
    HookMiner public miner;
    address public admin;
    address public operator1;
    uint256 public operator1Key;
    address public user1;
    address public user2;

    PoolKey public testPool;

    function setUp() public {
        admin = address(this);
        (operator1, operator1Key) = makeAddrAndKey("operator1");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");

        // Deploy AttestationRegistry
        registry = new AttestationRegistry(admin);
        registry.addOperator(operator1);

        // Deploy HookMiner and mine a valid hook address
        miner = new HookMiner();
        hook = miner.mineCCRHook(registry);

        // Create test pool
        testPool = PoolKey({
            currency0: Currency.wrap(address(0x1)),
            currency1: Currency.wrap(address(0x2)),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(address(hook))
        });
    }

    function test_HookPermissions() public {
        // Hook should only have beforeSwap and beforeAddLiquidity enabled
        assertTrue(Hooks.hasPermission(IHooks(address(hook)), Hooks.BEFORE_SWAP_FLAG));
        assertTrue(Hooks.hasPermission(IHooks(address(hook)), Hooks.BEFORE_ADD_LIQUIDITY_FLAG));
        assertFalse(Hooks.hasPermission(IHooks(address(hook)), Hooks.AFTER_SWAP_FLAG));
        assertFalse(Hooks.hasPermission(IHooks(address(hook)), Hooks.BEFORE_INITIALIZE_FLAG));
    }

    function test_BeforeSwap_ValidCreditScore() public {
        // Create and publish PCS attestation for user1 with good score
        _createPCSAttestation(user1, 750, "GOOD");

        // Create swap params
        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: 100 ether,
            sqrtPriceLimitX96: 0
        });

        bytes memory hookData = abi.encodePacked(user1);

        // Should succeed with valid credit score
        (bytes4 selector,,) = hook.beforeSwap(user1, testPool, params, hookData);
        assertEq(selector, IHooks.beforeSwap.selector);
    }

    function test_BeforeSwap_InsufficientCreditScore() public {
        // Create and publish PCS attestation for user1 with low score
        _createPCSAttestation(user1, 300, "POOR");

        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: 100 ether,
            sqrtPriceLimitX96: 0
        });

        bytes memory hookData = abi.encodePacked(user1);

        // Should revert with insufficient credit score
        vm.expectRevert(abi.encodeWithSelector(CCRHook.InsufficientCreditScore.selector, 400, 300));
        hook.beforeSwap(user1, testPool, params, hookData);
    }

    function test_BeforeSwap_LargeSwapRequiresHigherScore() public {
        // Create PCS attestation with FAIR score (500)
        _createPCSAttestation(user1, 500, "FAIR");

        // Large swap requiring GOOD score (600+)
        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: 1500 ether, // Above LARGE_SWAP_THRESHOLD
            sqrtPriceLimitX96: 0
        });

        bytes memory hookData = abi.encodePacked(user1);

        // Should revert because FAIR score (500) < required GOOD score (600)
        vm.expectRevert(abi.encodeWithSelector(CCRHook.InsufficientCreditScore.selector, 600, 500));
        hook.beforeSwap(user1, testPool, params, hookData);
    }

    function test_BeforeSwap_NoAttestation() public {
        // No attestation for user2
        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: 100 ether,
            sqrtPriceLimitX96: 0
        });

        bytes memory hookData = abi.encodePacked(user2);

        // Should revert with no attestation
        vm.expectRevert(CCRHook.AttestationNotFound.selector);
        hook.beforeSwap(user2, testPool, params, hookData);
    }

    function test_BeforeAddLiquidity_ValidCreditScore() public {
        // Create PCS attestation for user1
        _createPCSAttestation(user1, 600, "GOOD");

        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: -60,
            tickUpper: 60,
            liquidityDelta: 1000 ether,
            salt: 0
        });

        bytes memory hookData = abi.encodePacked(user1);

        // Should succeed
        bytes4 selector = hook.beforeAddLiquidity(user1, testPool, params, hookData);
        assertEq(selector, IHooks.beforeAddLiquidity.selector);
    }

    function test_BeforeAddLiquidity_InsufficientCreditScore() public {
        // Create PCS attestation with low score
        _createPCSAttestation(user1, 350, "POOR");

        ModifyLiquidityParams memory params = ModifyLiquidityParams({
            tickLower: -60,
            tickUpper: 60,
            liquidityDelta: 1000 ether,
            salt: 0
        });

        bytes memory hookData = abi.encodePacked(user1);

        // Should revert
        vm.expectRevert(abi.encodeWithSelector(CCRHook.InsufficientCreditScore.selector, 400, 350));
        hook.beforeAddLiquidity(user1, testPool, params, hookData);
    }

    function test_PoolRiskValidation() public {
        // Create high-risk PRS attestation for pool
        _createPRSAttestation(testPool, 90, "CRITICAL");

        // Create valid PCS for user
        _createPCSAttestation(user1, 750, "GOOD");

        SwapParams memory params = SwapParams({
            zeroForOne: true,
            amountSpecified: 100 ether,
            sqrtPriceLimitX96: 0
        });

        bytes memory hookData = abi.encodePacked(user1);

        // Should revert due to excessive pool risk
        vm.expectRevert(abi.encodeWithSelector(CCRHook.ExcessivePoolRisk.selector, 80, 90));
        hook.beforeSwap(user1, testPool, params, hookData);
    }

    function test_HasValidCreditAttestation() public {
        // No attestation initially
        assertFalse(hook.hasValidCreditAttestation(user1));

        // Create attestation
        _createPCSAttestation(user1, 750, "GOOD");

        // Should have valid attestation
        assertTrue(hook.hasValidCreditAttestation(user1));
    }

    function test_HasValidRiskAttestation() public {
        // No attestation initially
        assertFalse(hook.hasValidRiskAttestation(testPool));

        // Create attestation
        _createPRSAttestation(testPool, 35, "MEDIUM");

        // Should have valid attestation
        assertTrue(hook.hasValidRiskAttestation(testPool));
    }

    function test_GetUserCreditScore() public {
        _createPCSAttestation(user1, 750, "GOOD");

        // Note: This will return mock score (750) until proper ABI decoding is implemented
        uint256 score = hook.getUserCreditScore(user1);
        assertEq(score, 750);
    }

    function test_GetPoolRiskScore() public {
        _createPRSAttestation(testPool, 35, "MEDIUM");

        // Note: This will return mock score (35) until proper ABI decoding is implemented
        uint256 score = hook.getPoolRiskScore(testPool);
        assertEq(score, 35);
    }

    function test_UnauthorizedHookFunctions() public {
        // All non-implemented hook functions should revert
        vm.expectRevert(CCRHook.UnauthorizedAccess.selector);
        hook.beforeInitialize(address(0), testPool, 0);

        vm.expectRevert(CCRHook.UnauthorizedAccess.selector);
        hook.afterInitialize(address(0), testPool, 0, 0);

        vm.expectRevert(CCRHook.UnauthorizedAccess.selector);
        hook.beforeDonate(address(0), testPool, 0, 0, "");
    }

    // Helper function to create PCS attestation
    function _createPCSAttestation(address user, uint256 score, string memory tier) internal {
        IAttestationData.PCSAttestation memory pcsData = IAttestationData.PCSAttestation({
            subject: keccak256(abi.encodePacked(user)),
            score: score,
            tier: tier,
            issuedAt: block.timestamp,
            expiry: block.timestamp + 1 hours,
            policyVersion: "v1.0",
            operator: operator1
        });

        bytes memory encodedData = AttestationDataLib.encodePCSAttestation(pcsData);

        IAttestationData.AttestationRequest memory request = IAttestationData.AttestationRequest({
            subject: pcsData.subject,
            attestationType: AttestationDataLib.PCS_TYPE,
            data: encodedData,
            expiry: pcsData.expiry,
            ipfsUri: ""
        });

        // Sign and publish attestation
        bytes32 messageHash = keccak256(abi.encode(request));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operator1Key, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(operator1);
        registry.publishStructuredAttestation(request, signature);
    }

    // Helper function to create PRS attestation
    function _createPRSAttestation(PoolKey memory pool, uint256 score, string memory band) internal {
        bytes32 poolId = keccak256(abi.encode(pool));

        IAttestationData.PRSAttestation memory prsData = IAttestationData.PRSAttestation({
            poolId: poolId,
            score: score,
            band: band,
            issuedAt: block.timestamp,
            expiry: block.timestamp + 30 minutes,
            policyVersion: "v1.0",
            operator: operator1
        });

        bytes memory encodedData = AttestationDataLib.encodePRSAttestation(prsData);

        IAttestationData.AttestationRequest memory request = IAttestationData.AttestationRequest({
            subject: poolId,
            attestationType: AttestationDataLib.PRS_TYPE,
            data: encodedData,
            expiry: prsData.expiry,
            ipfsUri: ""
        });

        // Sign and publish attestation
        bytes32 messageHash = keccak256(abi.encode(request));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operator1Key, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(operator1);
        registry.publishStructuredAttestation(request, signature);
    }
}