const IPFSService = require('../src/services/IPFSService');

describe('IPFS Service Integration Tests', () => {
  let ipfsService;

  beforeEach(() => {
    // Initialize in mock mode for testing
    ipfsService = new IPFSService({ enabled: false });
  });

  test('should initialize IPFS service in mock mode', async () => {
    await ipfsService.initialize();

    expect(ipfsService.isInitialized).toBe(true);
    expect(ipfsService.mockMode).toBe(true);

    const status = ipfsService.getStatus();
    expect(status.initialized).toBe(true);
    expect(status.mockMode).toBe(true);
  });

  test('should create attestation metadata', () => {
    const metadata = ipfsService.createAttestationMetadata({
      attestationType: 'PCS',
      subject: 'test_user',
      operator: '0x1234567890abcdef1234567890abcdef12345678',
      computationDetails: {
        algorithm: 'PCS-v1.0',
        score: 750,
        tier: 'GOOD',
        breakdown: { credit: 800, history: 700 }
      },
      policyVersion: 'v1.0'
    });

    expect(metadata.attestationType).toBe('PCS');
    expect(metadata.subject).toBe('test_user');
    expect(metadata.computationDetails.score).toBe(750);
    expect(metadata.auditTrail).toHaveLength(1);
    expect(metadata.auditTrail[0].action).toBe('attestation-created');
    expect(metadata.metadata.schemaVersion).toBe('1.0');
  });

  test('should create proof bundle', () => {
    const attestation = {
      subject: 'test_user',
      score: 750,
      tier: 'GOOD'
    };

    const proofBundle = ipfsService.createProofBundle({
      attestation,
      signature: '0xsignature',
      computationProof: {
        algorithm: 'PCS-v1.0',
        inputHash: 'hash123'
      },
      inputData: { walletAge: 365, transactionCount: 100 },
      operator: '0x1234567890abcdef1234567890abcdef12345678'
    });

    expect(proofBundle.attestation).toEqual(attestation);
    expect(proofBundle.signature).toBe('0xsignature');
    expect(proofBundle.proof.operator).toBe('0x1234567890abcdef1234567890abcdef12345678');
    expect(proofBundle.auditTrail).toHaveLength(2);
    expect(proofBundle.metadata.bundleVersion).toBe('1.0');
  });

  test('should upload attestation metadata in mock mode', async () => {
    await ipfsService.initialize();

    const metadata = {
      attestationType: 'PCS',
      score: 750,
      tier: 'GOOD'
    };

    const ipfsUri = await ipfsService.uploadAttestationMetadata(metadata);

    expect(ipfsUri).toMatch(/^ipfs:\/\/Qm/);
    expect(ipfsUri.length).toBeGreaterThan(20); // Valid IPFS URI
  });

  test('should upload proof bundle in mock mode', async () => {
    await ipfsService.initialize();

    const proofBundle = {
      attestation: { score: 750 },
      signature: '0xsignature',
      proof: { algorithm: 'test' }
    };

    const ipfsUri = await ipfsService.uploadProofBundle(proofBundle);

    expect(ipfsUri).toMatch(/^ipfs:\/\/Qm/);
    expect(ipfsUri.length).toBeGreaterThan(20); // Valid IPFS URI
  });

  test('should retrieve metadata in mock mode', async () => {
    await ipfsService.initialize();

    const testUri = 'ipfs://QmTest1234567890abcdef1234567890abcdef123456';
    const metadata = await ipfsService.getMetadata(testUri);

    expect(metadata.mockData).toBe(true);
    expect(metadata.hash).toBe('QmTest1234567890abcdef1234567890abcdef123456');
    expect(metadata.retrievedAt).toBeDefined();
  });

  test('should pin data in mock mode', async () => {
    await ipfsService.initialize();

    // Should not throw in mock mode
    await expect(ipfsService.pinData('QmTest1234567890abcdef1234567890abcdef123456'))
      .resolves.toBeUndefined();
  });

  test('should generate consistent mock hashes', () => {
    const data1 = 'test data';
    const data2 = 'test data';
    const data3 = 'different data';

    const hash1 = ipfsService._generateMockHash(data1);
    const hash2 = ipfsService._generateMockHash(data2);
    const hash3 = ipfsService._generateMockHash(data3);

    expect(hash1).toBe(hash2); // Same data should produce same hash
    expect(hash1).not.toBe(hash3); // Different data should produce different hash
    expect(hash1).toMatch(/^Qm/);
    expect(hash1.length).toBeGreaterThan(10); // Valid hash
  });

  test('should hash input data consistently', () => {
    const data1 = { user: 'test', score: 750 };
    const data2 = { user: 'test', score: 750 };
    const data3 = { user: 'test', score: 800 };

    const hash1 = ipfsService._hashData(data1);
    const hash2 = ipfsService._hashData(data2);
    const hash3 = ipfsService._hashData(data3);

    expect(hash1).toBe(hash2); // Same data should produce same hash
    expect(hash1).not.toBe(hash3); // Different data should produce different hash
  });

  test('should handle null data in hash function', () => {
    const hash = ipfsService._hashData(null);
    expect(hash).toBeNull();
  });

  test('should create comprehensive metadata with audit trail', () => {
    const metadata = ipfsService.createAttestationMetadata({
      attestationType: 'PRS',
      subject: 'USDC/ETH-500',
      operator: '0x1234567890abcdef1234567890abcdef12345678',
      computationDetails: {
        algorithm: 'PRS-v1.0',
        score: 35,
        band: 'MEDIUM',
        breakdown: { volatility: 0.15, liquidity: 1000000 }
      },
      policyVersion: 'v1.0',
      auditTrail: [
        {
          action: 'data-received',
          timestamp: '2024-01-01T00:00:00Z',
          operator: '0x1234567890abcdef1234567890abcdef12345678'
        }
      ],
      additionalMetadata: {
        poolInfo: {
          token0: 'USDC',
          token1: 'ETH',
          fee: 500
        }
      }
    });

    expect(metadata.attestationType).toBe('PRS');
    expect(metadata.auditTrail).toHaveLength(2); // Original + created
    expect(metadata.auditTrail[0].action).toBe('data-received');
    expect(metadata.auditTrail[1].action).toBe('attestation-created');
    expect(metadata.metadata.poolInfo.token0).toBe('USDC');
  });
});