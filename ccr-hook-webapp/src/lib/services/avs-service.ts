/**
 * AVS (Actively Validated Service) Backend Integration
 * Connects to the AVS worker server for PCS/PRS computation and attestation signing
 */

interface PCSFeatures {
  walletAge: number;
  transactionCount: number;
  successRate: number;
  lpContribution: number;
  liquidationCount: number;
  avgTransactionValue?: number;
  uniqueInteractions?: number;
  riskScore?: number;
}

interface PoolMetrics {
  volatility: number;
  liquidityDepth: number;
  concentration: number;
  oracleDispersion: number;
  volume24h: number;
  tvl: number;
}

interface PCSResult {
  score: number;
  tier: string;
  breakdown: {
    ageScore: number;
    activityScore: number;
    liquidityScore: number;
    liquidationPenalty: number;
    weights: {
      age: number;
      activity: number;
      liquidity: number;
      liquidation: number;
    };
    compositeScore: number;
  };
}

interface AttestationResponse {
  success: boolean;
  request?: any;
  signature?: string;
  signer?: string;
  computation?: PCSResult;
  metadata?: {
    ipfsUri: string;
    metadataUri: string;
    includesProofBundle: boolean;
  };
  error?: string;
}

class AVSService {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string = 'http://localhost:3001', apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  /**
   * Get AVS service health status
   */
  async getHealthStatus(): Promise<{
    status: string;
    timestamp: string;
    operator: string;
    fhe: any;
    ipfs: any;
  }> {
    const response = await this.makeRequest('/health');
    return response;
  }

  /**
   * Get FHE public key for client-side encryption
   */
  async getFHEPublicKey(): Promise<{
    success: boolean;
    publicKey: string;
    fheEnabled: boolean;
  }> {
    const response = await this.makeRequest('/fhe/public-key');
    return response;
  }

  /**
   * Encrypt features using FHE
   */
  async encryptFeatures(features: PCSFeatures): Promise<{
    success: boolean;
    encryptedFeatures: string;
  }> {
    const response = await this.makeRequest('/fhe/encrypt', 'POST', { features });
    return response;
  }

  /**
   * Compute PCS with encrypted features
   */
  async computePCS(
    encryptedFeatures: string | PCSFeatures,
    subject: string
  ): Promise<AttestationResponse> {
    // If features are not encrypted, encrypt them first
    let encrypted = encryptedFeatures;
    if (typeof encryptedFeatures === 'object') {
      try {
        const encryptResult = await this.encryptFeatures(encryptedFeatures);
        encrypted = encryptResult.encryptedFeatures;
      } catch (error) {
        console.warn('FHE encryption failed, using plain features:', error);
        encrypted = JSON.stringify(encryptedFeatures);
      }
    }

    const response = await this.makeRequest('/compute/pcs', 'POST', {
      encryptedFeatures: encrypted,
      subject,
      includeMetadata: true
    });

    return response;
  }

  /**
   * Compute PRS (Pool Risk Score)
   */
  async computePRS(
    poolId: string,
    poolMetrics: PoolMetrics
  ): Promise<AttestationResponse> {
    const response = await this.makeRequest('/compute/prs-structured', 'POST', {
      poolId,
      poolMetrics
    });

    return response;
  }

  /**
   * Batch computation for multiple requests
   */
  async computeBatch(requests: Array<{
    type: 'PCS' | 'PRS';
    encryptedFeatures?: string;
    subject?: string;
    poolId?: string;
    poolMetrics?: PoolMetrics;
  }>): Promise<{
    success: boolean;
    results: AttestationResponse[];
  }> {
    const response = await this.makeRequest('/compute/batch', 'POST', { requests });
    return response;
  }

  /**
   * Get IPFS metadata
   */
  async getIPFSMetadata(hash: string): Promise<{
    success: boolean;
    metadata: any;
    retrievedAt: string;
  }> {
    const cleanHash = hash.replace('ipfs://', '');
    const response = await this.makeRequest(`/ipfs/metadata/${cleanHash}`);
    return response;
  }

  /**
   * Upload data to IPFS
   */
  async uploadToIPFS(data: any, type: 'metadata' | 'proof' | 'generic' = 'generic'): Promise<{
    success: boolean;
    ipfsUri: string;
    type: string;
    uploadedAt: string;
  }> {
    const response = await this.makeRequest('/ipfs/upload', 'POST', { data, type });
    return response;
  }

  /**
   * Pin IPFS data
   */
  async pinIPFS(hash: string): Promise<{
    success: boolean;
    hash: string;
    pinnedAt: string;
  }> {
    const cleanHash = hash.replace('ipfs://', '');
    const response = await this.makeRequest(`/ipfs/pin/${cleanHash}`, 'POST');
    return response;
  }

  /**
   * Extract user features from wallet data
   */
  extractFeaturesFromWalletData(walletData: {
    address: string;
    balance: bigint;
    transactionHistory?: any[];
    lpPositions?: any[];
    riskMetrics?: any;
  }): PCSFeatures {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    // Calculate wallet age (mock - would need actual first transaction data)
    const walletAge = Math.floor(Math.random() * 1000); // 0-1000 days

    // Extract transaction count
    const transactionCount = walletData.transactionHistory?.length || 0;

    // Calculate success rate (mock - would need actual success/failure data)
    const successRate = Math.max(0.7, Math.random()); // 70-100% for demo

    // Calculate LP contribution from balance
    const balanceInEth = Number(walletData.balance) / 1e18;
    const lpContribution = balanceInEth * (0.1 + Math.random() * 0.3); // 10-40% of balance in LP

    // Mock liquidation count based on risk profile
    const liquidationCount = balanceInEth < 1 ? Math.floor(Math.random() * 2) : 0;

    return {
      walletAge,
      transactionCount,
      successRate,
      lpContribution,
      liquidationCount,
      avgTransactionValue: balanceInEth > 0 ? balanceInEth / Math.max(1, transactionCount) * 10 : 0,
      uniqueInteractions: Math.floor(Math.random() * 50) + transactionCount / 10,
      riskScore: Math.floor((1 - successRate) * 100 + liquidationCount * 20)
    };
  }

  /**
   * Extract pool metrics from pool data
   */
  extractPoolMetrics(poolData: {
    tvl: number;
    volume24h: number;
    token0: string;
    token1: string;
    fee: number;
    tickSpacing?: number;
  }): PoolMetrics {
    // Calculate volatility based on volume/TVL ratio
    const volatility = Math.min(1, poolData.volume24h / Math.max(poolData.tvl, 1) * 0.1);

    // Liquidity depth is proportional to TVL
    const liquidityDepth = poolData.tvl;

    // Mock concentration (would be calculated from tick distribution)
    const concentration = Math.random() * 0.8 + 0.1; // 10-90%

    // Oracle dispersion (mock - would be calculated from price feeds)
    const oracleDispersion = Math.random() * 0.05; // 0-5%

    return {
      volatility,
      liquidityDepth,
      concentration,
      oracleDispersion,
      volume24h: poolData.volume24h,
      tvl: poolData.tvl
    };
  }

  /**
   * Make HTTP request to AVS backend
   */
  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    data?: any
  ): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    const options: RequestInit = {
      method,
      headers,
    };

    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`AVS API error: ${response.status} ${response.statusText} - ${errorData.error || 'Unknown error'}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`AVS request failed [${method} ${url}]:`, error);
      throw error;
    }
  }

  /**
   * Create a subject identifier from user address
   */
  static createSubject(address: string): string {
    return `did:eth:${address.toLowerCase()}`;
  }

  /**
   * Create a pool identifier from pool parameters
   */
  static createPoolId(token0: string, token1: string, fee: number): string {
    return `uniswap-v4:${token0.toLowerCase()}-${token1.toLowerCase()}:${fee}`;
  }

  /**
   * Check if the AVS service is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await this.getHealthStatus();
      return true;
    } catch (error) {
      console.warn('AVS service unavailable:', error);
      return false;
    }
  }
}

// Export singleton instance
export const avsService = new AVSService(
  process.env.NEXT_PUBLIC_AVS_URL || 'http://localhost:3001'
);

export default AVSService;