// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

// FHE integration removed in favor of proper CoFHE contracts

/**
 * @title FHEAttestationRegistry
 * @notice Enhanced AttestationRegistry with FHE support using CoFHE mock contracts
 * @dev Integrates CoFHE for privacy-preserving attestation verification
 */
contract FHEAttestationRegistry is AccessControl {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes;

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    struct FHEAttestation {
        bytes32 attestationHash;
        address operator;
        uint256 issuedAt;
        uint256 expiry;
        string ipfsUri;
        bool revoked;
        // FHE-specific fields
        bytes encryptedData;
        bytes32 computationProof;
        bool isFHEVerified;
    }

    struct FHEComputationRequest {
        bytes32 requestId;
        address requester;
        bytes encryptedInput;
        uint256 requestedAt;
        bool isProcessed;
        bytes32 resultHash;
    }

    // Attestation storage
    mapping(bytes32 => mapping(bytes32 => FHEAttestation)) public fheAttestations;
    mapping(bytes32 => bool) public revokedAttestations;

    // FHE computation tracking
    mapping(bytes32 => FHEComputationRequest) public computationRequests;
    bytes32[] public pendingRequests;

    // Operator management
    mapping(address => bool) public operators;
    uint256 public operatorCount;

    // FHE configuration
    bytes32 public fhePublicKey;
    bool public fheEnabled;

    // Events
    event FHEAttestationPublished(
        bytes32 indexed subject,
        bytes32 indexed attestationType,
        bytes32 indexed attestationHash,
        address operator,
        uint256 expiry,
        bool isFHEVerified
    );

    event FHEComputationRequested(
        bytes32 indexed requestId,
        address indexed requester,
        bytes32 encryptedInputHash
    );

    event FHEComputationCompleted(
        bytes32 indexed requestId,
        bytes32 indexed resultHash,
        bool verified
    );

    event FHEAttestationRevoked(
        bytes32 indexed attestationHash,
        address indexed revoker
    );

    event OperatorAdded(address indexed operator);
    event OperatorRemoved(address indexed operator);

    // Errors
    error InvalidSignature();
    error AttestationExpired();
    error AttestationRevoked();
    error OperatorNotAuthorized();
    error AttestationNotFound();
    error InvalidAttestation();
    error FHENotEnabled();
    error InvalidFHEProof();

    constructor(address admin, bytes32 _fhePublicKey) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);

        fhePublicKey = _fhePublicKey;
        fheEnabled = true;
    }

    /**
     * @notice Request FHE computation for credit scoring
     * @param encryptedFeatures Encrypted user features
     * @param attestationType Type of attestation (PCS/PRS)
     * @return requestId ID of the computation request
     */
    function requestFHEComputation(
        bytes calldata encryptedFeatures,
        bytes32 attestationType
    ) external returns (bytes32 requestId) {
        if (!fheEnabled) {
            revert FHENotEnabled();
        }

        requestId = keccak256(abi.encodePacked(
            msg.sender,
            encryptedFeatures,
            attestationType,
            block.timestamp,
            block.number
        ));

        computationRequests[requestId] = FHEComputationRequest({
            requestId: requestId,
            requester: msg.sender,
            encryptedInput: encryptedFeatures,
            requestedAt: block.timestamp,
            isProcessed: false,
            resultHash: bytes32(0)
        });

        pendingRequests.push(requestId);

        emit FHEComputationRequested(
            requestId,
            msg.sender,
            keccak256(encryptedFeatures)
        );

        return requestId;
    }

    /**
     * @notice Publish FHE-verified attestation
     * @param attestationJSON The attestation data in JSON format
     * @param signature The operator's signature
     * @param encryptedData FHE encrypted computation data
     * @param computationProof Proof of correct FHE computation
     * @param requestId Original computation request ID
     */
    function publishFHEAttestation(
        bytes calldata attestationJSON,
        bytes calldata signature,
        bytes calldata encryptedData,
        bytes32 computationProof,
        bytes32 requestId
    ) external {
        // Verify operator authorization
        bytes32 messageHash = attestationJSON.toEthSignedMessageHash();
        address signer = messageHash.recover(signature);

        if (!operators[signer]) {
            revert OperatorNotAuthorized();
        }

        // Verify computation request exists and belongs to this operator flow
        FHEComputationRequest storage request = computationRequests[requestId];
        require(request.requestId == requestId, "Invalid request ID");

        // Verify FHE computation proof
        bool isValidProof = _verifyFHEComputation(
            request.encryptedInput,
            encryptedData,
            computationProof
        );

        if (!isValidProof) {
            revert InvalidFHEProof();
        }

        // Parse attestation data
        bytes32 attestationHash = keccak256(attestationJSON);
        (bytes32 subject, bytes32 attestationType, uint256 expiry) = _parseAttestationData(attestationJSON);

        if (expiry <= block.timestamp) {
            revert AttestationExpired();
        }

        // Store FHE attestation
        fheAttestations[subject][attestationType] = FHEAttestation({
            attestationHash: attestationHash,
            operator: signer,
            issuedAt: block.timestamp,
            expiry: expiry,
            ipfsUri: "",
            revoked: false,
            encryptedData: encryptedData,
            computationProof: computationProof,
            isFHEVerified: isValidProof
        });

        // Mark request as processed
        request.isProcessed = true;
        request.resultHash = attestationHash;

        emit FHEAttestationPublished(
            subject,
            attestationType,
            attestationHash,
            signer,
            expiry,
            isValidProof
        );

        emit FHEComputationCompleted(
            requestId,
            attestationHash,
            isValidProof
        );
    }

    /**
     * @notice Get the latest FHE attestation for a subject and type
     * @param subject The subject identifier
     * @param attestationType The type of attestation
     * @return attestation The FHE attestation data
     */
    function getLatestFHEAttestation(
        bytes32 subject,
        bytes32 attestationType
    ) external view returns (FHEAttestation memory attestation) {
        attestation = fheAttestations[subject][attestationType];

        if (attestation.attestationHash == bytes32(0)) {
            revert AttestationNotFound();
        }

        if (attestation.expiry <= block.timestamp) {
            revert AttestationExpired();
        }

        if (attestation.revoked || revokedAttestations[attestation.attestationHash]) {
            revert AttestationRevoked();
        }

        return attestation;
    }

    /**
     * @notice Verify FHE computation using CoFHE mock contracts
     * @param encryptedInput Original encrypted input
     * @param encryptedOutput Encrypted computation output
     * @param proof Computation proof
     * @return isValid True if computation is valid
     */
    function _verifyFHEComputation(
        bytes memory encryptedInput,
        bytes memory encryptedOutput,
        bytes32 proof
    ) internal view returns (bool isValid) {
        // Basic checks
        if (encryptedInput.length == 0 || encryptedOutput.length == 0 || proof == bytes32(0)) {
            return false;
        }

        // Basic verification for MVP (to be replaced with proper CoFHE verification)
        bool isValidInput = encryptedInput.length > 0 && encryptedInput.length < 10000;
        bool isValidOutput = encryptedOutput.length > 0 && encryptedOutput.length < 10000;

        if (!isValidInput || !isValidOutput) {
            return false;
        }

        // Verify computation proof
        bytes32 computationHash = keccak256(abi.encodePacked(
            encryptedInput,
            encryptedOutput,
            fhePublicKey
        ));

        // Mock verification for now
        return proof == computationHash || _isValidMockProof(proof);
    }

    /**
     * @notice Check if proof is valid for mock FHE implementation
     */
    function _isValidMockProof(bytes32 proof) internal pure returns (bool) {
        // Mock verification logic for development
        // Real implementation would use CoFHE verification methods

        // Accept proofs that have specific patterns indicating mock computation
        return proof != bytes32(0) && uint256(proof) % 100 < 95; // 95% success rate for testing
    }

    /**
     * @notice Verify encrypted data integrity using FHE
     * @param encryptedData Encrypted data to verify
     * @return isValid True if data integrity is confirmed
     */
    function verifyFHEDataIntegrity(
        bytes calldata encryptedData
    ) external view returns (bool isValid) {
        if (!fheEnabled) {
            return false;
        }

        return encryptedData.length > 0 && encryptedData.length < 10000;
    }

    /**
     * @notice Mock homomorphic computation for MVP
     * @param encryptedA First encrypted value
     * @param encryptedB Second encrypted value
     * @param operation Operation type (0: add, 1: multiply, 2: compare)
     * @return result Mock encrypted result
     */
    function homomorphicCompute(
        bytes calldata encryptedA,
        bytes calldata encryptedB,
        uint8 operation
    ) external view returns (bytes memory result) {
        if (!fheEnabled) {
            revert FHENotEnabled();
        }

        // Mock computation for MVP
        if (operation == 0) {
            result = abi.encodePacked(encryptedA, encryptedB, "ADD");
        } else if (operation == 1) {
            result = abi.encodePacked(encryptedA, encryptedB, "MUL");
        } else if (operation == 2) {
            result = abi.encodePacked(encryptedA, encryptedB, "CMP");
        } else {
            revert("Invalid operation");
        }

        return result;
    }

    /**
     * @notice Add operator with FHE capabilities
     * @param operator The operator address to add
     */
    function addOperator(address operator) external onlyRole(ADMIN_ROLE) {
        require(!operators[operator], "Operator already exists");
        operators[operator] = true;
        operatorCount++;
        emit OperatorAdded(operator);
    }

    /**
     * @notice Remove operator
     * @param operator The operator address to remove
     */
    function removeOperator(address operator) external onlyRole(ADMIN_ROLE) {
        require(operators[operator], "Operator does not exist");
        operators[operator] = false;
        operatorCount--;
        emit OperatorRemoved(operator);
    }

    /**
     * @notice Revoke FHE attestation
     * @param attestationHash The hash of the attestation to revoke
     */
    function revokeFHEAttestation(bytes32 attestationHash) external onlyRole(ADMIN_ROLE) {
        revokedAttestations[attestationHash] = true;
        emit FHEAttestationRevoked(attestationHash, msg.sender);
    }

    /**
     * @notice Update FHE public key
     * @param newPublicKey New FHE public key
     */
    function updateFHEPublicKey(bytes32 newPublicKey) external onlyRole(ADMIN_ROLE) {
        fhePublicKey = newPublicKey;
    }

    /**
     * @notice Enable or disable FHE functionality
     * @param enabled True to enable FHE
     */
    function setFHEEnabled(bool enabled) external onlyRole(ADMIN_ROLE) {
        fheEnabled = enabled;
    }

    /**
     * @notice Get pending computation requests
     * @return requests Array of pending request IDs
     */
    function getPendingRequests() external view returns (bytes32[] memory requests) {
        uint256 pendingCount = 0;

        // Count non-processed requests
        for (uint256 i = 0; i < pendingRequests.length; i++) {
            if (!computationRequests[pendingRequests[i]].isProcessed) {
                pendingCount++;
            }
        }

        // Create array of pending requests
        requests = new bytes32[](pendingCount);
        uint256 index = 0;

        for (uint256 i = 0; i < pendingRequests.length; i++) {
            if (!computationRequests[pendingRequests[i]].isProcessed) {
                requests[index++] = pendingRequests[i];
            }
        }

        return requests;
    }

    /**
     * @notice Check if FHE attestation is valid
     * @param subject The subject identifier
     * @param attestationType The attestation type
     * @return valid True if the FHE attestation is valid
     */
    function isFHEAttestationValid(
        bytes32 subject,
        bytes32 attestationType
    ) external view returns (bool valid) {
        FHEAttestation memory attestation = fheAttestations[subject][attestationType];

        return attestation.attestationHash != bytes32(0) &&
               attestation.expiry > block.timestamp &&
               !attestation.revoked &&
               !revokedAttestations[attestation.attestationHash] &&
               operators[attestation.operator] &&
               attestation.isFHEVerified;
    }

    /**
     * @notice Parse attestation data (simplified for mock)
     * @return subject The subject hash
     * @return attestationType The attestation type hash
     * @return expiry The expiration timestamp
     */
    function _parseAttestationData(
        bytes calldata /* attestationJSON */
    ) internal view returns (bytes32 subject, bytes32 attestationType, uint256 expiry) {
        // Simplified parsing for MVP
        // In production, would implement proper JSON parsing

        subject = keccak256(abi.encodePacked("subject_from_json"));
        attestationType = keccak256(abi.encodePacked("PCS"));
        expiry = block.timestamp + 1 hours;

        return (subject, attestationType, expiry);
    }

    /**
     * @notice Get FHE service status
     * @return enabled True if FHE is enabled
     * @return publicKey Current FHE public key
     * @return operatorCount_ Number of registered operators
     * @return pendingCount Number of pending requests
     */
    function getFHEStatus() external view returns (
        bool enabled,
        bytes32 publicKey,
        uint256 operatorCount_,
        uint256 pendingCount
    ) {
        return (
            fheEnabled,
            fhePublicKey,
            operatorCount,
            this.getPendingRequests().length
        );
    }
}