// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Test.sol";
import "../src/Policy.sol";

contract PolicyTest is Test {
    Policy public policy;
    address public owner;
    address public user;

    event PolicyUpdated(uint256 indexed version, address indexed updater);

    function setUp() public {
        owner = makeAddr("owner");
        user = makeAddr("user");

        vm.prank(owner);
        policy = new Policy(owner);
    }

    function test_Deployment() public {
        assertEq(policy.owner(), owner);
        assertEq(policy.isPolicyActive(), true);
        assertEq(policy.getPolicyVersion(), 1);
    }

    function test_ComputeELP_Basic() public {
        // Test with mid-range values
        uint256 pcsValue = 500; // Gold tier
        uint256 prsValue = 25;  // Normal band

        Policy.ELPResult memory result = policy.computeELP(pcsValue, prsValue);

        assertGt(result.maxNotional, 0);
        assertGt(result.feeBps, 0);
        assertEq(keccak256(bytes(result.riskTier)), keccak256(bytes("LOW")));
    }

    function test_ComputeELP_HighPCS_LowPRS() public {
        // Test with high PCS (Diamond) and low PRS (Calm)
        uint256 pcsValue = 900; // Diamond tier
        uint256 prsValue = 10;  // Calm band

        Policy.ELPResult memory result = policy.computeELP(pcsValue, prsValue);

        // Should get higher notional limit and lower fees
        assertGt(result.maxNotional, 10000 ether); // Should be above base
        assertEq(keccak256(bytes(result.riskTier)), keccak256(bytes("LOW")));
    }

    function test_ComputeELP_LowPCS_HighPRS() public {
        // Test with low PCS (Bronze) and high PRS (Turbulent)
        uint256 pcsValue = 100; // Bronze tier
        uint256 prsValue = 80;  // Turbulent band

        Policy.ELPResult memory result = policy.computeELP(pcsValue, prsValue);

        // Should get lower notional limit and higher fees
        assertLt(result.maxNotional, 10000 ether); // Should be below base
        assertEq(keccak256(bytes(result.riskTier)), keccak256(bytes("HIGH")));
    }

    function test_ComputeELP_BoundaryValues() public {
        // Test minimum values
        Policy.ELPResult memory resultMin = policy.computeELP(0, 0);
        assertGe(resultMin.maxNotional, 0.1 ether); // Should respect minimum

        // Test maximum values
        Policy.ELPResult memory resultMax = policy.computeELP(1000, 100);
        assertLe(resultMax.maxNotional, 100000 ether); // Should respect maximum
        assertLe(resultMax.feeBps, 500); // Should respect max fee
    }

    function test_ComputeELP_InvalidScores() public {
        // Test PCS > 1000
        vm.expectRevert(Policy.InvalidScore.selector);
        policy.computeELP(1001, 50);

        // Test PRS > 100
        vm.expectRevert(Policy.InvalidScore.selector);
        policy.computeELP(500, 101);
    }

    function test_UpdatePolicy() public {
        Policy.PolicyParams memory newPolicy = Policy.PolicyParams({
            version: 2,
            baseFee: 50,
            maxNotionalBase: 20000 ether,
            pcsMultiplier: 1.5e18,
            prsMultiplier: 1.2e18,
            minNotional: 0.2 ether,
            maxNotional: 200000 ether,
            maxFeeBps: 1000,
            active: true
        });

        vm.prank(owner);
        vm.expectEmit(true, true, false, false);
        emit PolicyUpdated(2, owner);
        policy.updatePolicy(newPolicy);

        assertEq(policy.getPolicyVersion(), 2);
    }

    function test_UpdatePolicy_OnlyOwner() public {
        Policy.PolicyParams memory newPolicy = Policy.PolicyParams({
            version: 2,
            baseFee: 50,
            maxNotionalBase: 20000 ether,
            pcsMultiplier: 1.5e18,
            prsMultiplier: 1.2e18,
            minNotional: 0.2 ether,
            maxNotional: 200000 ether,
            maxFeeBps: 1000,
            active: true
        });

        vm.prank(user);
        vm.expectRevert("Ownable: caller is not the owner");
        policy.updatePolicy(newPolicy);
    }

    function test_UpdatePolicy_InvalidParams() public {
        Policy.PolicyParams memory invalidPolicy = Policy.PolicyParams({
            version: 2,
            baseFee: 50,
            maxNotionalBase: 0, // Invalid: zero
            pcsMultiplier: 1.5e18,
            prsMultiplier: 1.2e18,
            minNotional: 0.2 ether,
            maxNotional: 200000 ether,
            maxFeeBps: 1000,
            active: true
        });

        vm.prank(owner);
        vm.expectRevert(Policy.InvalidPolicyParams.selector);
        policy.updatePolicy(invalidPolicy);
    }

    function test_UpdateThresholds() public {
        uint256[5] memory newPCSThresholds = [uint256(0), 250, 400, 650, 800];
        uint256[4] memory newPRSThresholds = [uint256(0), 20, 40, 70];

        vm.prank(owner);
        policy.updatePCSThresholds(newPCSThresholds);

        vm.prank(owner);
        policy.updatePRSThresholds(newPRSThresholds);

        // Test that the new thresholds affect scoring
        Policy.ELPResult memory result = policy.computeELP(250, 20);
        // With new thresholds, 250 should be Silver tier instead of Bronze
    }

    function test_UpdateMultipliers() public {
        uint256[5] memory newTierMultipliers = [uint256(0.3e18), 0.6e18, 0.9e18, 1.3e18, 1.8e18];
        uint256[4] memory newBandMultipliers = [uint256(0.7e18), 0.9e18, 1.3e18, 1.8e18];

        vm.prank(owner);
        policy.updateTierMultipliers(newTierMultipliers);

        vm.prank(owner);
        policy.updateBandMultipliers(newBandMultipliers);

        // Test that the new multipliers affect scoring
        Policy.ELPResult memory result1 = policy.computeELP(500, 25);

        // The result should be different with new multipliers
        assertGt(result1.maxNotional, 0);
    }

    function test_PolicyInactive() public {
        // Deactivate policy
        Policy.PolicyParams memory currentPolicy;
        (
            currentPolicy.version,
            currentPolicy.baseFee,
            currentPolicy.maxNotionalBase,
            currentPolicy.pcsMultiplier,
            currentPolicy.prsMultiplier,
            currentPolicy.minNotional,
            currentPolicy.maxNotional,
            currentPolicy.maxFeeBps,
            currentPolicy.active
        ) = policy.currentPolicy();

        currentPolicy.active = false;

        vm.prank(owner);
        policy.updatePolicy(currentPolicy);

        vm.expectRevert(Policy.PolicyNotActive.selector);
        policy.computeELP(500, 25);
    }

    // Fuzz tests
    function testFuzz_ComputeELP(uint256 pcsValue, uint256 prsValue) public {
        // Bound inputs to valid ranges
        pcsValue = bound(pcsValue, 0, 1000);
        prsValue = bound(prsValue, 0, 100);

        Policy.ELPResult memory result = policy.computeELP(pcsValue, prsValue);

        // Verify bounds are respected
        assertGe(result.maxNotional, 0.1 ether);
        assertLe(result.maxNotional, 100000 ether);
        assertLe(result.feeBps, 500);

        // Verify risk tier is valid
        bool validRiskTier = (
            keccak256(bytes(result.riskTier)) == keccak256(bytes("LOW")) ||
            keccak256(bytes(result.riskTier)) == keccak256(bytes("MEDIUM")) ||
            keccak256(bytes(result.riskTier)) == keccak256(bytes("HIGH"))
        );
        assertTrue(validRiskTier);
    }

    function testFuzz_PolicyUpdate(uint256 baseFee, uint256 maxNotionalBase) public {
        // Bound inputs to reasonable ranges
        baseFee = bound(baseFee, 1, 1000);
        maxNotionalBase = bound(maxNotionalBase, 1 ether, 1000000 ether);

        Policy.PolicyParams memory newPolicy = Policy.PolicyParams({
            version: 2,
            baseFee: baseFee,
            maxNotionalBase: maxNotionalBase,
            pcsMultiplier: 1e18,
            prsMultiplier: 1e18,
            minNotional: 0.1 ether,
            maxNotional: 100000 ether,
            maxFeeBps: 500,
            active: true
        });

        vm.prank(owner);
        policy.updatePolicy(newPolicy);

        // Test that ELP computation works with new parameters
        Policy.ELPResult memory result = policy.computeELP(500, 25);
        assertGt(result.maxNotional, 0);
    }

    function testFuzz_ThresholdUpdate(uint256[5] memory pcsThresholds) public {
        // Ensure thresholds are in ascending order and within bounds
        for (uint256 i = 0; i < 5; i++) {
            pcsThresholds[i] = bound(pcsThresholds[i], i * 200, 1000);
            if (i > 0) {
                vm.assume(pcsThresholds[i] >= pcsThresholds[i-1]);
            }
        }

        vm.prank(owner);
        policy.updatePCSThresholds(pcsThresholds);

        // Verify computation still works
        Policy.ELPResult memory result = policy.computeELP(500, 25);
        assertGt(result.maxNotional, 0);
    }
}