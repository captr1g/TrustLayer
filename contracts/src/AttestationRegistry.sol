// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./interfaces/IAttestationData.sol";
import "./libraries/AttestationDataLib.sol";

/**
 * @title AttestationRegistry
 * @notice Registry for storing signed attestations from approved operators
 * @dev Handles PCS (Personal Credit Score) and PRS (Pool Risk Score) attestations
 */
contract AttestationRegistry is AccessControl {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes;
    using AttestationDataLib for bytes;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    struct Attestation {
        bytes32 attestationHash;
        address operator;
        uint256 issuedAt;
        uint256 expiry;
        string ipfsUri;
        bool revoked;
    }

    // subject => attestationType => Attestation
    mapping(bytes32 => mapping(bytes32 => Attestation)) public attestations;

    // attestationHash => bool (for revocation tracking)
    mapping(bytes32 => bool) public revokedAttestations;

    // Operator management
    mapping(address => bool) public operators;
    uint256 public operatorCount;

    // Events
    event AttestationPublished(
        bytes32 indexed subject,
        bytes32 indexed attestationType,
        bytes32 indexed attestationHash,
        address operator,
        uint256 expiry
    );

    event AttestationRevoked(
        bytes32 indexed attestationHash,
        address indexed revoker
    );

    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);

    // Errors
    error InvalidSignature();
    error AttestationExpired();
    error AttestationIsRevoked();
    error OperatorNotAuthorized();
    error AttestationNotFound();
    error InvalidAttestation();

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
    }

    /**
     * @notice Publish a signed attestation using structured data
     * @param request Structured attestation request
     * @param signature The operator's signature
     */
    function publishStructuredAttestation(
        IAttestationData.AttestationRequest calldata request,
        bytes calldata signature
    ) external {
        // Verify operator authorization
        bytes32 requestHash = keccak256(abi.encode(request));
        bytes32 messageHash = MessageHashUtils.toEthSignedMessageHash(requestHash);
        address signer = messageHash.recover(signature);

        if (!operators[signer]) {
            revert OperatorNotAuthorized();
        }

        // Parse and validate attestation data
        (bytes32 subject, uint256 expiry, bool isValid) = AttestationDataLib.parseAttestationData(
            request.attestationType,
            request.data
        );

        if (!isValid) {
            revert InvalidAttestation();
        }

        if (expiry <= block.timestamp) {
            revert AttestationExpired();
        }

        // Create attestation hash
        bytes32 attestationHash = AttestationDataLib.createAttestationHash(
            subject,
            request.attestationType,
            request.data,
            expiry
        );

        // Store attestation
        attestations[subject][request.attestationType] = Attestation({
            attestationHash: attestationHash,
            operator: signer,
            issuedAt: block.timestamp,
            expiry: expiry,
            ipfsUri: request.ipfsUri,
            revoked: false
        });

        emit AttestationPublished(
            subject,
            request.attestationType,
            attestationHash,
            signer,
            expiry
        );
    }

    /**
     * @notice Publish a signed attestation (legacy JSON method)
     * @param attestationJSON The attestation data in JSON format
     * @param signature The operator's signature
     */
    function publishAttestation(
        bytes calldata attestationJSON,
        bytes calldata signature
    ) external {
        // Verify signature
        bytes32 messageHash = attestationJSON.toEthSignedMessageHash();
        address signer = messageHash.recover(signature);

        if (!operators[signer]) {
            revert OperatorNotAuthorized();
        }

        // Parse attestation data (simplified - in production would use more robust parsing)
        bytes32 attestationHash = keccak256(attestationJSON);

        // Extract subject and type from JSON (simplified parsing)
        (bytes32 subject, bytes32 attestationType, uint256 expiry) = _parseAttestationData(attestationJSON);

        if (expiry <= block.timestamp) {
            revert AttestationExpired();
        }

        // Store attestation
        attestations[subject][attestationType] = Attestation({
            attestationHash: attestationHash,
            operator: signer,
            issuedAt: block.timestamp,
            expiry: expiry,
            ipfsUri: "",
            revoked: false
        });

        emit AttestationPublished(subject, attestationType, attestationHash, signer, expiry);
    }

    /**
     * @notice Get the latest attestation for a subject and type
     * @param subject The subject identifier (e.g., DID hash)
     * @param attestationType The type of attestation (PCS, PRS, etc.)
     * @return attestation The attestation data
     */
    function getLatestAttestation(
        bytes32 subject,
        bytes32 attestationType
    ) external view returns (Attestation memory attestation) {
        attestation = attestations[subject][attestationType];

        if (attestation.attestationHash == bytes32(0)) {
            revert AttestationNotFound();
        }

        if (attestation.expiry <= block.timestamp) {
            revert AttestationExpired();
        }

        if (attestation.revoked || revokedAttestations[attestation.attestationHash]) {
            revert AttestationIsRevoked();
        }

        return attestation;
    }

    /**
     * @notice Revoke an attestation
     * @param attestationHash The hash of the attestation to revoke
     */
    function revokeAttestation(bytes32 attestationHash) external onlyRole(ADMIN_ROLE) {
        revokedAttestations[attestationHash] = true;
        emit AttestationRevoked(attestationHash, msg.sender);
    }

    /**
     * @notice Add an operator
     * @param operator The operator address to add
     */
    function addOperator(address operator) external onlyRole(ADMIN_ROLE) {
        require(!operators[operator], "Operator already exists");
        operators[operator] = true;
        operatorCount++;
        emit OperatorAdded(operator);
    }

    /**
     * @notice Remove an operator
     * @param operator The operator address to remove
     */
    function removeOperator(address operator) external onlyRole(ADMIN_ROLE) {
        require(operators[operator], "Operator does not exist");
        operators[operator] = false;
        operatorCount--;
        emit OperatorRemoved(operator);
    }

    /**
     * @notice Check if an attestation is valid
     * @param subject The subject identifier
     * @param attestationType The attestation type
     * @return valid True if the attestation is valid and not expired
     */
    function isAttestationValid(
        bytes32 subject,
        bytes32 attestationType
    ) external view returns (bool valid) {
        Attestation memory attestation = attestations[subject][attestationType];

        return attestation.attestationHash != bytes32(0) &&
               attestation.expiry > block.timestamp &&
               !attestation.revoked &&
               !revokedAttestations[attestation.attestationHash] &&
               operators[attestation.operator];
    }

    /**
     * @notice Internal function to parse attestation data
     * @dev Simplified parsing - in production would use proper JSON parsing
     * @return subject The subject hash
     * @return attestationType The attestation type hash
     * @return expiry The expiration timestamp
     */
    function _parseAttestationData(
        bytes calldata /* attestationJSON */
    ) internal view returns (bytes32 subject, bytes32 attestationType, uint256 expiry) {
        // Simplified parsing for MVP
        // In production, would implement proper JSON parsing or use structured data

        // For now, assume the caller provides structured data in a specific format
        // This would be replaced with proper JSON parsing logic

        // Extract key fields from the JSON (mock implementation)
        subject = keccak256(abi.encodePacked("subject_from_json"));
        attestationType = keccak256(abi.encodePacked("PCS")); // or "PRS"
        expiry = block.timestamp + 1 hours; // Default 1 hour expiry for MVP

        return (subject, attestationType, expiry);
    }

    /**
     * @notice Get operator status
     * @param operator The operator address
     * @return isOperator True if the address is an authorized operator
     */
    function isOperator(address operator) external view returns (bool) {
        return operators[operator];
    }
}