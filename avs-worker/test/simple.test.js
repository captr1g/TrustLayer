const AttestationSigner = require('../src/services/AttestationSigner');

describe('Simple AVS Worker Tests', () => {
  test('AttestationSigner should initialize correctly', () => {
    const testPrivateKey = '0x' + '1'.repeat(64);
    const signer = new AttestationSigner(testPrivateKey);

    expect(signer.getOperatorAddress()).toBeDefined();
    expect(signer.getOperatorPublicKey()).toBeDefined();
  });

  test('Should create structured PCS attestation data', () => {
    const testPrivateKey = '0x' + '1'.repeat(64);
    const signer = new AttestationSigner(testPrivateKey);

    const pcsData = signer.createPCSAttestationData({
      subject: 'test_user',
      score: 750,
      tier: 'GOOD'
    });

    expect(pcsData.score).toBe(750);
    expect(pcsData.tier).toBe('GOOD');
    expect(pcsData.operator).toBe(signer.getOperatorAddress());
  });

  test('Should create structured PRS attestation data', () => {
    const testPrivateKey = '0x' + '1'.repeat(64);
    const signer = new AttestationSigner(testPrivateKey);

    const prsData = signer.createPRSAttestationData({
      poolId: 'USDC/ETH-500',
      score: 35,
      band: 'MEDIUM'
    });

    expect(prsData.score).toBe(35);
    expect(prsData.band).toBe('MEDIUM');
    expect(prsData.operator).toBe(signer.getOperatorAddress());
  });

  test('Should validate structured attestation requests', () => {
    const testPrivateKey = '0x' + '1'.repeat(64);
    const signer = new AttestationSigner(testPrivateKey);

    const validRequest = {
      subject: '0x' + '1'.repeat(64),
      attestationType: '0x' + '2'.repeat(64),
      data: '0x1234567890abcdef',
      expiry: Math.floor(Date.now() / 1000) + 3600,
      ipfsUri: 'ipfs://test'
    };

    expect(() => signer.validateAttestationRequest(validRequest)).not.toThrow();

    // Test invalid request
    const invalidRequest = { ...validRequest, subject: 'invalid' };
    expect(() => signer.validateAttestationRequest(invalidRequest))
      .toThrow('Subject must be a valid bytes32 hex string');
  });
});