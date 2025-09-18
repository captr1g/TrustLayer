// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Test.sol";
import "../src/AttestationRegistry.sol";
import "../src/interfaces/IAttestationData.sol";
import "../src/libraries/AttestationDataLib.sol";

/**
 * @title StructuredAttestationTest
 * @notice Test structured attestation functionality
 */
contract StructuredAttestationTest is Test {
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

    function test_CreatePCSAttestation() public {
        // Create PCS attestation data
        IAttestationData.PCSAttestation memory pcsData = IAttestationData.PCSAttestation({
            subject: keccak256(abi.encodePacked(user1)),
            score: 750,
            tier: "GOOD",
            issuedAt: block.timestamp,
            expiry: block.timestamp + 1 hours,
            policyVersion: "v1.0",
            operator: operator1
        });

        // Encode the attestation data
        bytes memory encodedData = AttestationDataLib.encodePCSAttestation(pcsData);

        // Create attestation request
        IAttestationData.AttestationRequest memory request = IAttestationData.AttestationRequest({
            subject: pcsData.subject,
            attestationType: AttestationDataLib.PCS_TYPE,
            data: encodedData,
            expiry: pcsData.expiry,
            ipfsUri: ""
        });

        // Sign the request
        bytes32 messageHash = keccak256(abi.encode(request));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operator1Key, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Publish attestation
        vm.prank(operator1);
        registry.publishStructuredAttestation(request, signature);

        // Verify attestation was stored
        AttestationRegistry.Attestation memory attestation = registry.getLatestAttestation(
            pcsData.subject,
            AttestationDataLib.PCS_TYPE
        );

        assertEq(attestation.operator, operator1);
        assertEq(attestation.expiry, pcsData.expiry);
        assertFalse(attestation.revoked);
    }

    function test_CreatePRSAttestation() public {
        bytes32 poolId = keccak256("USDC/ETH-500");

        // Create PRS attestation data
        IAttestationData.PRSAttestation memory prsData = IAttestationData.PRSAttestation({
            poolId: poolId,
            score: 35,
            band: "MEDIUM",
            issuedAt: block.timestamp,
            expiry: block.timestamp + 30 minutes,
            policyVersion: "v1.0",
            operator: operator1
        });

        // Encode the attestation data
        bytes memory encodedData = AttestationDataLib.encodePRSAttestation(prsData);

        // Create attestation request
        IAttestationData.AttestationRequest memory request = IAttestationData.AttestationRequest({
            subject: poolId,
            attestationType: AttestationDataLib.PRS_TYPE,
            data: encodedData,
            expiry: prsData.expiry,
            ipfsUri: "ipfs://QmExample"
        });

        // Sign the request
        bytes32 messageHash = keccak256(abi.encode(request));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operator1Key, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Publish attestation
        vm.prank(operator1);
        registry.publishStructuredAttestation(request, signature);

        // Verify attestation was stored
        AttestationRegistry.Attestation memory attestation = registry.getLatestAttestation(
            poolId,
            AttestationDataLib.PRS_TYPE
        );

        assertEq(attestation.operator, operator1);
        assertEq(attestation.expiry, prsData.expiry);
        assertEq(attestation.ipfsUri, "ipfs://QmExample");
        assertFalse(attestation.revoked);
    }

    function test_ValidatePCSScore() public {
        // Test EXCELLENT tier (800+)
        IAttestationData.PCSAttestation memory excellentPCS = IAttestationData.PCSAttestation({
            subject: keccak256(abi.encodePacked(user1)),
            score: 850,
            tier: "EXCELLENT",
            issuedAt: block.timestamp,
            expiry: block.timestamp + 1 hours,
            policyVersion: "v1.0",
            operator: operator1
        });

        assertTrue(AttestationDataLib.validatePCSAttestation(excellentPCS));

        // Test invalid tier for score
        excellentPCS.tier = "POOR"; // Invalid for score 850
        assertFalse(AttestationDataLib.validatePCSAttestation(excellentPCS));
    }

    function test_ValidatePRSScore() public {
        bytes32 poolId = keccak256("USDC/ETH-500");

        // Test LOW band (0-20)
        IAttestationData.PRSAttestation memory lowPRS = IAttestationData.PRSAttestation({
            poolId: poolId,
            score: 15,
            band: "LOW",
            issuedAt: block.timestamp,
            expiry: block.timestamp + 30 minutes,
            policyVersion: "v1.0",
            operator: operator1
        });

        assertTrue(AttestationDataLib.validatePRSAttestation(lowPRS));

        // Test invalid band for score
        lowPRS.band = "CRITICAL"; // Invalid for score 15
        assertFalse(AttestationDataLib.validatePRSAttestation(lowPRS));
    }

    function test_RevertInvalidScore() public {
        // Test PCS score over 1000
        IAttestationData.PCSAttestation memory invalidPCS = IAttestationData.PCSAttestation({
            subject: keccak256(abi.encodePacked(user1)),
            score: 1500, // Invalid: over 1000
            tier: "EXCELLENT",
            issuedAt: block.timestamp,
            expiry: block.timestamp + 1 hours,
            policyVersion: "v1.0",
            operator: operator1
        });

        bytes memory encodedData = AttestationDataLib.encodePCSAttestation(invalidPCS);

        IAttestationData.AttestationRequest memory request = IAttestationData.AttestationRequest({
            subject: invalidPCS.subject,
            attestationType: AttestationDataLib.PCS_TYPE,
            data: encodedData,
            expiry: invalidPCS.expiry,
            ipfsUri: ""
        });

        bytes32 messageHash = keccak256(abi.encode(request));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operator1Key, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(operator1);
        vm.expectRevert(AttestationRegistry.InvalidAttestation.selector);
        registry.publishStructuredAttestation(request, signature);
    }

    function test_RevertExpiredAttestation() public {
        // Move time forward to ensure we have valid timestamps
        vm.warp(block.timestamp + 3 hours);

        // Create expired PCS attestation
        IAttestationData.PCSAttestation memory expiredPCS = IAttestationData.PCSAttestation({
            subject: keccak256(abi.encodePacked(user1)),
            score: 750,
            tier: "GOOD",
            issuedAt: block.timestamp - 2 hours,
            expiry: block.timestamp - 1 hours, // Expired
            policyVersion: "v1.0",
            operator: operator1
        });

        bytes memory encodedData = AttestationDataLib.encodePCSAttestation(expiredPCS);

        IAttestationData.AttestationRequest memory request = IAttestationData.AttestationRequest({
            subject: expiredPCS.subject,
            attestationType: AttestationDataLib.PCS_TYPE,
            data: encodedData,
            expiry: expiredPCS.expiry,
            ipfsUri: ""
        });

        bytes32 messageHash = keccak256(abi.encode(request));
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(operator1Key, ethSignedMessageHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(operator1);
        vm.expectRevert(AttestationRegistry.InvalidAttestation.selector);
        registry.publishStructuredAttestation(request, signature);
    }

    function test_GetScoreFromAttestation() public {
        // Create and encode PCS attestation
        IAttestationData.PCSAttestation memory pcsData = IAttestationData.PCSAttestation({
            subject: keccak256(abi.encodePacked(user1)),
            score: 650,
            tier: "GOOD",
            issuedAt: block.timestamp,
            expiry: block.timestamp + 1 hours,
            policyVersion: "v1.0",
            operator: operator1
        });

        bytes memory encodedData = AttestationDataLib.encodePCSAttestation(pcsData);

        // Test score extraction
        uint256 extractedScore = AttestationDataLib.getScoreFromAttestation(
            AttestationDataLib.PCS_TYPE,
            encodedData
        );

        assertEq(extractedScore, 650);
    }

    function test_AttestationDataEncodingDecoding() public {
        // Test PCS encoding/decoding
        IAttestationData.PCSAttestation memory originalPCS = IAttestationData.PCSAttestation({
            subject: keccak256(abi.encodePacked(user1)),
            score: 800,
            tier: "EXCELLENT",
            issuedAt: block.timestamp,
            expiry: block.timestamp + 1 hours,
            policyVersion: "v1.0",
            operator: operator1
        });

        bytes memory encoded = AttestationDataLib.encodePCSAttestation(originalPCS);
        IAttestationData.PCSAttestation memory decoded = AttestationDataLib.decodePCSAttestation(encoded);

        assertEq(decoded.subject, originalPCS.subject);
        assertEq(decoded.score, originalPCS.score);
        assertEq(keccak256(bytes(decoded.tier)), keccak256(bytes(originalPCS.tier)));
        assertEq(decoded.issuedAt, originalPCS.issuedAt);
        assertEq(decoded.expiry, originalPCS.expiry);
        assertEq(decoded.operator, originalPCS.operator);
    }
}