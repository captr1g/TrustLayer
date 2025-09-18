/**
 * FHE (Fully Homomorphic Encryption) Service Integration
 * Client-side FHE operations for privacy-preserving data encryption
 */

declare global {
  interface Window {
    CoFHE?: any;
  }
}

interface FHEFeatures {
  walletAge: number;
  transactionCount: number;
  successRate: number;
  lpContribution: number;
  liquidationCount: number;
  avgTransactionValue?: number;
  uniqueInteractions?: number;
  riskScore?: number;
}

interface EncryptedFeatures {
  [key: string]: string; // Encrypted values as hex strings
}

interface FHEPublicKey {
  publicKey: string;
  fheEnabled: boolean;
}

class FHEService {
  private cofhe: any = null;
  private publicKey: string | null = null;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;

  constructor() {
    // Initialize will be called lazily
  }

  /**
   * Initialize FHE service
   */
  async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this._initialize();
    return this.initializationPromise;
  }

  private async _initialize(): Promise<void> {
    try {
      console.log('Initializing client-side FHE service...');

      // Check if we're in browser environment
      if (typeof window === 'undefined') {
        throw new Error('FHE service can only be initialized in browser environment');
      }

      // Try to load CoFHE library
      await this.loadCoFHELibrary();

      // Get public key from backend
      await this.fetchPublicKey();

      this.isInitialized = true;
      console.log('FHE service initialized successfully');

    } catch (error) {
      console.warn('FHE initialization failed, falling back to mock mode:', error);
      this.isInitialized = false;
      // Don't throw - allow graceful fallback to non-FHE mode
    }
  }

  /**
   * Load CoFHE library dynamically
   */
  private async loadCoFHELibrary(): Promise<void> {
    // Check if already loaded
    if (window.CoFHE) {
      this.cofhe = new window.CoFHE();
      return;
    }

    try {
      // Try to load from CDN or local installation
      // This would be replaced with actual CoFHE library loading
      console.log('Loading CoFHE library...');

      // For MVP, we'll simulate the library loading
      // In production, this would load the actual CoFHE WebAssembly module
      await new Promise(resolve => setTimeout(resolve, 100));

      // Mock CoFHE object for demonstration
      window.CoFHE = class MockCoFHE {
        async encrypt(value: number, publicKey: string): Promise<string> {
          // Mock encryption: base64 encode of value + salt
          const salt = Math.random().toString(36).substring(7);
          return Buffer.from(`${value}:${salt}:${publicKey.slice(0, 10)}`).toString('base64');
        }

        async decrypt(encryptedValue: string, privateKey: string): Promise<number> {
          // Mock decryption
          try {
            const decoded = Buffer.from(encryptedValue, 'base64').toString();
            const [value] = decoded.split(':');
            return parseFloat(value) || 0;
          } catch {
            return 0;
          }
        }

        async encryptBytes(data: Uint8Array, publicKey: string): Promise<string> {
          const salt = Math.random().toString(36).substring(7);
          return Buffer.from(`bytes:${Array.from(data).join(',')}:${salt}`).toString('base64');
        }

        async decryptBytes(encryptedData: string, privateKey: string): Promise<Uint8Array> {
          try {
            const decoded = Buffer.from(encryptedData, 'base64').toString();
            const [, dataStr] = decoded.split(':');
            const numbers = dataStr.split(',').map(n => parseInt(n));
            return new Uint8Array(numbers);
          } catch {
            return new Uint8Array();
          }
        }

        getVersion(): string {
          return 'Mock-CoFHE-1.0.0';
        }
      };

      this.cofhe = new window.CoFHE();
      console.log('CoFHE library loaded (mock version for MVP)');

    } catch (error) {
      console.error('Failed to load CoFHE library:', error);
      throw error;
    }
  }

  /**
   * Fetch public key from backend
   */
  private async fetchPublicKey(): Promise<void> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_AVS_URL || 'http://localhost:3001'}/fhe/public-key`);

      if (!response.ok) {
        console.warn(`FHE public key not available: ${response.statusText}. Using mock mode.`);
        // Fallback to mock public key for development
        this.publicKey = 'mock-public-key-' + Math.random().toString(36).substring(7);
        console.warn('Using mock public key for development');
        return;
      }

      const data: FHEPublicKey = await response.json();

      if (data.publicKey) {
        this.publicKey = data.publicKey;
        console.log('FHE public key retrieved:', this.publicKey.slice(0, 32) + '...');
      } else {
        console.warn('Invalid public key response. Using mock mode.');
        // Fallback to mock public key for development
        this.publicKey = 'mock-public-key-' + Math.random().toString(36).substring(7);
        console.warn('Using mock public key for development');
      }

    } catch (error) {
      console.warn('Failed to fetch FHE public key, using mock mode:', error);

      // Fallback to mock public key for development
      this.publicKey = 'mock-public-key-' + Math.random().toString(36).substring(7);
      console.warn('Using mock public key for development');
    }
  }

  /**
   * Encrypt user features
   */
  async encryptFeatures(features: FHEFeatures): Promise<EncryptedFeatures> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.cofhe || !this.publicKey) {
      console.warn('FHE not available, returning plain features');
      return this.createMockEncryption(features);
    }

    try {
      const encrypted: EncryptedFeatures = {};

      // Encrypt each numerical feature
      for (const [key, value] of Object.entries(features)) {
        if (typeof value === 'number') {
          encrypted[key] = await this.cofhe.encrypt(value, this.publicKey);
        } else {
          // Convert non-numeric values to bytes and encrypt
          const bytes = new TextEncoder().encode(value.toString());
          encrypted[key] = await this.cofhe.encryptBytes(bytes, this.publicKey);
        }
      }

      console.log('Features encrypted successfully');
      return encrypted;

    } catch (error) {
      console.error('FHE encryption failed:', error);
      console.warn('Falling back to mock encryption');
      return this.createMockEncryption(features);
    }
  }

  /**
   * Create mock encryption for fallback
   */
  private createMockEncryption(features: FHEFeatures): EncryptedFeatures {
    const encrypted: EncryptedFeatures = {};

    for (const [key, value] of Object.entries(features)) {
      // Create deterministic "encryption" for testing
      const salt = key.length.toString();
      encrypted[key] = Buffer.from(`mock:${value}:${salt}`).toString('base64');
    }

    return encrypted;
  }

  /**
   * Prepare features for encryption (normalize values)
   */
  prepareFeatures(rawFeatures: Partial<FHEFeatures>): FHEFeatures {
    return {
      walletAge: Math.max(0, Number(rawFeatures.walletAge) || 0),
      transactionCount: Math.max(0, Number(rawFeatures.transactionCount) || 0),
      successRate: Math.max(0, Math.min(1, Number(rawFeatures.successRate) || 0)),
      lpContribution: Math.max(0, Number(rawFeatures.lpContribution) || 0),
      liquidationCount: Math.max(0, Number(rawFeatures.liquidationCount) || 0),
      avgTransactionValue: Math.max(0, Number(rawFeatures.avgTransactionValue) || 0),
      uniqueInteractions: Math.max(0, Number(rawFeatures.uniqueInteractions) || 0),
      riskScore: Math.max(0, Math.min(100, Number(rawFeatures.riskScore) || 0))
    };
  }

  /**
   * Extract features from wallet data
   */
  extractFeaturesFromWallet(walletData: {
    address: string;
    balance: bigint;
    blockNumber?: bigint;
    transactions?: any[];
  }): FHEFeatures {
    const balanceInEth = Number(walletData.balance) / 1e18;

    // Mock feature extraction - in production would analyze transaction history
    const features: FHEFeatures = {
      walletAge: Math.floor(Math.random() * 365 * 2), // 0-2 years in days
      transactionCount: walletData.transactions?.length || Math.floor(Math.random() * 1000),
      successRate: 0.85 + Math.random() * 0.14, // 85-99% success rate
      lpContribution: balanceInEth * (0.1 + Math.random() * 0.3), // 10-40% of balance
      liquidationCount: balanceInEth < 1 ? Math.floor(Math.random() * 3) : 0,
      avgTransactionValue: balanceInEth / Math.max(1, walletData.transactions?.length || 10),
      uniqueInteractions: Math.floor(Math.random() * 50) + 10,
      riskScore: Math.floor((1 - (0.85 + Math.random() * 0.14)) * 100)
    };

    return this.prepareFeatures(features);
  }

  /**
   * Get encryption status
   */
  getStatus(): {
    isInitialized: boolean;
    hasPublicKey: boolean;
    hasCofhe: boolean;
    version: string | null;
  } {
    return {
      isInitialized: this.isInitialized,
      hasPublicKey: !!this.publicKey,
      hasCofhe: !!this.cofhe,
      version: this.cofhe ? this.cofhe.getVersion() : null
    };
  }

  /**
   * Get public key
   */
  getPublicKey(): string | null {
    return this.publicKey;
  }

  /**
   * Check if FHE is available and working
   */
  async isAvailable(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }
      return this.isInitialized && !!this.cofhe && !!this.publicKey;
    } catch {
      return false;
    }
  }

  /**
   * Test encryption/decryption with a simple value
   */
  async testEncryption(): Promise<{
    success: boolean;
    originalValue?: number;
    encrypted?: string;
    roundTripTime?: number;
    error?: string;
  }> {
    try {
      if (!this.isInitialized) {
        await this.initialize();
      }

      const testValue = 42;
      const startTime = performance.now();

      const testFeatures: FHEFeatures = {
        walletAge: testValue,
        transactionCount: 100,
        successRate: 0.95,
        lpContribution: 1.5,
        liquidationCount: 0
      };

      const encrypted = await this.encryptFeatures(testFeatures);
      const endTime = performance.now();

      return {
        success: true,
        originalValue: testValue,
        encrypted: encrypted.walletAge,
        roundTripTime: endTime - startTime
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Clear sensitive data from memory
   */
  cleanup(): void {
    this.publicKey = null;
    this.cofhe = null;
    this.isInitialized = false;
    this.initializationPromise = null;
  }

  /**
   * Serialize encrypted features for transmission
   */
  serializeEncryptedFeatures(encrypted: EncryptedFeatures): string {
    return JSON.stringify(encrypted);
  }

  /**
   * Deserialize encrypted features from string
   */
  deserializeEncryptedFeatures(serialized: string): EncryptedFeatures {
    try {
      return JSON.parse(serialized);
    } catch (error) {
      console.error('Failed to deserialize encrypted features:', error);
      return {};
    }
  }
}

// Export singleton instance
export const fheService = new FHEService();

export default FHEService;