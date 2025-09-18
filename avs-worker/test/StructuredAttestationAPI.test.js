const request = require('supertest');
const app = require('../src/server');
const AttestationSigner = require('../src/services/AttestationSigner');
const { ethers } = require('ethers');

describe('Structured Attestation API Integration Tests', () => {
  const testPrivateKey = '0x' + '1'.repeat(64);
  let signer;

  beforeAll(() => {
    // Set up test environment
    process.env.OPERATOR_PRIVATE_KEY = testPrivateKey;
    signer = new AttestationSigner(testPrivateKey);
  });

  describe('PCS Structured Endpoint', () => {
    test('should compute and return structured PCS attestation', async () => {
      const requestData = {
        encryptedFeatures: JSON.stringify({
          walletAge: 800,
          transactionCount: 15000,
          successRate: 0.95,
          lpContribution: 2500,
          liquidationCount: 1
        }),
        subject: 'user_0x1234567890abcdef1234567890abcdef12345678'
      };

      const response = await request(app)
        .post('/compute/pcs-structured')
        .send(requestData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.request).toBeDefined();
      expect(response.body.signature).toBeDefined();
      expect(response.body.signer).toBe(signer.getOperatorAddress());
      expect(response.body.computation).toBeDefined();

      // Verify request structure
      const attestationRequest = response.body.request;
      expect(attestationRequest.subject).toBeDefined();
      expect(attestationRequest.attestationType).toBeDefined();
      expect(attestationRequest.data).toBeDefined();
      expect(attestationRequest.expiry).toBeGreaterThan(Math.floor(Date.now() / 1000));
      expect(attestationRequest.ipfsUri).toBe('');

      // Verify computation results
      expect(response.body.computation.score).toBeGreaterThan(0);
      expect(response.body.computation.score).toBeLessThanOrEqual(1000);
      expect(['POOR', 'FAIR', 'GOOD', 'EXCELLENT']).toContain(response.body.computation.tier);
    });

    test('should reject request with missing fields', async () => {
      const response = await request(app)
        .post('/compute/pcs-structured')
        .send({ encryptedFeatures: '{}' }) // Missing subject
        .expect(400);

      expect(response.body.error).toBe('Missing required fields: encryptedFeatures, subject');
    });

    test('should handle high-score user (EXCELLENT tier)', async () => {
      const requestData = {
        encryptedFeatures: JSON.stringify({
          walletAge: 1200,
          transactionCount: 50000,
          successRate: 0.98,
          lpContribution: 10000,
          liquidationCount: 0
        }),
        subject: 'excellent_user_0x1234567890abcdef1234567890abcdef12345678'
      };

      const response = await request(app)
        .post('/compute/pcs-structured')
        .send(requestData)
        .expect(200);

      expect(response.body.computation.score).toBeGreaterThan(800);
      expect(response.body.computation.tier).toBe('EXCELLENT');
    });

    test('should handle low-score user (POOR tier)', async () => {
      const requestData = {
        encryptedFeatures: JSON.stringify({
          walletAge: 30,
          transactionCount: 50,
          successRate: 0.60,
          lpContribution: 10,
          liquidationCount: 8
        }),
        subject: 'poor_user_0x1234567890abcdef1234567890abcdef12345678'
      };

      const response = await request(app)
        .post('/compute/pcs-structured')
        .send(requestData)
        .expect(200);

      expect(response.body.computation.score).toBeLessThan(400);
      expect(response.body.computation.tier).toBe('POOR');
    });
  });

  describe('PRS Structured Endpoint', () => {
    test('should compute and return structured PRS attestation', async () => {
      const requestData = {
        poolId: 'USDC/ETH-500-0x1234567890abcdef1234567890abcdef12345678',
        poolMetrics: {
          liquidity: 1000000,
          volume24h: 500000,
          feeTier: 500,
          volatility: 0.15,
          concentrationRatio: 0.3,
          impermanentLoss: 0.02
        }
      };

      const response = await request(app)
        .post('/compute/prs-structured')
        .send(requestData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.request).toBeDefined();
      expect(response.body.signature).toBeDefined();
      expect(response.body.signer).toBe(signer.getOperatorAddress());
      expect(response.body.computation).toBeDefined();

      // Verify request structure
      const attestationRequest = response.body.request;
      expect(attestationRequest.subject).toBeDefined();
      expect(attestationRequest.attestationType).toBeDefined();
      expect(attestationRequest.data).toBeDefined();
      expect(attestationRequest.expiry).toBeGreaterThan(Math.floor(Date.now() / 1000));

      // Verify computation results
      expect(response.body.computation.score).toBeGreaterThanOrEqual(0);
      expect(response.body.computation.score).toBeLessThanOrEqual(100);
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(response.body.computation.band);
    });

    test('should handle low-risk pool (LOW band)', async () => {
      const requestData = {
        poolId: 'USDC/USDT-100-0x1234567890abcdef1234567890abcdef12345678',
        poolMetrics: {
          liquidity: 10000000,
          volume24h: 1000000,
          feeTier: 100,
          volatility: 0.01,
          concentrationRatio: 0.1,
          impermanentLoss: 0.001
        }
      };

      const response = await request(app)
        .post('/compute/prs-structured')
        .send(requestData)
        .expect(200);

      expect(response.body.computation.score).toBeLessThanOrEqual(20);
      expect(response.body.computation.band).toBe('LOW');
    });

    test('should handle high-risk pool (CRITICAL band)', async () => {
      const requestData = {
        poolId: 'MEME/ETH-10000-0x1234567890abcdef1234567890abcdef12345678',
        poolMetrics: {
          liquidity: 50000,
          volume24h: 10000,
          feeTier: 10000,
          volatility: 0.8,
          concentrationRatio: 0.9,
          impermanentLoss: 0.5
        }
      };

      const response = await request(app)
        .post('/compute/prs-structured')
        .send(requestData)
        .expect(200);

      expect(response.body.computation.score).toBeGreaterThan(80);
      expect(response.body.computation.band).toBe('CRITICAL');
    });

    test('should reject request with missing pool metrics', async () => {
      const response = await request(app)
        .post('/compute/prs-structured')
        .send({ poolId: 'test-pool' }) // Missing poolMetrics
        .expect(400);

      expect(response.body.error).toBe('Missing required fields: poolId, poolMetrics');
    });
  });

  describe('Signature Validation', () => {
    test('should generate valid ECDSA signatures', async () => {
      const requestData = {
        encryptedFeatures: JSON.stringify({
          walletAge: 600,
          transactionCount: 5000,
          successRate: 0.85,
          lpContribution: 1000,
          liquidationCount: 2
        }),
        subject: 'signature_test_user'
      };

      const response = await request(app)
        .post('/compute/pcs-structured')
        .send(requestData)
        .expect(200);

      const { request: attestationRequest, signature } = response.body;

      // Verify signature format
      expect(signature).toMatch(/^0x[0-9a-fA-F]{130}$/); // 65 bytes = 130 hex chars

      // Verify signature can be recovered to operator address
      const requestHash = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(
        ['tuple(bytes32,bytes32,bytes,uint256,string)'],
        [Object.values(attestationRequest)]
      ));
      const messageHash = ethers.hashMessage(ethers.getBytes(requestHash));
      const recoveredAddress = ethers.recoverAddress(messageHash, signature);

      expect(recoveredAddress.toLowerCase()).toBe(signer.getOperatorAddress().toLowerCase());
    });

    test('should generate different signatures for different requests', async () => {
      const baseRequest = {
        encryptedFeatures: JSON.stringify({
          walletAge: 600,
          transactionCount: 5000,
          successRate: 0.85,
          lpContribution: 1000,
          liquidationCount: 2
        }),
        subject: 'test_user_1'
      };

      const modifiedRequest = {
        ...baseRequest,
        subject: 'test_user_2' // Different subject
      };

      const [response1, response2] = await Promise.all([
        request(app).post('/compute/pcs-structured').send(baseRequest),
        request(app).post('/compute/pcs-structured').send(modifiedRequest)
      ]);

      expect(response1.body.signature).not.toBe(response2.body.signature);
      expect(response1.body.request.subject).not.toBe(response2.body.request.subject);
    });
  });

  describe('FHE Integration', () => {
    test('should handle encrypted features', async () => {
      // Test with mock encrypted data
      const mockEncryptedFeatures = "encrypted_data_placeholder";

      const requestData = {
        encryptedFeatures: mockEncryptedFeatures,
        subject: 'fhe_test_user'
      };

      const response = await request(app)
        .post('/compute/pcs-structured')
        .send(requestData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.computation).toBeDefined();
    });

    test('should get FHE public key', async () => {
      const response = await request(app)
        .get('/fhe/public-key')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.publicKey).toBeDefined();
      expect(typeof response.body.fheEnabled).toBe('boolean');
    });
  });

  describe('Health Check', () => {
    test('should return health status with operator info', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.timestamp).toBeDefined();
      expect(response.body.operator).toBe(signer.getOperatorAddress());
      expect(response.body.fhe).toBeDefined();
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits on compute endpoints', async () => {
      const requestData = {
        encryptedFeatures: '{"test": true}',
        subject: 'rate_limit_test'
      };

      // Make many requests quickly (should trigger rate limiting)
      const promises = [];
      for (let i = 0; i < 150; i++) { // Exceed the 100 requests per 15 minutes limit
        promises.push(
          request(app)
            .post('/compute/pcs-structured')
            .send({ ...requestData, subject: `rate_limit_test_${i}` })
        );
      }

      const responses = await Promise.all(promises);

      // Some requests should be rate limited (429 status)
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      if (rateLimitedResponses.length > 0) {
        expect(rateLimitedResponses[0].body.message).toContain('Too many requests');
      }
    }, 30000); // Increase timeout for this test
  });

  describe('Legacy vs Structured Comparison', () => {
    test('should produce consistent results between legacy and structured endpoints', async () => {
      const testFeatures = {
        walletAge: 600,
        transactionCount: 5000,
        successRate: 0.85,
        lpContribution: 1000,
        liquidationCount: 2
      };

      const requestData = {
        encryptedFeatures: JSON.stringify(testFeatures),
        subject: 'comparison_test_user'
      };

      const [legacyResponse, structuredResponse] = await Promise.all([
        request(app).post('/compute/pcs').send(requestData),
        request(app).post('/compute/pcs-structured').send(requestData)
      ]);

      expect(legacyResponse.status).toBe(200);
      expect(structuredResponse.status).toBe(200);

      // Both should produce similar computation results
      expect(legacyResponse.body.computation.score).toBeCloseTo(
        structuredResponse.body.computation.score,
        0 // Allow small differences due to timing
      );
      expect(legacyResponse.body.computation.tier).toBe(
        structuredResponse.body.computation.tier
      );
    });
  });
});