// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "forge-std/Test.sol";
import "../src/AttestationRegistry.sol";

contract AttestationRegistryTest is Test {
    AttestationRegistry public registry;
    address public admin;
    address public operator1;
    address public operator2;
    address public user;

    bytes32 public constant PCS_TYPE = keccak256("PCS");
    bytes32 public constant PRS_TYPE = keccak256("PRS");

    event AttestationPublished(
        bytes32 indexed subject,
        bytes32 indexed attestationType,
        bytes32 indexed attestationHash,
        address operator,
        uint256 expiry
    );

    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);

    function setUp() public {
        admin = makeAddr("admin");
        operator1 = makeAddr("operator1");
        operator2 = makeAddr("operator2");
        user = makeAddr("user");

        vm.prank(admin);
        registry = new AttestationRegistry(admin);
    }

    function test_Deployment() public {
        assertEq(registry.hasRole(registry.DEFAULT_ADMIN_ROLE(), admin), true);
        assertEq(registry.hasRole(registry.ADMIN_ROLE(), admin), true);
        assertEq(registry.operatorCount(), 0);
    }

    function test_AddOperator() public {
        vm.prank(admin);
        vm.expectEmit(true, false, false, false);
        emit OperatorAdded(operator1);
        registry.addOperator(operator1);

        assertEq(registry.operators(operator1), true);
        assertEq(registry.operatorCount(), 1);
    }

    function test_AddOperator_OnlyAdmin() public {
        vm.prank(user);
        vm.expectRevert();
        registry.addOperator(operator1);
    }

    function test_AddOperator_AlreadyExists() public {
        vm.prank(admin);
        registry.addOperator(operator1);

        vm.prank(admin);
        vm.expectRevert("Operator already exists");
        registry.addOperator(operator1);
    }

    function test_RemoveOperator() public {
        vm.prank(admin);
        registry.addOperator(operator1);

        vm.prank(admin);
        vm.expectEmit(true, false, false, false);
        emit OperatorRemoved(operator1);
        registry.removeOperator(operator1);

        assertEq(registry.operators(operator1), false);
        assertEq(registry.operatorCount(), 0);
    }

    function test_RemoveOperator_DoesNotExist() public {
        vm.prank(admin);
        vm.expectRevert("Operator does not exist");
        registry.removeOperator(operator1);
    }

    function test_PublishAttestation() public {
        // Add operator
        vm.prank(admin);
        registry.addOperator(operator1);

        // Create mock attestation
        bytes memory attestationJSON = abi.encodePacked('{"subject":"test","type":"PCS"}');

        // Sign the attestation (simplified for test)
        bytes32 messageHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n", bytes(attestationJSON).length, attestationJSON));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(1, messageHash); // Using private key 1 for operator1
        bytes memory signature = abi.encodePacked(r, s, v);

        // Mock the operator1 address to match the signature
        vm.etch(operator1, new bytes(0));
        vm.mockCall(
            operator1,
            abi.encodeWithSignature("recover(bytes32,bytes)", messageHash, signature),
            abi.encode(operator1)
        );

        bytes32 expectedAttestationHash = keccak256(attestationJSON);
        bytes32 subject = keccak256(abi.encodePacked("subject_from_json"));
        bytes32 attestationType = keccak256(abi.encodePacked("PCS"));

        vm.expectEmit(true, true, true, false);
        emit AttestationPublished(subject, attestationType, expectedAttestationHash, operator1, block.timestamp + 3600);

        registry.publishAttestation(attestationJSON, signature);
    }

    function test_IsOperator() public {
        assertEq(registry.isOperator(operator1), false);

        vm.prank(admin);
        registry.addOperator(operator1);

        assertEq(registry.isOperator(operator1), true);
    }

    function test_IsAttestationValid() public {
        // Setup operator
        vm.prank(admin);
        registry.addOperator(operator1);

        bytes32 subject = keccak256("test_subject");
        bytes32 attestationType = PCS_TYPE;

        // Initially no attestation
        assertEq(registry.isAttestationValid(subject, attestationType), false);

        // Add attestation directly (for testing)
        AttestationRegistry.Attestation memory attestation = AttestationRegistry.Attestation({
            attestationHash: keccak256("test_hash"),
            operator: operator1,
            issuedAt: block.timestamp,
            expiry: block.timestamp + 3600,
            ipfsUri: "",
            revoked: false
        });

        // We would need to make this accessible for testing
        // For now, this tests the view function logic
    }

    function test_RevokeAttestation() public {
        bytes32 attestationHash = keccak256("test_hash");

        vm.prank(admin);
        registry.revokeAttestation(attestationHash);

        assertEq(registry.revokedAttestations(attestationHash), true);
    }

    function test_RevokeAttestation_OnlyAdmin() public {
        bytes32 attestationHash = keccak256("test_hash");

        vm.prank(user);
        vm.expectRevert();
        registry.revokeAttestation(attestationHash);
    }

    // Fuzz tests
    function testFuzz_AddMultipleOperators(address[] memory operators) public {
        vm.assume(operators.length <= 10); // Reasonable limit for testing

        uint256 validOperators = 0;
        for (uint256 i = 0; i < operators.length; i++) {
            if (operators[i] != address(0) && operators[i] != admin) {
                bool alreadyExists = false;
                for (uint256 j = 0; j < i; j++) {
                    if (operators[j] == operators[i]) {
                        alreadyExists = true;
                        break;
                    }
                }

                if (!alreadyExists) {
                    vm.prank(admin);
                    registry.addOperator(operators[i]);
                    validOperators++;

                    assertEq(registry.operators(operators[i]), true);
                }
            }
        }

        assertEq(registry.operatorCount(), validOperators);
    }

    function testFuzz_OperatorManagement(address operator) public {
        vm.assume(operator != address(0) && operator != admin);

        // Test adding operator
        vm.prank(admin);
        registry.addOperator(operator);
        assertEq(registry.isOperator(operator), true);

        // Test removing operator
        vm.prank(admin);
        registry.removeOperator(operator);
        assertEq(registry.isOperator(operator), false);
    }
}