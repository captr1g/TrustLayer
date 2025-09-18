/**
 * Mock AVS Server for Demo
 * Simulates the AVS worker endpoints without complex dependencies
 */

const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const https = require('https');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Mock operator details
const OPERATOR_ADDRESS = '0x742d35Cc6639C0532fEa96F9d2A5D0A4e42B2d7e';
const OPERATOR_PRIVATE_KEY = '0x' + '1'.repeat(64); // Mock private key

// Pinata configuration
const PINATA_API_KEY = '9f3b2055e6da1fb575af';
const PINATA_SECRET_API_KEY = '4ebdf1e3f1de06d931cd112b1352bf0ac5a91eb36b0edf7fa81024363a6903a3';
const PINATA_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI4ODIyMjhlOS0wYWM2LTQyODQtYmIzNy1iOTY1ZDQ2NzJlMjEiLCJlbWFpbCI6Inlhc2hyYWpAbWF4dHJvbi5haSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiI5ZjNiMjA1NWU2ZGExZmI1NzVhZiIsInNjb3BlZEtleVNlY3JldCI6IjRlYmRmMWUzZjFkZTA2ZDkzMWNkMTEyYjEzNTJiZjBhYzVhOTFlYjM2YjBlZGY3ZmE4MTAyNDM2M2E2OTAzYTMiLCJleHAiOjE3ODk2NTY5NTB9.Tnnh1KHXh61rfG_3duPL2OcBwEEm-3NlekprbgmIMo4';

// Utility functions
function generateMockSignature(data) {
  const hash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  return '0x' + hash.substring(0, 128); // Mock signature
}

// Real IPFS functions using Pinata API
async function uploadToIPFS(data, name = 'attestation-data') {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      pinataContent: data,
      pinataMetadata: {
        name: `${name}-${Date.now()}`,
        keyvalues: {
          type: 'attestation',
          operator: OPERATOR_ADDRESS
        }
      }
    });

    const options = {
      hostname: 'api.pinata.cloud',
      port: 443,
      path: '/pinning/pinJSONToIPFS',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PINATA_JWT}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          if (result.IpfsHash) {
            resolve({
              success: true,
              ipfsHash: result.IpfsHash,
              ipfsUri: `ipfs://${result.IpfsHash}`,
              gatewayUrl: `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`
            });
          } else {
            reject(new Error('No IPFS hash returned: ' + responseData));
          }
        } catch (error) {
          reject(new Error('Failed to parse response: ' + error.message + ', Response: ' + responseData));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(payload);
    req.end();
  });
}

async function getFromIPFS(ipfsHash) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'gateway.pinata.cloud',
      port: 443,
      path: `/ipfs/${ipfsHash}`,
      method: 'GET'
    };

    const req = https.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          resolve({
            success: true,
            data: result
          });
        } catch (error) {
          reject(new Error('Failed to parse IPFS data: ' + error.message));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

function computeMockPCS(features) {
  const {
    walletAge = 0,
    transactionCount = 0,
    successRate = 0,
    lpContribution = 0,
    liquidationCount = 0
  } = features;

  // Simple scoring algorithm
  const ageScore = Math.min(1000, walletAge * 1.2);
  const activityScore = Math.min(1000, Math.log10(transactionCount + 1) * 200 + successRate * 600);
  const liquidityScore = Math.min(1000, Math.log10(lpContribution + 1) * 300);
  const liquidationPenalty = Math.max(0, 1000 - liquidationCount * 200);

  const compositeScore = (
    (ageScore * 0.25) +
    (activityScore * 0.30) +
    (liquidityScore * 0.25) +
    (liquidationPenalty * 0.20)
  );

  const finalScore = Math.max(0, Math.min(1000, Math.round(compositeScore)));

  // Determine tier
  let tier = 'Bronze';
  if (finalScore >= 850) tier = 'Diamond';
  else if (finalScore >= 700) tier = 'Platinum';
  else if (finalScore >= 500) tier = 'Gold';
  else if (finalScore >= 300) tier = 'Silver';

  return {
    score: finalScore,
    tier: tier,
    breakdown: {
      ageScore: Math.round(ageScore),
      activityScore: Math.round(activityScore),
      liquidityScore: Math.round(liquidityScore),
      liquidationPenalty: Math.round(liquidationPenalty),
      weights: {
        age: 0.25,
        activity: 0.30,
        liquidity: 0.25,
        liquidation: 0.20
      },
      compositeScore: Math.round(compositeScore)
    }
  };
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    operator: OPERATOR_ADDRESS,
    fhe: { status: 'mock', initialized: true },
    ipfs: { status: 'mock', initialized: true }
  });
});

// FHE endpoints
app.get('/fhe/public-key', (req, res) => {
  res.json({
    success: true,
    publicKey: 'mock-public-key-' + Math.random().toString(36).substring(7),
    fheEnabled: true
  });
});

app.post('/fhe/encrypt', async (req, res) => {
  try {
    const { features, poolMetrics } = req.body;

    let result = {};

    if (features) {
      // Mock encryption: base64 encode the features with a salt
      const salt = Math.random().toString(36).substring(7);
      result.encryptedFeatures = Buffer.from(JSON.stringify(features) + ':' + salt).toString('base64');
    }

    if (poolMetrics) {
      const salt = Math.random().toString(36).substring(7);
      result.encryptedPoolMetrics = Buffer.from(JSON.stringify(poolMetrics) + ':' + salt).toString('base64');
    }

    res.json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error('Mock encryption error:', error);
    res.status(500).json({
      error: 'Mock encryption failed',
      details: error.message
    });
  }
});

// PCS computation endpoint
app.post('/compute/pcs-structured', async (req, res) => {
  try {
    const { encryptedFeatures, subject, includeMetadata = true } = req.body;

    if (!encryptedFeatures || !subject) {
      return res.status(400).json({
        error: 'Missing required fields: encryptedFeatures, subject'
      });
    }

    // Mock decryption: try to parse the features
    let features;
    try {
      if (typeof encryptedFeatures === 'string') {
        if (encryptedFeatures.startsWith('eyJ')) { // base64 encoded
          const decoded = Buffer.from(encryptedFeatures, 'base64').toString();
          features = JSON.parse(decoded.split(':')[0]); // Remove salt
        } else {
          features = JSON.parse(encryptedFeatures);
        }
      } else {
        features = encryptedFeatures;
      }
    } catch (error) {
      // Generate mock features if decryption fails
      features = {
        walletAge: Math.floor(Math.random() * 1000),
        transactionCount: Math.floor(Math.random() * 10000),
        successRate: 0.7 + Math.random() * 0.29,
        lpContribution: Math.random() * 1000,
        liquidationCount: Math.floor(Math.random() * 3)
      };
    }

    // Compute PCS
    const pcsResult = computeMockPCS(features);

    // Create mock attestation data
    const attestationData = {
      subject: subject,
      score: pcsResult.score,
      tier: pcsResult.tier,
      issuedAt: Math.floor(Date.now() / 1000),
      expiry: Math.floor(Date.now() / 1000) + 3600,
      policyVersion: 'v1.0',
      operator: OPERATOR_ADDRESS
    };

    // Upload to real IPFS if metadata is requested
    let ipfsUri = '';
    let metadataUri = '';
    let ipfsResult = null;

    if (includeMetadata) {
      try {
        // Upload attestation data to IPFS
        ipfsResult = await uploadToIPFS({
          ...attestationData,
          computation: pcsResult,
          features: features, // Include extracted features for transparency
          timestamp: new Date().toISOString()
        }, `pcs-attestation-${subject.slice(2, 8)}`);

        ipfsUri = ipfsResult.ipfsUri;
        metadataUri = ipfsResult.gatewayUrl;

        console.log(`✅ Uploaded PCS attestation to IPFS: ${ipfsResult.ipfsHash}`);
      } catch (error) {
        console.error('❌ Failed to upload to IPFS:', error.message);
        // Fallback to mock hash if IPFS fails
        const mockHash = crypto.createHash('sha256')
          .update(JSON.stringify(attestationData))
          .digest('hex')
          .substring(0, 46);
        ipfsUri = `ipfs://Qm${mockHash}`;
        metadataUri = `ipfs://Qm${mockHash}meta`;
      }
    }

    // Create structured attestation request
    const attestationRequest = {
      subject: Buffer.from(subject).toString('hex').padStart(64, '0'),
      attestationType: '0x' + Buffer.from('PCS').toString('hex').padStart(64, '0'),
      data: '0x' + Buffer.from(JSON.stringify(attestationData)).toString('hex'),
      expiry: attestationData.expiry,
      ipfsUri: ipfsUri
    };

    // Generate mock signature
    const signature = generateMockSignature(attestationRequest);

    res.json({
      success: true,
      request: attestationRequest,
      signature: signature,
      signer: OPERATOR_ADDRESS,
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
    console.error('Mock PCS computation error:', error);
    res.status(500).json({
      error: 'Internal server error during mock PCS computation',
      details: error.message
    });
  }
});

// PRS computation endpoint
app.post('/compute/prs-structured', async (req, res) => {
  try {
    const { poolId, poolMetrics } = req.body;

    if (!poolId || !poolMetrics) {
      return res.status(400).json({
        error: 'Missing required fields: poolId, poolMetrics'
      });
    }

    // Mock PRS computation
    const {
      volatility = 0.1,
      liquidityDepth = 1000000,
      concentration = 0.5,
      oracleDispersion = 0.02,
      volume24h = 100000,
      tvl = 5000000
    } = poolMetrics;

    // Simple PRS scoring (0-100)
    const volScore = Math.min(100, volatility * 200); // Higher volatility = higher risk
    const liqScore = Math.max(0, 50 - Math.log10(liquidityDepth)); // Lower liquidity = higher risk
    const concScore = Math.abs(concentration - 0.5) * 100; // Deviation from optimal concentration
    const oracleScore = oracleDispersion * 500; // Oracle dispersion risk

    const riskScore = Math.min(100, Math.max(0, Math.round(
      (volScore * 0.4) + (liqScore * 0.3) + (concScore * 0.2) + (oracleScore * 0.1)
    )));

    // Determine risk band
    let band = 'LOW';
    if (riskScore > 80) band = 'CRITICAL';
    else if (riskScore > 60) band = 'HIGH';
    else if (riskScore > 40) band = 'MEDIUM';

    const attestationData = {
      poolId: poolId,
      score: riskScore,
      band: band,
      issuedAt: Math.floor(Date.now() / 1000),
      expiry: Math.floor(Date.now() / 1000) + 1800,
      policyVersion: 'v1.0',
      operator: OPERATOR_ADDRESS
    };

    const attestationRequest = {
      subject: Buffer.from(poolId).toString('hex').padStart(64, '0'),
      attestationType: '0x' + Buffer.from('PRS').toString('hex').padStart(64, '0'),
      data: '0x' + Buffer.from(JSON.stringify(attestationData)).toString('hex'),
      expiry: attestationData.expiry,
      ipfsUri: ''
    };

    const signature = generateMockSignature(attestationRequest);

    res.json({
      success: true,
      request: attestationRequest,
      signature: signature,
      signer: OPERATOR_ADDRESS,
      computation: {
        score: riskScore,
        band: band,
        breakdown: {
          volScore: Math.round(volScore),
          liqScore: Math.round(liqScore),
          concScore: Math.round(concScore),
          oracleScore: Math.round(oracleScore)
        }
      }
    });

  } catch (error) {
    console.error('Mock PRS computation error:', error);
    res.status(500).json({
      error: 'Internal server error during mock PRS computation',
      details: error.message
    });
  }
});

// IPFS endpoints
app.get('/ipfs/status', async (req, res) => {
  try {
    // Test connection to Pinata
    const testData = { test: 'connection', timestamp: Date.now() };
    const testUpload = await uploadToIPFS(testData, 'connection-test');

    res.json({
      success: true,
      status: {
        isInitialized: true,
        provider: 'Pinata',
        version: 'pinata-api-v1',
        lastTestHash: testUpload.ipfsHash,
        gatewayUrl: 'https://gateway.pinata.cloud'
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      status: {
        isInitialized: false,
        provider: 'Pinata',
        error: error.message
      }
    });
  }
});

app.get('/ipfs/metadata/:hash', async (req, res) => {
  try {
    const { hash } = req.params;

    // Try to retrieve real data from IPFS
    try {
      const ipfsData = await getFromIPFS(hash);
      res.json({
        success: true,
        metadata: ipfsData.data,
        retrievedAt: new Date().toISOString(),
        source: 'ipfs-pinata',
        hash: hash
      });
    } catch (ipfsError) {
      console.log(`⚠️  Failed to retrieve from IPFS: ${ipfsError.message}, using mock data`);

      // Fallback to mock metadata if IPFS retrieval fails
      const mockMetadata = {
        attestationType: 'PCS',
        subject: 'did:eth:0x' + '1'.repeat(40),
        operator: OPERATOR_ADDRESS,
        computationDetails: {
          algorithm: 'PCS-v1.0',
          score: 750,
          tier: 'Gold',
          processingTime: Date.now()
        },
        policyVersion: 'v1.0',
        createdAt: new Date().toISOString()
      };

      res.json({
        success: true,
        metadata: mockMetadata,
        retrievedAt: new Date().toISOString(),
        source: 'mock-fallback',
        hash: hash
      });
    }

  } catch (error) {
    console.error('IPFS metadata retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve metadata from IPFS',
      details: error.message
    });
  }
});

// Start server
const server = app.listen(PORT, () => {
  console.log('🚀 Mock AVS Worker running on port', PORT);
  console.log('📍 Operator address:', OPERATOR_ADDRESS);
  console.log('🔧 Environment: Mock/Demo');
  console.log('');
  console.log('Available endpoints:');
  console.log('  GET  /health - Health check');
  console.log('  GET  /fhe/public-key - Get FHE public key');
  console.log('  POST /fhe/encrypt - Encrypt features');
  console.log('  POST /compute/pcs-structured - Compute PCS');
  console.log('  POST /compute/prs-structured - Compute PRS');
  console.log('  GET  /ipfs/status - IPFS status');
  console.log('  GET  /ipfs/metadata/:hash - Get IPFS metadata');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Mock AVS server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Mock AVS server closed');
    process.exit(0);
  });
});

module.exports = app;