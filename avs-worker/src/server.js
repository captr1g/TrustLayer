const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const PCSComputer = require('./services/PCSComputer');
const PRSComputer = require('./services/PRSComputer');
const AttestationSigner = require('./services/AttestationSigner');
const FHEService = require('./services/FHEService');
const IPFSService = require('./services/IPFSService');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/compute', limiter);

// Initialize services
const pcsComputer = new PCSComputer();
const prsComputer = new PRSComputer();
const attestationSigner = new AttestationSigner(process.env.OPERATOR_PRIVATE_KEY);
const fheService = new FHEService();
const ipfsService = new IPFSService({
  enabled: process.env.IPFS_ENABLED === 'true',
  host: process.env.IPFS_HOST || 'localhost',
  port: process.env.IPFS_PORT || 5001,
  protocol: process.env.IPFS_PROTOCOL || 'http'
});

// Initialize services
Promise.all([
  fheService.initialize().catch(error => {
    console.error('Failed to initialize FHE service:', error);
    console.log('Continuing without FHE - using mock encryption');
  }),
  ipfsService.initialize().catch(error => {
    console.error('Failed to initialize IPFS service:', error);
    console.log('Continuing without IPFS - using mock mode');
  })
]).then(() => {
  console.log('All services initialized');
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    operator: attestationSigner.getOperatorAddress(),
    fhe: fheService.getStatus(),
    ipfs: ipfsService.getStatus()
  });
});

// FHE endpoints
app.get('/fhe/public-key', (req, res) => {
  try {
    const publicKey = fheService.getPublicKey();
    res.json({
      success: true,
      publicKey: publicKey,
      fheEnabled: fheService.isInitialized
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get FHE public key',
      details: error.message
    });
  }
});

app.post('/fhe/encrypt', async (req, res) => {
  try {
    const { features, poolMetrics } = req.body;

    let result = {};

    if (features) {
      result.encryptedFeatures = await fheService.encryptFeatures(features);
    }

    if (poolMetrics) {
      result.encryptedPoolMetrics = await fheService.encryptPoolMetrics(poolMetrics);
    }

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('FHE encryption error:', error);
    res.status(500).json({
      error: 'FHE encryption failed',
      details: error.message
    });
  }
});

app.post('/fhe/verify', async (req, res) => {
  try {
    const { originalData, encryptedData, computationResult } = req.body;

    const verification = await fheService.verifyComputation(
      originalData,
      encryptedData,
      computationResult
    );

    res.json({
      success: true,
      verification
    });

  } catch (error) {
    console.error('FHE verification error:', error);
    res.status(500).json({
      error: 'FHE verification failed',
      details: error.message
    });
  }
});

// PCS computation endpoint
app.post('/compute/pcs', async (req, res) => {
  try {
    const { encryptedFeatures, subject } = req.body;

    if (!encryptedFeatures || !subject) {
      return res.status(400).json({
        error: 'Missing required fields: encryptedFeatures, subject'
      });
    }

    // Decrypt features using FHE service
    const features = await fheService.decryptFeatures(encryptedFeatures);

    // Compute PCS
    const pcsResult = await pcsComputer.computePCS(features);

    // Create attestation
    const attestation = {
      subject: subject,
      type: 'PCS',
      pcsValue: pcsResult.score,
      pcsTier: pcsResult.tier,
      policyVersion: 'v1',
      issuedAt: Math.floor(Date.now() / 1000),
      expiry: Math.floor(Date.now() / 1000) + 3600, // 1 hour expiry
      operator: attestationSigner.getOperatorAddress()
    };

    // Sign attestation
    const signedAttestation = await attestationSigner.signAttestation(attestation);

    res.json({
      success: true,
      attestation: signedAttestation.attestation,
      signature: signedAttestation.signature,
      computation: {
        score: pcsResult.score,
        tier: pcsResult.tier,
        breakdown: pcsResult.breakdown
      }
    });

  } catch (error) {
    console.error('PCS computation error:', error);
    res.status(500).json({
      error: 'Internal server error during PCS computation',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Structured PCS computation endpoint
app.post('/compute/pcs-structured', async (req, res) => {
  try {
    const { encryptedFeatures, subject, includeMetadata = true } = req.body;

    if (!encryptedFeatures || !subject) {
      return res.status(400).json({
        error: 'Missing required fields: encryptedFeatures, subject'
      });
    }

    // Decrypt features using FHE service
    const features = await fheService.decryptFeatures(encryptedFeatures);

    // Compute PCS
    const pcsResult = await pcsComputer.computePCS(features);

    // Create structured PCS attestation data
    const pcsData = attestationSigner.createPCSAttestationData({
      subject: subject,
      score: pcsResult.score,
      tier: pcsResult.tier,
      expiry: Math.floor(Date.now() / 1000) + 3600
    });

    let ipfsUri = "";
    let metadataUri = "";

    // Upload metadata to IPFS if requested
    if (includeMetadata) {
      try {
        // Create attestation metadata
        const metadata = ipfsService.createAttestationMetadata({
          attestationType: 'PCS',
          subject: subject,
          operator: attestationSigner.getOperatorAddress(),
          computationDetails: {
            algorithm: 'PCS-v1.0',
            inputFeatures: Object.keys(features),
            score: pcsResult.score,
            tier: pcsResult.tier,
            breakdown: pcsResult.breakdown,
            processingTime: Date.now()
          },
          policyVersion: 'v1.0'
        });

        metadataUri = await ipfsService.uploadAttestationMetadata(metadata);

        // Create proof bundle
        const proofBundle = ipfsService.createProofBundle({
          attestation: pcsData,
          computationProof: {
            inputHash: ipfsService._hashData(features),
            algorithm: 'PCS-v1.0',
            score: pcsResult.score,
            breakdown: pcsResult.breakdown
          },
          inputData: features,
          operator: attestationSigner.getOperatorAddress()
        });

        ipfsUri = await ipfsService.uploadProofBundle(proofBundle);

      } catch (ipfsError) {
        console.warn('IPFS upload failed, continuing without metadata:', ipfsError.message);
      }
    }

    // Create structured attestation request
    const attestationRequest = {
      subject: pcsData.subject,
      attestationType: '0x' + Buffer.from('PCS').toString('hex').padStart(64, '0'), // PCS_TYPE equivalent
      data: JSON.stringify(pcsData), // This would be ABI-encoded in production
      expiry: pcsData.expiry,
      ipfsUri: ipfsUri
    };

    // Sign structured attestation
    const signedAttestation = await attestationSigner.signStructuredAttestation(attestationRequest);

    res.json({
      success: true,
      request: signedAttestation.request,
      signature: signedAttestation.signature,
      signer: signedAttestation.signer,
      computation: {
        score: pcsResult.score,
        tier: pcsResult.tier,
        breakdown: pcsResult.breakdown
      },
      metadata: {
        ipfsUri: ipfsUri,
        metadataUri: metadataUri,
        includesProofBundle: !!ipfsUri
      }
    });

  } catch (error) {
    console.error('Structured PCS computation error:', error);
    res.status(500).json({
      error: 'Internal server error during structured PCS computation',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PRS computation endpoint
app.post('/compute/prs', async (req, res) => {
  try {
    const { poolId, poolMetrics } = req.body;

    if (!poolId || !poolMetrics) {
      return res.status(400).json({
        error: 'Missing required fields: poolId, poolMetrics'
      });
    }

    // Compute PRS
    const prsResult = await prsComputer.computePRS(poolMetrics);

    // Create attestation
    const attestation = {
      poolId: poolId,
      type: 'PRS',
      prsValue: prsResult.score,
      prsBand: prsResult.band,
      policyVersion: 'v1',
      issuedAt: Math.floor(Date.now() / 1000),
      expiry: Math.floor(Date.now() / 1000) + 1200, // 20 minutes expiry for pool data
      operator: attestationSigner.getOperatorAddress()
    };

    // Sign attestation
    const signedAttestation = await attestationSigner.signAttestation(attestation);

    res.json({
      success: true,
      attestation: signedAttestation.attestation,
      signature: signedAttestation.signature,
      computation: {
        score: prsResult.score,
        band: prsResult.band,
        breakdown: prsResult.breakdown
      }
    });

  } catch (error) {
    console.error('PRS computation error:', error);
    res.status(500).json({
      error: 'Internal server error during PRS computation',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Structured PRS computation endpoint
app.post('/compute/prs-structured', async (req, res) => {
  try {
    const { poolId, poolMetrics } = req.body;

    if (!poolId || !poolMetrics) {
      return res.status(400).json({
        error: 'Missing required fields: poolId, poolMetrics'
      });
    }

    // Compute PRS
    const prsResult = await prsComputer.computePRS(poolMetrics);

    // Create structured PRS attestation data
    const prsData = attestationSigner.createPRSAttestationData({
      poolId: poolId,
      score: prsResult.score,
      band: prsResult.band,
      expiry: Math.floor(Date.now() / 1000) + 1800 // 30 minutes
    });

    // Create structured attestation request
    const attestationRequest = {
      subject: prsData.poolId,
      attestationType: '0x' + Buffer.from('PRS').toString('hex').padStart(64, '0'), // PRS_TYPE equivalent
      data: JSON.stringify(prsData), // This would be ABI-encoded in production
      expiry: prsData.expiry,
      ipfsUri: ""
    };

    // Sign structured attestation
    const signedAttestation = await attestationSigner.signStructuredAttestation(attestationRequest);

    res.json({
      success: true,
      request: signedAttestation.request,
      signature: signedAttestation.signature,
      signer: signedAttestation.signer,
      computation: {
        score: prsResult.score,
        band: prsResult.band,
        breakdown: prsResult.breakdown
      }
    });

  } catch (error) {
    console.error('Structured PRS computation error:', error);
    res.status(500).json({
      error: 'Internal server error during structured PRS computation',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Batch computation endpoint
app.post('/compute/batch', async (req, res) => {
  try {
    const { requests } = req.body;

    if (!Array.isArray(requests) || requests.length === 0) {
      return res.status(400).json({
        error: 'Missing or invalid requests array'
      });
    }

    if (requests.length > 10) {
      return res.status(400).json({
        error: 'Maximum 10 requests per batch'
      });
    }

    const results = [];

    for (const request of requests) {
      try {
        if (request.type === 'PCS') {
          const features = await decryptFeatures(request.encryptedFeatures);
          const pcsResult = await pcsComputer.computePCS(features);

          const attestation = {
            subject: request.subject,
            type: 'PCS',
            pcsValue: pcsResult.score,
            pcsTier: pcsResult.tier,
            policyVersion: 'v1',
            issuedAt: Math.floor(Date.now() / 1000),
            expiry: Math.floor(Date.now() / 1000) + 3600,
            operator: attestationSigner.getOperatorAddress()
          };

          const signedAttestation = await attestationSigner.signAttestation(attestation);
          results.push({
            success: true,
            type: 'PCS',
            attestation: signedAttestation.attestation,
            signature: signedAttestation.signature
          });

        } else if (request.type === 'PRS') {
          const prsResult = await prsComputer.computePRS(request.poolMetrics);

          const attestation = {
            poolId: request.poolId,
            type: 'PRS',
            prsValue: prsResult.score,
            prsBand: prsResult.band,
            policyVersion: 'v1',
            issuedAt: Math.floor(Date.now() / 1000),
            expiry: Math.floor(Date.now() / 1000) + 1200,
            operator: attestationSigner.getOperatorAddress()
          };

          const signedAttestation = await attestationSigner.signAttestation(attestation);
          results.push({
            success: true,
            type: 'PRS',
            attestation: signedAttestation.attestation,
            signature: signedAttestation.signature
          });

        } else {
          results.push({
            success: false,
            error: 'Invalid request type'
          });
        }
      } catch (error) {
        results.push({
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('Batch computation error:', error);
    res.status(500).json({
      error: 'Internal server error during batch computation'
    });
  }
});

// IPFS endpoints
app.get('/ipfs/status', (req, res) => {
  res.json({
    success: true,
    status: ipfsService.getStatus()
  });
});

app.get('/ipfs/metadata/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    const ipfsUri = hash.startsWith('ipfs://') ? hash : `ipfs://${hash}`;

    const metadata = await ipfsService.getMetadata(ipfsUri);

    res.json({
      success: true,
      metadata,
      retrievedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('IPFS metadata retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve metadata from IPFS',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.post('/ipfs/upload', async (req, res) => {
  try {
    const { data, type = 'generic' } = req.body;

    if (!data) {
      return res.status(400).json({
        error: 'Missing required field: data'
      });
    }

    let ipfsUri;

    if (type === 'metadata') {
      ipfsUri = await ipfsService.uploadAttestationMetadata(data);
    } else if (type === 'proof') {
      ipfsUri = await ipfsService.uploadProofBundle(data);
    } else {
      // Generic upload
      const metadata = {
        data,
        type,
        uploadedAt: new Date().toISOString()
      };
      ipfsUri = await ipfsService.uploadAttestationMetadata(metadata);
    }

    res.json({
      success: true,
      ipfsUri,
      type,
      uploadedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('IPFS upload error:', error);
    res.status(500).json({
      error: 'Failed to upload to IPFS',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.post('/ipfs/pin/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    const cleanHash = hash.replace('ipfs://', '');

    await ipfsService.pinData(cleanHash);

    res.json({
      success: true,
      hash: cleanHash,
      pinnedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('IPFS pin error:', error);
    res.status(500).json({
      error: 'Failed to pin IPFS data',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Mock decrypt function for MVP
async function decryptFeatures(encryptedFeatures) {
  // In production, this would use FHE decryption
  // For MVP, assume features are provided in plain text or mock encrypted format
  if (typeof encryptedFeatures === 'string') {
    try {
      return JSON.parse(encryptedFeatures);
    } catch {
      // If not JSON, assume it's a mock encrypted string
      return {
        walletAge: Math.floor(Math.random() * 1000),
        transactionCount: Math.floor(Math.random() * 10000),
        successRate: Math.random(),
        lpContribution: Math.random() * 1000,
        liquidationCount: Math.floor(Math.random() * 5)
      };
    }
  }

  return encryptedFeatures;
}

// Start server
const server = app.listen(PORT, () => {
  console.log(`AVS Worker running on port ${PORT}`);
  console.log(`Operator address: ${attestationSigner.getOperatorAddress()}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;