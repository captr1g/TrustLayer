let ipfsClient;
try {
  ipfsClient = require('ipfs-http-client');
} catch (error) {
  console.warn('ipfs-http-client not available, using mock mode');
  ipfsClient = null;
}

const fs = require('fs').promises;
const path = require('path');

/**
 * IPFS Service for storing attestation metadata
 * Handles uploading attestation data, audit trails, and metadata to IPFS
 */
class IPFSService {
  constructor(ipfsConfig = {}) {
    this.config = {
      host: ipfsConfig.host || 'localhost',
      port: ipfsConfig.port || 5001,
      protocol: ipfsConfig.protocol || 'http',
      ...ipfsConfig
    };

    this.ipfs = null;
    this.isInitialized = false;
    this.mockMode = process.env.NODE_ENV === 'test' || !ipfsConfig.enabled || !ipfsClient;
  }

  /**
   * Initialize IPFS client
   */
  async initialize() {
    if (this.mockMode) {
      console.log('IPFS Service initialized in mock mode');
      this.isInitialized = true;
      return;
    }

    try {
      this.ipfs = ipfsClient.create(this.config);

      // Test connection
      const version = await this.ipfs.version();
      console.log(`IPFS Service initialized - Connected to IPFS version: ${version.version}`);

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize IPFS service:', error.message);
      console.log('Falling back to mock mode');
      this.mockMode = true;
      this.isInitialized = true;
    }
  }

  /**
   * Upload attestation metadata to IPFS
   * @param {Object} metadata - Attestation metadata
   * @returns {string} IPFS hash
   */
  async uploadAttestationMetadata(metadata) {
    if (!this.isInitialized) {
      throw new Error('IPFS service not initialized');
    }

    const metadataWithTimestamp = {
      ...metadata,
      uploadedAt: new Date().toISOString(),
      version: '1.0'
    };

    if (this.mockMode) {
      // Generate deterministic mock hash for testing
      const mockHash = this._generateMockHash(JSON.stringify(metadataWithTimestamp));
      console.log(`Mock IPFS upload: ${mockHash}`);
      return `ipfs://${mockHash}`;
    }

    try {
      const metadataBuffer = Buffer.from(JSON.stringify(metadataWithTimestamp, null, 2));
      const result = await this.ipfs.add(metadataBuffer, {
        pin: true,
        cidVersion: 1
      });

      const ipfsUri = `ipfs://${result.cid.toString()}`;
      console.log(`Uploaded attestation metadata to IPFS: ${ipfsUri}`);

      return ipfsUri;
    } catch (error) {
      console.error('Failed to upload to IPFS:', error);
      throw new Error(`IPFS upload failed: ${error.message}`);
    }
  }

  /**
   * Upload attestation proof bundle (includes computation details, audit trail)
   * @param {Object} proofBundle - Complete proof data
   * @returns {string} IPFS hash
   */
  async uploadProofBundle(proofBundle) {
    if (!this.isInitialized) {
      throw new Error('IPFS service not initialized');
    }

    const bundleWithMetadata = {
      ...proofBundle,
      bundleType: 'attestation-proof',
      uploadedAt: new Date().toISOString(),
      version: '1.0'
    };

    if (this.mockMode) {
      const mockHash = this._generateMockHash(JSON.stringify(bundleWithMetadata));
      return `ipfs://${mockHash}`;
    }

    try {
      const bundleBuffer = Buffer.from(JSON.stringify(bundleWithMetadata, null, 2));
      const result = await this.ipfs.add(bundleBuffer, {
        pin: true,
        cidVersion: 1
      });

      const ipfsUri = `ipfs://${result.cid.toString()}`;
      console.log(`Uploaded proof bundle to IPFS: ${ipfsUri}`);

      return ipfsUri;
    } catch (error) {
      console.error('Failed to upload proof bundle to IPFS:', error);
      throw new Error(`IPFS proof bundle upload failed: ${error.message}`);
    }
  }

  /**
   * Create comprehensive attestation metadata
   * @param {Object} params - Metadata parameters
   * @returns {Object} Structured metadata
   */
  createAttestationMetadata(params) {
    const {
      attestationType,
      subject,
      operator,
      computationDetails,
      policyVersion,
      auditTrail = [],
      additionalMetadata = {}
    } = params;

    return {
      attestationType,
      subject,
      operator,
      computationDetails: {
        algorithm: computationDetails.algorithm || 'CCR-v1.0',
        inputFeatures: computationDetails.inputFeatures || [],
        score: computationDetails.score,
        tier: computationDetails.tier || computationDetails.band,
        confidence: computationDetails.confidence || 0.95,
        processingTime: computationDetails.processingTime || Date.now(),
        ...computationDetails
      },
      policyVersion,
      auditTrail: [
        ...auditTrail,
        {
          action: 'attestation-created',
          timestamp: new Date().toISOString(),
          operator,
          details: 'Attestation computed and signed'
        }
      ],
      metadata: {
        schemaVersion: '1.0',
        networkInfo: {
          chainId: process.env.CHAIN_ID || 1,
          network: process.env.NETWORK || 'mainnet'
        },
        ...additionalMetadata
      }
    };
  }

  /**
   * Create proof bundle with computation verification data
   * @param {Object} params - Proof bundle parameters
   * @returns {Object} Proof bundle
   */
  createProofBundle(params) {
    const {
      attestation,
      signature,
      computationProof,
      inputData,
      operator,
      metadata = {}
    } = params;

    return {
      attestation,
      signature,
      proof: {
        computationProof: computationProof || {},
        inputDataHash: this._hashData(inputData),
        operator,
        timestamp: new Date().toISOString(),
        verificationMethod: 'ecdsa-signature'
      },
      auditTrail: [
        {
          action: 'computation-started',
          timestamp: new Date().toISOString(),
          operator
        },
        {
          action: 'attestation-signed',
          timestamp: new Date().toISOString(),
          operator,
          signatureMethod: 'ECDSA'
        }
      ],
      metadata: {
        bundleVersion: '1.0',
        ...metadata
      }
    };
  }

  /**
   * Retrieve metadata from IPFS
   * @param {string} ipfsUri - IPFS URI
   * @returns {Object} Retrieved metadata
   */
  async getMetadata(ipfsUri) {
    if (!this.isInitialized) {
      throw new Error('IPFS service not initialized');
    }

    const hash = ipfsUri.replace('ipfs://', '');

    if (this.mockMode) {
      // Return mock metadata for testing
      return {
        mockData: true,
        hash,
        retrievedAt: new Date().toISOString()
      };
    }

    try {
      const chunks = [];
      for await (const chunk of this.ipfs.cat(hash)) {
        chunks.push(chunk);
      }

      const data = Buffer.concat(chunks).toString();
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to retrieve from IPFS:', error);
      throw new Error(`IPFS retrieval failed: ${error.message}`);
    }
  }

  /**
   * Pin important attestation data to ensure availability
   * @param {string} hash - IPFS hash to pin
   */
  async pinData(hash) {
    if (this.mockMode) {
      console.log(`Mock pinning: ${hash}`);
      return;
    }

    try {
      await this.ipfs.pin.add(hash);
      console.log(`Pinned IPFS data: ${hash}`);
    } catch (error) {
      console.error('Failed to pin IPFS data:', error);
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      initialized: this.isInitialized,
      mockMode: this.mockMode,
      config: this.mockMode ? 'mock' : this.config
    };
  }

  /**
   * Generate deterministic mock hash for testing
   * @private
   */
  _generateMockHash(data) {
    // Simple hash function for testing
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    // Convert to hex and pad
    const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
    return `Qm${hexHash}${'x'.repeat(38)}`; // Mock CIDv1 format
  }

  /**
   * Hash input data for proof verification
   * @private
   */
  _hashData(data) {
    if (!data) return null;

    // In production, use a proper cryptographic hash
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return this._generateMockHash(dataString);
  }
}

module.exports = IPFSService;