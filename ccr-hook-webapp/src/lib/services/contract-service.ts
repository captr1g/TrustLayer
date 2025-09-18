/**
 * Smart Contract Integration Service
 * Interfaces with AttestationRegistry and CCRHook contracts
 */

import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  parseEther,
  formatEther,
  encodeFunctionData,
  decodeFunctionResult,
  Address,
  Hash,
  PublicClient,
  WalletClient
} from 'viem';
import { mainnet, sepolia, hardhat } from 'viem/chains';

// Contract ABIs (simplified for key functions)
const ATTESTATION_REGISTRY_ABI = [
  {
    name: 'publishStructuredAttestation',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'request', type: 'tuple', components: [
        { name: 'subject', type: 'bytes32' },
        { name: 'attestationType', type: 'bytes32' },
        { name: 'data', type: 'bytes' },
        { name: 'expiry', type: 'uint256' },
        { name: 'ipfsUri', type: 'string' }
      ]},
      { name: 'signature', type: 'bytes' }
    ],
    outputs: []
  },
  {
    name: 'getLatestAttestation',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'subject', type: 'bytes32' },
      { name: 'attestationType', type: 'bytes32' }
    ],
    outputs: [
      { name: 'attestation', type: 'tuple', components: [
        { name: 'attestationHash', type: 'bytes32' },
        { name: 'operator', type: 'address' },
        { name: 'issuedAt', type: 'uint256' },
        { name: 'expiry', type: 'uint256' },
        { name: 'ipfsUri', type: 'string' },
        { name: 'revoked', type: 'bool' }
      ]}
    ]
  },
  {
    name: 'isAttestationValid',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'subject', type: 'bytes32' },
      { name: 'attestationType', type: 'bytes32' }
    ],
    outputs: [{ name: 'valid', type: 'bool' }]
  },
  {
    name: 'addOperator',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'operator', type: 'address' }],
    outputs: []
  },
  {
    name: 'isOperator',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'operator', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }]
  }
] as const;

const CCR_HOOK_ABI = [
  {
    name: 'hasValidCreditAttestation',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'getUserCreditScore',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'hasValidRiskAttestation',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'key', type: 'tuple', components: [
      { name: 'currency0', type: 'address' },
      { name: 'currency1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'hooks', type: 'address' }
    ]}],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'getPoolRiskScore',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'key', type: 'tuple', components: [
      { name: 'currency0', type: 'address' },
      { name: 'currency1', type: 'address' },
      { name: 'fee', type: 'uint24' },
      { name: 'tickSpacing', type: 'int24' },
      { name: 'hooks', type: 'address' }
    ]}],
    outputs: [{ name: '', type: 'uint256' }]
  }
] as const;

interface AttestationRequest {
  subject: `0x${string}`;
  attestationType: `0x${string}`;
  data: `0x${string}`;
  expiry: bigint;
  ipfsUri: string;
}

interface Attestation {
  attestationHash: `0x${string}`;
  operator: Address;
  issuedAt: bigint;
  expiry: bigint;
  ipfsUri: string;
  revoked: boolean;
}

interface PoolKey {
  currency0: Address;
  currency1: Address;
  fee: number;
  tickSpacing: number;
  hooks: Address;
}

class ContractService {
  private publicClient: PublicClient;
  private walletClient?: WalletClient;

  // Contract addresses (would be loaded from environment or config)
  private attestationRegistryAddress: Address;
  private ccrHookAddress: Address;

  // Constants for attestation types
  public static readonly PCS_TYPE = '0x' + Buffer.from('PCS').toString('hex').padStart(64, '0') as `0x${string}`;
  public static readonly PRS_TYPE = '0x' + Buffer.from('PRS').toString('hex').padStart(64, '0') as `0x${string}`;

  constructor(
    chainId: number = 11155111, // Default to Sepolia
    attestationRegistryAddress?: Address,
    ccrHookAddress?: Address
  ) {
    // Get chain configuration
    const chain = chainId === 1 ? mainnet : chainId === 31337 ? hardhat : sepolia;

    // Create public client for reading
    this.publicClient = createPublicClient({
      chain,
      transport: http()
    });

    // Set contract addresses (defaults for testing)
    this.attestationRegistryAddress = attestationRegistryAddress ||
      (process.env.NEXT_PUBLIC_ATTESTATION_REGISTRY_ADDRESS as Address) ||
      '0x' + '1'.repeat(40) as Address; // Mock address

    this.ccrHookAddress = ccrHookAddress ||
      (process.env.NEXT_PUBLIC_CCR_HOOK_ADDRESS as Address) ||
      '0x' + '2'.repeat(40) as Address; // Mock address
  }

  /**
   * Initialize wallet client for transactions
   */
  async initializeWallet(): Promise<void> {
    if (typeof window !== 'undefined' && window.ethereum) {
      this.walletClient = createWalletClient({
        chain: this.publicClient.chain,
        transport: custom(window.ethereum)
      });
    }
  }

  /**
   * Publish an attestation to the registry
   */
  async publishAttestation(
    request: AttestationRequest,
    signature: `0x${string}`
  ): Promise<Hash> {
    if (!this.walletClient) {
      throw new Error('Wallet not connected');
    }

    const [account] = await this.walletClient.getAddresses();

    const hash = await this.walletClient.writeContract({
      address: this.attestationRegistryAddress,
      abi: ATTESTATION_REGISTRY_ABI,
      functionName: 'publishStructuredAttestation',
      args: [request, signature],
      account
    });

    return hash;
  }

  /**
   * Get the latest attestation for a subject
   */
  async getLatestAttestation(
    subject: `0x${string}`,
    attestationType: `0x${string}`
  ): Promise<Attestation | null> {
    try {
      const result = await this.publicClient.readContract({
        address: this.attestationRegistryAddress,
        abi: ATTESTATION_REGISTRY_ABI,
        functionName: 'getLatestAttestation',
        args: [subject, attestationType]
      });

      return result as Attestation;
    } catch (error) {
      console.warn('No attestation found:', error);
      return null;
    }
  }

  /**
   * Check if an attestation is valid
   */
  async isAttestationValid(
    subject: `0x${string}`,
    attestationType: `0x${string}`
  ): Promise<boolean> {
    try {
      const result = await this.publicClient.readContract({
        address: this.attestationRegistryAddress,
        abi: ATTESTATION_REGISTRY_ABI,
        functionName: 'isAttestationValid',
        args: [subject, attestationType]
      });

      return result as boolean;
    } catch (error) {
      console.warn('Error checking attestation validity:', error);
      return false;
    }
  }

  /**
   * Check if user has valid credit attestation
   */
  async hasValidCreditAttestation(userAddress: Address): Promise<boolean> {
    try {
      const result = await this.publicClient.readContract({
        address: this.ccrHookAddress,
        abi: CCR_HOOK_ABI,
        functionName: 'hasValidCreditAttestation',
        args: [userAddress]
      });

      return result as boolean;
    } catch (error) {
      console.warn('Error checking credit attestation:', error);
      return false;
    }
  }

  /**
   * Get user's credit score
   */
  async getUserCreditScore(userAddress: Address): Promise<number> {
    try {
      const result = await this.publicClient.readContract({
        address: this.ccrHookAddress,
        abi: CCR_HOOK_ABI,
        functionName: 'getUserCreditScore',
        args: [userAddress]
      });

      return Number(result as bigint);
    } catch (error) {
      console.warn('Error getting user credit score:', error);
      return 0;
    }
  }

  /**
   * Check if pool has valid risk attestation
   */
  async hasValidRiskAttestation(poolKey: PoolKey): Promise<boolean> {
    try {
      const result = await this.publicClient.readContract({
        address: this.ccrHookAddress,
        abi: CCR_HOOK_ABI,
        functionName: 'hasValidRiskAttestation',
        args: [poolKey]
      });

      return result as boolean;
    } catch (error) {
      console.warn('Error checking risk attestation:', error);
      return false;
    }
  }

  /**
   * Get pool's risk score
   */
  async getPoolRiskScore(poolKey: PoolKey): Promise<number> {
    try {
      const result = await this.publicClient.readContract({
        address: this.ccrHookAddress,
        abi: CCR_HOOK_ABI,
        functionName: 'getPoolRiskScore',
        args: [poolKey]
      });

      return Number(result as bigint);
    } catch (error) {
      console.warn('Error getting pool risk score:', error);
      return 0;
    }
  }

  /**
   * Check if address is an authorized operator
   */
  async isOperator(operatorAddress: Address): Promise<boolean> {
    try {
      const result = await this.publicClient.readContract({
        address: this.attestationRegistryAddress,
        abi: ATTESTATION_REGISTRY_ABI,
        functionName: 'isOperator',
        args: [operatorAddress]
      });

      return result as boolean;
    } catch (error) {
      console.warn('Error checking operator status:', error);
      return false;
    }
  }

  /**
   * Create a subject hash from user address
   */
  static createSubjectHash(address: Address): `0x${string}` {
    // This should match the contract's keccak256(abi.encodePacked(user))
    const encoded = address.toLowerCase().replace('0x', '');
    return `0x${encoded.padStart(64, '0')}` as `0x${string}`;
  }

  /**
   * Create a pool subject hash from pool key
   */
  static createPoolSubjectHash(poolKey: PoolKey): `0x${string}` {
    // This should match the contract's keccak256(abi.encode(key))
    // For now, creating a simplified hash
    const data = `${poolKey.currency0}${poolKey.currency1}${poolKey.fee}${poolKey.tickSpacing}${poolKey.hooks}`;
    const hash = data.toLowerCase().replace(/0x/g, '');
    return `0x${hash.slice(0, 64).padStart(64, '0')}` as `0x${string}`;
  }

  /**
   * Encode attestation data for contract calls
   */
  static encodeAttestationData(data: any): `0x${string}` {
    // In production, this would use proper ABI encoding
    // For MVP, using JSON string encoding
    const jsonString = JSON.stringify(data);
    return `0x${Buffer.from(jsonString).toString('hex')}` as `0x${string}`;
  }

  /**
   * Get contract addresses
   */
  getContractAddresses() {
    return {
      attestationRegistry: this.attestationRegistryAddress,
      ccrHook: this.ccrHookAddress
    };
  }

  /**
   * Get chain information
   */
  getChainInfo() {
    return {
      id: this.publicClient.chain?.id,
      name: this.publicClient.chain?.name,
      nativeCurrency: this.publicClient.chain?.nativeCurrency
    };
  }

  /**
   * Switch to different chain
   */
  async switchChain(chainId: number) {
    const chain = chainId === 1 ? mainnet : chainId === 31337 ? hardhat : sepolia;

    this.publicClient = createPublicClient({
      chain,
      transport: http()
    });

    if (this.walletClient) {
      this.walletClient = createWalletClient({
        chain,
        transport: custom(window.ethereum!)
      });
    }
  }

  /**
   * Check if contracts are deployed and accessible
   */
  async verifyContractDeployment(): Promise<{
    attestationRegistry: boolean;
    ccrHook: boolean;
  }> {
    try {
      // Try to read from attestation registry
      const registryValid = await this.publicClient.readContract({
        address: this.attestationRegistryAddress,
        abi: ATTESTATION_REGISTRY_ABI,
        functionName: 'isOperator',
        args: ['0x0000000000000000000000000000000000000000' as Address]
      }).then(() => true).catch(() => false);

      // Try to read from CCR hook
      const hookValid = await this.publicClient.readContract({
        address: this.ccrHookAddress,
        abi: CCR_HOOK_ABI,
        functionName: 'hasValidCreditAttestation',
        args: ['0x0000000000000000000000000000000000000000' as Address]
      }).then(() => true).catch(() => false);

      return {
        attestationRegistry: registryValid,
        ccrHook: hookValid
      };
    } catch (error) {
      return {
        attestationRegistry: false,
        ccrHook: false
      };
    }
  }
}

// Export singleton instances for different networks
export const contractService = new ContractService(); // Default sepolia

export const getContractService = (chainId: number) => {
  return new ContractService(chainId);
};

export default ContractService;