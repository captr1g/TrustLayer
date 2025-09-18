const AttestationSigner = require('../src/services/AttestationSigner');
const { ethers } = require('ethers');

describe('AttestationSigner', () => {
  let signer;
  const testPrivateKey = '0x' + '1'.repeat(64);

  beforeEach(() => {
    signer = new AttestationSigner(testPrivateKey);
  });

  describe('Structured Attestations', () => {
    test('should create PCS attestation data correctly', () => {
      const params = {
        subject: 'user123',
        score: 750,
        tier: 'GOOD'
      };

      const pcsData = signer.createPCSAttestationData(params);

      expect(pcsData.subject).toBe(ethers.keccak256(ethers.toUtf8Bytes('user123')));
      expect(pcsData.score).toBe(750);
      expect(pcsData.tier).toBe('GOOD');
      expect(pcsData.operator).toBe(signer.getOperatorAddress());
      expect(pcsData.policyVersion).toBe('v1.0');
    });

    test('should create PRS attestation data correctly', () => {
      const params = {
        poolId: 'USDC/ETH-500',
        score: 35,
        band: 'MEDIUM'
      };

      const prsData = signer.createPRSAttestationData(params);

      expect(prsData.poolId).toBe(ethers.keccak256(ethers.toUtf8Bytes('USDC/ETH-500')));
      expect(prsData.score).toBe(35);
      expect(prsData.band).toBe('MEDIUM');
      expect(prsData.operator).toBe(signer.getOperatorAddress());
      expect(prsData.policyVersion).toBe('v1.0');
    });

    test('should sign structured attestation request', async () => {
      const attestationRequest = {
        subject: ethers.keccak256(ethers.toUtf8Bytes('user123')),
        attestationType: ethers.keccak256(ethers.toUtf8Bytes('PCS')),
        data: '0x1234567890abcdef',
        expiry: Math.floor(Date.now() / 1000) + 3600,
        ipfsUri: 'ipfs://QmTest'
      };

      const result = await signer.signStructuredAttestation(attestationRequest);

      expect(result.request).toEqual(attestationRequest);
      expect(result.signature).toBeDefined();
      expect(result.signer).toBe(signer.getOperatorAddress());
      expect(typeof result.signature).toBe('string');
      expect(result.signature.startsWith('0x')).toBe(true);
    });

    test('should validate structured attestation request', () => {
      const validRequest = {
        subject: '0x' + '1'.repeat(64),
        attestationType: '0x' + '2'.repeat(64),
        data: '0x1234567890abcdef',
        expiry: Math.floor(Date.now() / 1000) + 3600,
        ipfsUri: 'ipfs://test'
      };

      expect(() => signer.validateAttestationRequest(validRequest)).not.toThrow();

      // Test invalid subject format
      const invalidSubject = { ...validRequest, subject: 'invalid' };
      expect(() => signer.validateAttestationRequest(invalidSubject)).toThrow('Subject must be a valid bytes32 hex string');

      // Test missing field
      const missingField = { ...validRequest };
      delete missingField.subject;
      expect(() => signer.validateAttestationRequest(missingField)).toThrow('Missing required field: subject');

      // Test expired timestamp
      const expired = { ...validRequest, expiry: Math.floor(Date.now() / 1000) - 3600 };
      expect(() => signer.validateAttestationRequest(expired)).toThrow('Expiry must be in the future');
    });
  });

  describe('Legacy Attestations', () => {
    test('should create test PCS attestation', () => {
      const attestation = signer.createTestAttestation('PCS');

      expect(attestation.type).toBe('PCS');
      expect(attestation.pcsValue).toBe(750);
      expect(attestation.operator).toBe(signer.getOperatorAddress());
    });

    test('should create test PRS attestation', () => {
      const attestation = signer.createTestAttestation('PRS');

      expect(attestation.type).toBe('PRS');
      expect(attestation.prsValue).toBe(35);
      expect(attestation.operator).toBe(signer.getOperatorAddress());
    });

    test('should sign legacy attestation', async () => {
      const attestation = signer.createTestAttestation('PCS');
      const result = await signer.signAttestation(attestation);

      expect(result.attestation).toBeDefined();
      expect(result.signature).toBeDefined();
      expect(result.signer).toBe(signer.getOperatorAddress());
    });
  });

  describe('Validation', () => {
    test('should validate legacy PCS attestation', () => {
      const validAttestation = {
        subject: 'test-subject',
        type: 'PCS',
        pcsValue: 750,
        policyVersion: 'v1',
        issuedAt: Math.floor(Date.now() / 1000),
        expiry: Math.floor(Date.now() / 1000) + 3600,
        operator: signer.getOperatorAddress()
      };

      expect(() => signer.validateAttestation(validAttestation)).not.toThrow();

      // Test invalid score
      const invalidScore = { ...validAttestation, pcsValue: 1500 };
      expect(() => signer.validateAttestation(invalidScore)).toThrow('PCS value must be a number between 0 and 1000');
    });

    test('should validate legacy PRS attestation', () => {
      const validAttestation = {
        poolId: 'test-pool',
        type: 'PRS',
        prsValue: 35,
        policyVersion: 'v1',
        issuedAt: Math.floor(Date.now() / 1000),
        expiry: Math.floor(Date.now() / 1000) + 3600,
        operator: signer.getOperatorAddress()
      };

      expect(() => signer.validateAttestation(validAttestation)).not.toThrow();

      // Test invalid score
      const invalidScore = { ...validAttestation, prsValue: 150 };
      expect(() => signer.validateAttestation(invalidScore)).toThrow('PRS value must be a number between 0 and 100');
    });
  });
});