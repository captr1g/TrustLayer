// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Test.sol";
import "../src/AttestationRegistry.sol";
import "../src/interfaces/IAttestationData.sol";
import "../src/libraries/AttestationDataLib.sol";

/**
 * @title SimplifiedIntegrationTest
 * @notice Simplified integration tests focusing on core functionality
 */
contract SimplifiedIntegrationTest is Test {
    AttestationRegistry public registry;
    address public admin;
    address public operator1;
    uint256 public operator1Key;
    address public user1;

    function setUp() public {
        admin = address(this);
        (operator1, operator1Key) = makeAddrAndKey("operator1");
        user1 = makeAddr("user1");

        registry = new AttestationRegistry(admin);
        registry.addOperator(operator1);
    }

    function test_Integration_PCSWorkflow() public {
        // Step 1: Create PCS attestation data
        IAttestationData.PCSAttestation memory pcsData = IAttestationData.PCSAttestation({
            subject: keccak256(abi.encodePacked(user1)),
            score: 750,
            tier: "GOOD",
            issuedAt: block.timestamp,
            expiry: block.timestamp + 1 hours,
            policyVersion: "v1.0",
            operator: operator1
        });

        // Step 2: Encode the attestation data
        bytes memory encodedData = AttestationDataLib.encodePCSAttestation(pcsData);

        // Step 3: Create attestation request
        IAttestationData.AttestationRequest memory request = IAttestationData.AttestationRequest({
            subject: pcsData.subject,
            attestationType: AttestationDataLib.PCS_TYPE,
            data: encodedData,
            expiry: pcsData.expiry,
            ipfsUri: ""
        });

        // Step 4: Sign the request
        bytes32 messageHash = keccak256(abi.encode(request));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operator1Key, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Step 5: Publish attestation
        vm.prank(operator1);
        registry.publishStructuredAttestation(request, signature);

        // Step 6: Verify attestation was stored correctly
        AttestationRegistry.Attestation memory attestation = registry.getLatestAttestation(
            pcsData.subject,
            AttestationDataLib.PCS_TYPE
        );

        assertEq(attestation.operator, operator1);
        assertEq(attestation.expiry, pcsData.expiry);
        assertFalse(attestation.revoked);

        // Step 7: Verify attestation is valid
        assertTrue(registry.isAttestationValid(pcsData.subject, AttestationDataLib.PCS_TYPE));

        // Step 8: Test score extraction
        uint256 extractedScore = AttestationDataLib.getScoreFromAttestation(
            AttestationDataLib.PCS_TYPE,
            encodedData
        );
        assertEq(extractedScore, 750);
    }

    function test_Integration_PRSWorkflow() public {
        bytes32 poolId = keccak256("USDC/ETH-500");

        // Step 1: Create PRS attestation data
        IAttestationData.PRSAttestation memory prsData = IAttestationData.PRSAttestation({
            poolId: poolId,
            score: 35,
            band: "MEDIUM",
            issuedAt: block.timestamp,
            expiry: block.timestamp + 30 minutes,
            policyVersion: "v1.0",
            operator: operator1
        });

        // Step 2: Encode the attestation data
        bytes memory encodedData = AttestationDataLib.encodePRSAttestation(prsData);

        // Step 3: Create attestation request
        IAttestationData.AttestationRequest memory request = IAttestationData.AttestationRequest({
            subject: poolId,
            attestationType: AttestationDataLib.PRS_TYPE,
            data: encodedData,
            expiry: prsData.expiry,
            ipfsUri: "ipfs://QmExample"
        });

        // Step 4: Sign and publish
        bytes32 messageHash = keccak256(abi.encode(request));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operator1Key, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(operator1);
        registry.publishStructuredAttestation(request, signature);

        // Step 5: Verify attestation
        AttestationRegistry.Attestation memory attestation = registry.getLatestAttestation(
            poolId,
            AttestationDataLib.PRS_TYPE
        );

        assertEq(attestation.operator, operator1);
        assertEq(attestation.ipfsUri, "ipfs://QmExample");
        assertTrue(registry.isAttestationValid(poolId, AttestationDataLib.PRS_TYPE));

        // Step 6: Test score extraction
        uint256 extractedScore = AttestationDataLib.getScoreFromAttestation(
            AttestationDataLib.PRS_TYPE,
            encodedData
        );
        assertEq(extractedScore, 35);
    }

    function test_Integration_AttestationValidation() public {
        bytes32 userSubject = keccak256(abi.encodePacked(user1));

        // Test 1: Valid score ranges
        _createAndTestPCS(userSubject, 850, "EXCELLENT", true);
        _createAndTestPCS(userSubject, 650, "GOOD", true);
        _createAndTestPCS(userSubject, 450, "FAIR", true);
        _createAndTestPCS(userSubject, 300, "POOR", true);

        // Test 2: Invalid score
        vm.expectRevert(AttestationRegistry.InvalidAttestation.selector);
        _createAndTestPCS(userSubject, 1500, "EXCELLENT", false); // Score too high

        // Test 3: Invalid tier for score
        vm.expectRevert(AttestationRegistry.InvalidAttestation.selector);
        _createAndTestPCS(userSubject, 850, "POOR", false); // Wrong tier for high score
    }

    function test_Integration_MultipleOperators() public {
        // Add second operator
        address operator2;
        uint256 operator2Key;
        (operator2, operator2Key) = makeAddrAndKey("operator2");
        registry.addOperator(operator2);

        bytes32 userSubject = keccak256(abi.encodePacked(user1));

        // Operator 1 creates attestation
        _createPCSAttestation(userSubject, 650, "GOOD", operator1, operator1Key);

        // Verify it exists
        assertTrue(registry.isAttestationValid(userSubject, AttestationDataLib.PCS_TYPE));

        // Operator 2 updates with new attestation
        vm.warp(block.timestamp + 1800);
        _createPCSAttestation(userSubject, 700, "GOOD", operator2, operator2Key);

        // Verify updated attestation is valid
        assertTrue(registry.isAttestationValid(userSubject, AttestationDataLib.PCS_TYPE));

        // Verify latest attestation is from operator2
        AttestationRegistry.Attestation memory attestation = registry.getLatestAttestation(
            userSubject,
            AttestationDataLib.PCS_TYPE
        );
        assertEq(attestation.operator, operator2);
    }

    function test_Integration_AttestationExpiry() public {
        bytes32 userSubject = keccak256(abi.encodePacked(user1));

        // Create short-lived attestation
        _createPCSAttestationWithExpiry(userSubject, 650, "GOOD", operator1, operator1Key, block.timestamp + 60);

        // Should be valid initially
        assertTrue(registry.isAttestationValid(userSubject, AttestationDataLib.PCS_TYPE));

        // Move past expiry
        vm.warp(block.timestamp + 120);

        // Should be invalid now
        assertFalse(registry.isAttestationValid(userSubject, AttestationDataLib.PCS_TYPE));

        // Getting expired attestation should revert
        vm.expectRevert(AttestationRegistry.AttestationExpired.selector);
        registry.getLatestAttestation(userSubject, AttestationDataLib.PCS_TYPE);
    }

    function test_Integration_AttestationRevocation() public {
        bytes32 userSubject = keccak256(abi.encodePacked(user1));

        // Create attestation
        _createPCSAttestation(userSubject, 650, "GOOD", operator1, operator1Key);

        // Should be valid
        assertTrue(registry.isAttestationValid(userSubject, AttestationDataLib.PCS_TYPE));

        // Get attestation hash
        AttestationRegistry.Attestation memory attestation = registry.getLatestAttestation(
            userSubject,
            AttestationDataLib.PCS_TYPE
        );

        // Revoke attestation
        registry.revokeAttestation(attestation.attestationHash);

        // Should be invalid now
        assertFalse(registry.isAttestationValid(userSubject, AttestationDataLib.PCS_TYPE));

        // Getting revoked attestation should revert
        vm.expectRevert(AttestationRegistry.AttestationIsRevoked.selector);
        registry.getLatestAttestation(userSubject, AttestationDataLib.PCS_TYPE);
    }

    // Helper Functions

    function _createAndTestPCS(bytes32 subject, uint256 score, string memory tier, bool shouldSucceed) internal {
        IAttestationData.PCSAttestation memory pcsData = IAttestationData.PCSAttestation({
            subject: subject,
            score: score,
            tier: tier,
            issuedAt: block.timestamp,
            expiry: block.timestamp + 1 hours,
            policyVersion: "v1.0",
            operator: operator1
        });

        bytes memory encodedData = AttestationDataLib.encodePCSAttestation(pcsData);

        IAttestationData.AttestationRequest memory request = IAttestationData.AttestationRequest({
            subject: subject,
            attestationType: AttestationDataLib.PCS_TYPE,
            data: encodedData,
            expiry: pcsData.expiry,
            ipfsUri: ""
        });

        bytes32 messageHash = keccak256(abi.encode(request));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operator1Key, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(operator1);
        registry.publishStructuredAttestation(request, signature);

        if (shouldSucceed) {
            assertTrue(registry.isAttestationValid(subject, AttestationDataLib.PCS_TYPE));
        }
    }

    function _createPCSAttestation(
        bytes32 subject,
        uint256 score,
        string memory tier,
        address operator,
        uint256 operatorKey
    ) internal {
        _createPCSAttestationWithExpiry(subject, score, tier, operator, operatorKey, block.timestamp + 1 hours);
    }

    function _createPCSAttestationWithExpiry(
        bytes32 subject,
        uint256 score,
        string memory tier,
        address operator,
        uint256 operatorKey,
        uint256 expiry
    ) internal {
        IAttestationData.PCSAttestation memory pcsData = IAttestationData.PCSAttestation({
            subject: subject,
            score: score,
            tier: tier,
            issuedAt: block.timestamp,
            expiry: expiry,
            policyVersion: "v1.0",
            operator: operator
        });

        bytes memory encodedData = AttestationDataLib.encodePCSAttestation(pcsData);

        IAttestationData.AttestationRequest memory request = IAttestationData.AttestationRequest({
            subject: subject,
            attestationType: AttestationDataLib.PCS_TYPE,
            data: encodedData,
            expiry: pcsData.expiry,
            ipfsUri: ""
        });

        bytes32 messageHash = keccak256(abi.encode(request));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operatorKey, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(operator);
        registry.publishStructuredAttestation(request, signature);
    }
}