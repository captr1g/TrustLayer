const { ethers } = require('ethers');

/**
 * Attestation Signer Service
 * Handles ECDSA signing of attestations for the AVS operator
 */
class AttestationSigner {
  constructor(privateKey) {
    if (!privateKey) {
      throw new Error('Operator private key is required');
    }

    try {
      this.wallet = new ethers.Wallet(privateKey);
      this.operatorAddress = this.wallet.address;
      console.log(`AttestationSigner initialized for operator: ${this.operatorAddress}`);
    } catch (error) {
      throw new Error(`Invalid private key: ${error.message}`);
    }
  }

  /**
   * Sign a structured attestation request
   * @param {Object} attestationRequest - Structured attestation request
   * @returns {Object} Signed attestation with signature
   */
  async signStructuredAttestation(attestationRequest) {
    try {
      // Validate attestation request structure
      this.validateAttestationRequest(attestationRequest);

      // Create the structured request object that matches the contract
      const requestData = {
        subject: attestationRequest.subject,
        attestationType: attestationRequest.attestationType,
        data: attestationRequest.data,
        expiry: attestationRequest.expiry,
        ipfsUri: attestationRequest.ipfsUri || ""
      };

      // Encode the request (matching contract's abi.encode)
      const abiCoder = ethers.AbiCoder.defaultAbiCoder();
      const encodedRequest = abiCoder.encode(
        ['tuple(bytes32,bytes32,bytes,uint256,string)'],
        [Object.values(requestData)]
      );

      // Create message hash
      const requestHash = ethers.keccak256(encodedRequest);

      // Sign the hash (this will automatically add the Ethereum message prefix)
      const signature = await this.wallet.signMessage(ethers.getBytes(requestHash));

      return {
        request: requestData,
        signature: signature,
        signer: this.operatorAddress
      };
    } catch (error) {
      console.error('Failed to sign structured attestation:', error);
      throw new Error(`Attestation signing failed: ${error.message}`);
    }
  }

  /**
   * Sign an attestation object (legacy JSON method)
   * @param {Object} attestation - Attestation data to sign
   * @returns {Object} Signed attestation with signature
   */
  async signAttestation(attestation) {
    try {
      // Validate attestation structure
      this.validateAttestation(attestation);

      // Create canonical JSON representation
      const attestationJSON = this.canonicalizeAttestation(attestation);

      // Create message hash
      const message = ethers.getBytes(ethers.toUtf8Bytes(attestationJSON));
      const messageHash = ethers.keccak256(message);

      // Sign the message hash
      const signature = await this.wallet.signMessage(ethers.getBytes(messageHash));

      return {
        attestation: attestationJSON,
        signature: signature,
        messageHash: messageHash,
        signer: this.operatorAddress
      };

    } catch (error) {
      throw new Error(`Attestation signing failed: ${error.message}`);
    }
  }

  /**
   * Verify an attestation signature
   * @param {string} attestationJSON - JSON attestation string
   * @param {string} signature - Signature to verify
   * @param {string} expectedSigner - Expected signer address
   * @returns {boolean} True if signature is valid
   */
  async verifyAttestation(attestationJSON, signature, expectedSigner = null) {
    try {
      // Create message hash
      const message = ethers.getBytes(ethers.toUtf8Bytes(attestationJSON));
      const messageHash = ethers.keccak256(message);

      // Recover signer address
      const recoveredAddress = ethers.verifyMessage(ethers.getBytes(messageHash), signature);

      // Check against expected signer if provided
      if (expectedSigner) {
        return recoveredAddress.toLowerCase() === expectedSigner.toLowerCase();
      }

      // Otherwise, check against this operator
      return recoveredAddress.toLowerCase() === this.operatorAddress.toLowerCase();

    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Sign batch attestations
   * @param {Array} attestations - Array of attestation objects
   * @returns {Array} Array of signed attestations
   */
  async signBatchAttestations(attestations) {
    if (!Array.isArray(attestations)) {
      throw new Error('Attestations must be an array');
    }

    const signedAttestations = [];

    for (const attestation of attestations) {
      try {
        const signed = await this.signAttestation(attestation);
        signedAttestations.push(signed);
      } catch (error) {
        // Continue with other attestations even if one fails
        signedAttestations.push({
          error: error.message,
          attestation: attestation
        });
      }
    }

    return signedAttestations;
  }

  /**
   * Get operator address
   * @returns {string} Operator wallet address
   */
  getOperatorAddress() {
    return this.operatorAddress;
  }

  /**
   * Get operator public key
   * @returns {string} Operator public key
   */
  getOperatorPublicKey() {
    return this.wallet.publicKey;
  }

  /**
   * Create a challenge response for operator authentication
   * @param {string} challenge - Challenge string
   * @returns {Object} Signed challenge response
   */
  async signChallenge(challenge) {
    if (!challenge || typeof challenge !== 'string') {
      throw new Error('Valid challenge string is required');
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const challengeData = {
      challenge: challenge,
      operator: this.operatorAddress,
      timestamp: timestamp
    };

    const challengeJSON = JSON.stringify(challengeData, null, 0);
    const signature = await this.wallet.signMessage(challengeJSON);

    return {
      challengeData,
      signature,
      operator: this.operatorAddress,
      timestamp
    };
  }

  /**
   * Validate structured attestation request
   * @param {Object} attestationRequest - Structured attestation request to validate
   */
  validateAttestationRequest(attestationRequest) {
    if (!attestationRequest || typeof attestationRequest !== 'object') {
      throw new Error('Attestation request must be a valid object');
    }

    // Required fields for structured requests
    const requiredFields = ['subject', 'attestationType', 'data', 'expiry'];

    for (const field of requiredFields) {
      if (attestationRequest[field] === undefined || attestationRequest[field] === null) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate subject format (should be bytes32)
    if (typeof attestationRequest.subject !== 'string' || !attestationRequest.subject.startsWith('0x') || attestationRequest.subject.length !== 66) {
      throw new Error('Subject must be a valid bytes32 hex string');
    }

    // Validate attestationType format (should be bytes32)
    if (typeof attestationRequest.attestationType !== 'string' || !attestationRequest.attestationType.startsWith('0x') || attestationRequest.attestationType.length !== 66) {
      throw new Error('AttestationType must be a valid bytes32 hex string');
    }

    // Validate data format (should be hex bytes)
    if (typeof attestationRequest.data !== 'string' || !attestationRequest.data.startsWith('0x')) {
      throw new Error('Data must be a valid hex string');
    }

    // Validate expiry timestamp
    const now = Math.floor(Date.now() / 1000);
    if (attestationRequest.expiry <= now) {
      throw new Error('Expiry must be in the future');
    }

    // Validate IPFS URI format if provided
    if (attestationRequest.ipfsUri && typeof attestationRequest.ipfsUri !== 'string') {
      throw new Error('IPFS URI must be a string');
    }
  }

  /**
   * Validate attestation structure (legacy JSON method)
   * @param {Object} attestation - Attestation to validate
   */
  validateAttestation(attestation) {
    if (!attestation || typeof attestation !== 'object') {
      throw new Error('Attestation must be a valid object');
    }

    // Required fields for all attestations
    const requiredFields = ['type', 'issuedAt', 'expiry', 'operator', 'policyVersion'];

    for (const field of requiredFields) {
      if (attestation[field] === undefined || attestation[field] === null) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Type-specific validations
    if (attestation.type === 'PCS') {
      if (!attestation.subject) {
        throw new Error('PCS attestations require a subject field');
      }
      if (typeof attestation.pcsValue !== 'number' || attestation.pcsValue < 0 || attestation.pcsValue > 1000) {
        throw new Error('PCS value must be a number between 0 and 1000');
      }
    } else if (attestation.type === 'PRS') {
      if (!attestation.poolId) {
        throw new Error('PRS attestations require a poolId field');
      }
      if (typeof attestation.prsValue !== 'number' || attestation.prsValue < 0 || attestation.prsValue > 100) {
        throw new Error('PRS value must be a number between 0 and 100');
      }
    } else {
      throw new Error(`Unsupported attestation type: ${attestation.type}`);
    }

    // Validate timestamps
    const now = Math.floor(Date.now() / 1000);
    if (attestation.issuedAt > now + 60) { // Allow 1 minute clock skew
      throw new Error('issuedAt timestamp cannot be in the future');
    }
    if (attestation.expiry <= attestation.issuedAt) {
      throw new Error('expiry must be after issuedAt');
    }

    // Validate operator address
    if (attestation.operator.toLowerCase() !== this.operatorAddress.toLowerCase()) {
      throw new Error('Operator address mismatch');
    }
  }

  /**
   * Create canonical JSON representation of attestation
   * @param {Object} attestation - Attestation object
   * @returns {string} Canonical JSON string
   */
  canonicalizeAttestation(attestation) {
    // Create a copy and sort keys for consistent representation
    const sortedAttestation = {};

    // Sort keys alphabetically for consistency
    const sortedKeys = Object.keys(attestation).sort();

    for (const key of sortedKeys) {
      sortedAttestation[key] = attestation[key];
    }

    // Return compact JSON (no spaces)
    return JSON.stringify(sortedAttestation);
  }

  /**
   * Create structured PCS attestation data
   * @param {Object} params - PCS parameters
   * @returns {Object} Structured PCS attestation data
   */
  createPCSAttestationData(params) {
    const {
      subject,
      score = 750,
      tier = 'GOOD',
      issuedAt = Math.floor(Date.now() / 1000),
      expiry = Math.floor(Date.now() / 1000) + 3600,
      policyVersion = 'v1.0'
    } = params;

    if (!subject) {
      throw new Error('Subject is required for PCS attestation');
    }

    return {
      subject: ethers.keccak256(ethers.toUtf8Bytes(subject)),
      score,
      tier,
      issuedAt,
      expiry,
      policyVersion,
      operator: this.operatorAddress
    };
  }

  /**
   * Create structured PRS attestation data
   * @param {Object} params - PRS parameters
   * @returns {Object} Structured PRS attestation data
   */
  createPRSAttestationData(params) {
    const {
      poolId,
      score = 35,
      band = 'MEDIUM',
      issuedAt = Math.floor(Date.now() / 1000),
      expiry = Math.floor(Date.now() / 1000) + 1800,
      policyVersion = 'v1.0'
    } = params;

    if (!poolId) {
      throw new Error('Pool ID is required for PRS attestation');
    }

    return {
      poolId: ethers.keccak256(ethers.toUtf8Bytes(poolId)),
      score,
      band,
      issuedAt,
      expiry,
      policyVersion,
      operator: this.operatorAddress
    };
  }

  /**
   * Create a test attestation for validation
   * @param {string} type - Attestation type ('PCS' or 'PRS')
   * @returns {Object} Test attestation
   */
  createTestAttestation(type = 'PCS') {
    const now = Math.floor(Date.now() / 1000);

    if (type === 'PCS') {
      return {
        subject: 'did:eth:0x' + '1'.repeat(40),
        type: 'PCS',
        pcsValue: 750,
        pcsTier: 'Platinum',
        policyVersion: 'v1',
        issuedAt: now,
        expiry: now + 3600,
        operator: this.operatorAddress
      };
    } else if (type === 'PRS') {
      return {
        poolId: 'univ4:0x' + '2'.repeat(40),
        type: 'PRS',
        prsValue: 35,
        prsBand: 'Normal',
        policyVersion: 'v1',
        issuedAt: now,
        expiry: now + 1200,
        operator: this.operatorAddress
      };
    } else {
      throw new Error(`Unsupported test attestation type: ${type}`);
    }
  }

  /**
   * Get signing statistics
   * @returns {Object} Operator signing statistics
   */
  getStats() {
    return {
      operatorAddress: this.operatorAddress,
      publicKey: this.wallet.publicKey,
      // In production, would track signing counts, success rates, etc.
      status: 'active'
    };
  }
}

module.exports = AttestationSigner;