// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "../interfaces/IAttestationData.sol";

/**
 * @title AttestationDataLib
 * @notice Library for handling structured attestation data
 * @dev Provides encoding/decoding and validation for attestation data
 */
library AttestationDataLib {
    // Attestation type constants
    bytes32 public constant PCS_TYPE = keccak256("PCS");
    bytes32 public constant PRS_TYPE = keccak256("PRS");

    // Error definitions
    error InvalidAttestationType();
    error InvalidScore();
    error ExpiredAttestation();
    error InvalidPolicyVersion();

    /**
     * @notice Encode PCS attestation data
     * @param attestation PCS attestation struct
     * @return encoded ABI-encoded attestation data
     */
    function encodePCSAttestation(
        IAttestationData.PCSAttestation memory attestation
    ) internal pure returns (bytes memory encoded) {
        return abi.encode(attestation);
    }

    /**
     * @notice Decode PCS attestation data
     * @param data ABI-encoded attestation data
     * @return attestation Decoded PCS attestation
     */
    function decodePCSAttestation(
        bytes memory data
    ) internal pure returns (IAttestationData.PCSAttestation memory attestation) {
        return abi.decode(data, (IAttestationData.PCSAttestation));
    }

    /**
     * @notice Encode PRS attestation data
     * @param attestation PRS attestation struct
     * @return encoded ABI-encoded attestation data
     */
    function encodePRSAttestation(
        IAttestationData.PRSAttestation memory attestation
    ) internal pure returns (bytes memory encoded) {
        return abi.encode(attestation);
    }

    /**
     * @notice Decode PRS attestation data
     * @param data ABI-encoded attestation data
     * @return attestation Decoded PRS attestation
     */
    function decodePRSAttestation(
        bytes memory data
    ) internal pure returns (IAttestationData.PRSAttestation memory attestation) {
        return abi.decode(data, (IAttestationData.PRSAttestation));
    }

    /**
     * @notice Validate PCS attestation data
     * @param attestation PCS attestation to validate
     * @return isValid True if attestation is valid
     */
    function validatePCSAttestation(
        IAttestationData.PCSAttestation memory attestation
    ) internal view returns (bool isValid) {
        // Check score range (0-1000 for PCS)
        if (attestation.score > 1000) {
            return false;
        }

        // Check expiry
        if (attestation.expiry <= block.timestamp) {
            return false;
        }

        // Check required fields
        if (attestation.subject == bytes32(0) || attestation.operator == address(0)) {
            return false;
        }

        // Validate tier based on score
        if (!isValidPCSTier(attestation.score, attestation.tier)) {
            return false;
        }

        return true;
    }

    /**
     * @notice Validate PRS attestation data
     * @param attestation PRS attestation to validate
     * @return isValid True if attestation is valid
     */
    function validatePRSAttestation(
        IAttestationData.PRSAttestation memory attestation
    ) internal view returns (bool isValid) {
        // Check score range (0-100 for PRS)
        if (attestation.score > 100) {
            return false;
        }

        // Check expiry
        if (attestation.expiry <= block.timestamp) {
            return false;
        }

        // Check required fields
        if (attestation.poolId == bytes32(0) || attestation.operator == address(0)) {
            return false;
        }

        // Validate band based on score
        if (!isValidPRSBand(attestation.score, attestation.band)) {
            return false;
        }

        return true;
    }

    /**
     * @notice Check if PCS tier matches score
     * @param score Credit score (0-1000)
     * @param tier Credit tier string
     * @return isValid True if tier matches score range
     */
    function isValidPCSTier(uint256 score, string memory tier) internal pure returns (bool isValid) {
        bytes32 tierHash = keccak256(bytes(tier));

        if (score >= 800) {
            return tierHash == keccak256("EXCELLENT");
        } else if (score >= 600) {
            return tierHash == keccak256("GOOD");
        } else if (score >= 400) {
            return tierHash == keccak256("FAIR");
        } else {
            return tierHash == keccak256("POOR");
        }
    }

    /**
     * @notice Check if PRS band matches score
     * @param score Risk score (0-100)
     * @param band Risk band string
     * @return isValid True if band matches score range
     */
    function isValidPRSBand(uint256 score, string memory band) internal pure returns (bool isValid) {
        bytes32 bandHash = keccak256(bytes(band));

        if (score <= 20) {
            return bandHash == keccak256("LOW");
        } else if (score <= 50) {
            return bandHash == keccak256("MEDIUM");
        } else if (score <= 80) {
            return bandHash == keccak256("HIGH");
        } else {
            return bandHash == keccak256("CRITICAL");
        }
    }

    /**
     * @notice Create attestation hash from structured data
     * @param subject Subject identifier
     * @param attestationType Type of attestation
     * @param data Encoded attestation data
     * @param expiry Expiration timestamp
     * @return hash Attestation hash
     */
    function createAttestationHash(
        bytes32 subject,
        bytes32 attestationType,
        bytes memory data,
        uint256 expiry
    ) internal pure returns (bytes32 hash) {
        return keccak256(abi.encodePacked(subject, attestationType, data, expiry));
    }

    /**
     * @notice Parse attestation data based on type
     * @param attestationType Type of attestation (PCS or PRS)
     * @param data Encoded attestation data
     * @return subject Subject identifier
     * @return expiry Expiration timestamp
     * @return isValid True if data is valid
     */
    function parseAttestationData(
        bytes32 attestationType,
        bytes memory data
    ) internal view returns (bytes32 subject, uint256 expiry, bool isValid) {
        if (attestationType == PCS_TYPE) {
            IAttestationData.PCSAttestation memory pcsAttestation = decodePCSAttestation(data);
            return (
                pcsAttestation.subject,
                pcsAttestation.expiry,
                validatePCSAttestation(pcsAttestation)
            );
        } else if (attestationType == PRS_TYPE) {
            IAttestationData.PRSAttestation memory prsAttestation = decodePRSAttestation(data);
            return (
                prsAttestation.poolId, // Use poolId as subject for PRS
                prsAttestation.expiry,
                validatePRSAttestation(prsAttestation)
            );
        } else {
            revert InvalidAttestationType();
        }
    }

    /**
     * @notice Get score from attestation data
     * @param attestationType Type of attestation
     * @param data Encoded attestation data
     * @return score The score value
     */
    function getScoreFromAttestation(
        bytes32 attestationType,
        bytes memory data
    ) internal pure returns (uint256 score) {
        if (attestationType == PCS_TYPE) {
            IAttestationData.PCSAttestation memory pcsAttestation = decodePCSAttestation(data);
            return pcsAttestation.score;
        } else if (attestationType == PRS_TYPE) {
            IAttestationData.PRSAttestation memory prsAttestation = decodePRSAttestation(data);
            return prsAttestation.score;
        } else {
            revert InvalidAttestationType();
        }
    }
}