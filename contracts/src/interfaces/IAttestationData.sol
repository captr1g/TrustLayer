// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

/**
 * @title IAttestationData
 * @notice Structured data interface for attestations instead of JSON parsing
 * @dev More gas-efficient and secure than JSON parsing in Solidity
 */
interface IAttestationData {
    /**
     * @notice Structured attestation data for PCS (Personal Credit Score)
     */
    struct PCSAttestation {
        bytes32 subject;           // Hash of the subject (user address or identifier)
        uint256 score;             // Credit score (0-1000)
        string tier;               // Credit tier (e.g., "EXCELLENT", "GOOD", "FAIR", "POOR")
        uint256 issuedAt;         // Timestamp when issued
        uint256 expiry;           // Expiration timestamp
        string policyVersion;     // Policy version used
        address operator;         // Operator who issued the attestation
    }

    /**
     * @notice Structured attestation data for PRS (Pool Risk Score)
     */
    struct PRSAttestation {
        bytes32 poolId;           // Pool identifier
        uint256 score;            // Risk score (0-100)
        string band;              // Risk band (e.g., "LOW", "MEDIUM", "HIGH", "CRITICAL")
        uint256 issuedAt;        // Timestamp when issued
        uint256 expiry;          // Expiration timestamp
        string policyVersion;    // Policy version used
        address operator;        // Operator who issued the attestation
    }

    /**
     * @notice Generic attestation metadata
     */
    struct AttestationMetadata {
        bytes32 attestationHash;
        bytes32 subject;
        bytes32 attestationType;
        uint256 expiry;
        string ipfsUri;
        bytes signature;
    }

    /**
     * @notice Attestation creation request
     */
    struct AttestationRequest {
        bytes32 subject;
        bytes32 attestationType;
        bytes data;              // ABI-encoded attestation data
        uint256 expiry;
        string ipfsUri;
    }

    // Events
    event StructuredAttestationCreated(
        bytes32 indexed subject,
        bytes32 indexed attestationType,
        uint256 expiry
    );

    event AttestationDataValidated(
        bytes32 indexed attestationHash,
        bool isValid
    );
}