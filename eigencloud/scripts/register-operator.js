#!/usr/bin/env node

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
require('dotenv').config();

/**
 * EigenCloud Operator Registration Script
 * Registers an operator with the CCR Hook AVS on EigenLayer
 */

class OperatorRegistration {
  constructor() {
    this.config = this.loadConfig();
    this.provider = null;
    this.wallet = null;
    this.contracts = {};
  }

  /**
   * Load AVS configuration
   */
  loadConfig() {
    const configPath = path.join(__dirname, '../config/avs-config.yaml');
    const configFile = fs.readFileSync(configPath, 'utf8');
    return yaml.load(configFile);
  }

  /**
   * Initialize provider and wallet
   */
  async initialize(network = 'sepolia') {
    const networkConfig = this.config.networks[network];
    if (!networkConfig) {
      throw new Error(`Network ${network} not found in configuration`);
    }

    // Initialize provider
    const rpcUrl = process.env[networkConfig.rpc.replace('${', '').replace('}', '')] || networkConfig.rpc;
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    // Initialize wallet
    const privateKey = process.env.OPERATOR_PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('OPERATOR_PRIVATE_KEY not found in environment');
    }
    this.wallet = new ethers.Wallet(privateKey, this.provider);

    console.log(`Initialized operator: ${this.wallet.address}`);
    console.log(`Network: ${network} (Chain ID: ${networkConfig.chainId})`);

    // Load contract ABIs and addresses
    await this.loadContracts(networkConfig);
  }

  /**
   * Load contract instances
   */
  async loadContracts(networkConfig) {
    // Service Manager Contract
    const serviceManagerABI = [
      "function registerOperator(address operatorAddress, bytes blsPublicKey, uint256 stake) external",
      "function deregisterOperator(address operatorAddress) external",
      "function getOperator(address operator) external view returns (tuple(address operatorAddress, uint256 stake, bool isActive, uint256 registeredAt, uint256 lastResponseTime, uint256 successfulResponses, uint256 failedResponses, bytes blsPublicKey))",
      "function isOperator(address operator) external view returns (bool)",
      "function totalOperators() external view returns (uint256)",
      "function totalStake() external view returns (uint256)"
    ];

    const serviceManagerAddress = process.env.SERVICE_MANAGER_ADDRESS || networkConfig.contracts.serviceManager;
    this.contracts.serviceManager = new ethers.Contract(
      serviceManagerAddress,
      serviceManagerABI,
      this.wallet
    );

    // Registry Coordinator Contract (EigenLayer)
    const registryCoordinatorABI = [
      "function registerOperator(bytes calldata quorumNumbers, string calldata socket, tuple(bytes32 pubkeyG1_X, bytes32 pubkeyG1_Y, bytes32 pubkeyG2_X, bytes32 pubkeyG2_Y) calldata params, tuple(uint8 v, bytes32 r, bytes32 s) calldata operatorSignature) external",
      "function deregisterOperator(bytes calldata quorumNumbers) external",
      "function getOperatorStatus(address operator) external view returns (tuple(address operator, bytes32 operatorId, uint96 stake))"
    ];

    const registryCoordinatorAddress = process.env.REGISTRY_COORDINATOR_ADDRESS || networkConfig.contracts.registryCoordinator;
    this.contracts.registryCoordinator = new ethers.Contract(
      registryCoordinatorAddress,
      registryCoordinatorABI,
      this.wallet
    );

    // Stake Registry Contract
    const stakeRegistryABI = [
      "function registerOperator(address operator, bytes32 operatorId, bytes calldata quorumNumbers) external",
      "function deregisterOperator(bytes32 operatorId, bytes calldata quorumNumbers) external",
      "function updateOperatorStake(address operator, bytes32 operatorId, bytes calldata quorumNumbers) external",
      "function getOperatorStake(address operator) external view returns (uint96)"
    ];

    const stakeRegistryAddress = process.env.STAKE_REGISTRY_ADDRESS || networkConfig.contracts.stakeRegistry;
    this.contracts.stakeRegistry = new ethers.Contract(
      stakeRegistryAddress,
      stakeRegistryABI,
      this.wallet
    );

    console.log('Contracts loaded successfully');
  }

  /**
   * Generate BLS keys for the operator
   */
  async generateBLSKeys() {
    // In production, use proper BLS key generation
    // For now, we'll use a mock implementation
    const blsKeypair = {
      publicKey: {
        G1: {
          X: ethers.hexlify(ethers.randomBytes(32)),
          Y: ethers.hexlify(ethers.randomBytes(32))
        },
        G2: {
          X: ethers.hexlify(ethers.randomBytes(32)),
          Y: ethers.hexlify(ethers.randomBytes(32))
        }
      },
      privateKey: ethers.hexlify(ethers.randomBytes(32))
    };

    // Save BLS keys to keystore
    const keystorePath = path.join(__dirname, '../operators/keystore');
    if (!fs.existsSync(keystorePath)) {
      fs.mkdirSync(keystorePath, { recursive: true });
    }

    const keyFileName = `bls_${this.wallet.address.toLowerCase()}.json`;
    const keyFilePath = path.join(keystorePath, keyFileName);

    fs.writeFileSync(keyFilePath, JSON.stringify(blsKeypair, null, 2));
    console.log(`BLS keys saved to: ${keyFilePath}`);

    return blsKeypair;
  }

  /**
   * Register operator with EigenLayer
   */
  async registerWithEigenLayer() {
    console.log('\n=== Registering with EigenLayer ===');

    try {
      // Generate BLS keys
      const blsKeypair = await this.generateBLSKeys();

      // Prepare registration parameters
      const quorumNumbers = ethers.hexlify(new Uint8Array([0])); // Quorum 0
      const socket = `${this.wallet.address}:9090`; // Operator endpoint

      const params = {
        pubkeyG1_X: blsKeypair.publicKey.G1.X,
        pubkeyG1_Y: blsKeypair.publicKey.G1.Y,
        pubkeyG2_X: blsKeypair.publicKey.G2.X,
        pubkeyG2_Y: blsKeypair.publicKey.G2.Y
      };

      // Sign the registration
      const messageHash = ethers.solidityPackedKeccak256(
        ['address', 'bytes32', 'bytes32'],
        [this.wallet.address, params.pubkeyG1_X, params.pubkeyG1_Y]
      );
      const signature = await this.wallet.signMessage(ethers.getBytes(messageHash));
      const sig = ethers.Signature.from(signature);

      const operatorSignature = {
        v: sig.v,
        r: sig.r,
        s: sig.s
      };

      // Register with Registry Coordinator
      console.log('Registering with Registry Coordinator...');
      const tx = await this.contracts.registryCoordinator.registerOperator(
        quorumNumbers,
        socket,
        params,
        operatorSignature
      );

      console.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`Registration successful! Gas used: ${receipt.gasUsed.toString()}`);

      return blsKeypair;

    } catch (error) {
      console.error('EigenLayer registration failed:', error);
      throw error;
    }
  }

  /**
   * Register operator with CCR Service Manager
   */
  async registerWithServiceManager(blsPublicKey) {
    console.log('\n=== Registering with CCR Service Manager ===');

    try {
      // Check if already registered
      const isRegistered = await this.contracts.serviceManager.isOperator(this.wallet.address);
      if (isRegistered) {
        console.log('Operator already registered with Service Manager');
        return;
      }

      // Prepare BLS public key bytes
      const blsPublicKeyBytes = ethers.concat([
        blsPublicKey.publicKey.G1.X,
        blsPublicKey.publicKey.G1.Y
      ]);

      // Get current stake (minimum 32 ETH required)
      const stake = ethers.parseEther('32');

      // Register operator
      console.log('Registering operator...');
      const tx = await this.contracts.serviceManager.registerOperator(
        this.wallet.address,
        blsPublicKeyBytes,
        stake
      );

      console.log(`Transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();
      console.log(`Registration successful! Gas used: ${receipt.gasUsed.toString()}`);

      // Verify registration
      const operatorInfo = await this.contracts.serviceManager.getOperator(this.wallet.address);
      console.log('\nOperator Info:');
      console.log(`  Address: ${operatorInfo.operatorAddress}`);
      console.log(`  Stake: ${ethers.formatEther(operatorInfo.stake)} ETH`);
      console.log(`  Active: ${operatorInfo.isActive}`);
      console.log(`  Registered At: ${new Date(Number(operatorInfo.registeredAt) * 1000).toISOString()}`);

    } catch (error) {
      console.error('Service Manager registration failed:', error);
      throw error;
    }
  }

  /**
   * Create operator configuration file
   */
  async createOperatorConfig(blsKeypair) {
    const operatorConfig = {
      address: this.wallet.address,
      socket: `${this.wallet.address}:9090`,
      blsPublicKey: {
        G1: blsKeypair.publicKey.G1,
        G2: blsKeypair.publicKey.G2
      },
      metadata: {
        name: `CCR Operator ${this.wallet.address.slice(0, 8)}`,
        description: 'CCR Hook AVS Operator',
        website: 'https://ccr-hook.io',
        twitter: '@ccr_hook'
      },
      endpoints: {
        rpc: `http://${this.wallet.address}:8545`,
        rest: `http://${this.wallet.address}:3000`,
        metrics: `http://${this.wallet.address}:9090`
      },
      registeredAt: new Date().toISOString()
    };

    const configPath = path.join(__dirname, '../operators', `operator_${this.wallet.address.toLowerCase()}.json`);
    fs.writeFileSync(configPath, JSON.stringify(operatorConfig, null, 2));
    console.log(`\nOperator configuration saved to: ${configPath}`);

    return operatorConfig;
  }

  /**
   * Check operator status
   */
  async checkStatus() {
    console.log('\n=== Checking Operator Status ===');

    try {
      // Check EigenLayer registration
      const eigenLayerStatus = await this.contracts.registryCoordinator.getOperatorStatus(this.wallet.address);
      console.log('\nEigenLayer Status:');
      console.log(`  Operator ID: ${eigenLayerStatus.operatorId}`);
      console.log(`  Stake: ${ethers.formatEther(eigenLayerStatus.stake)} ETH`);

      // Check Service Manager registration
      const isRegistered = await this.contracts.serviceManager.isOperator(this.wallet.address);
      console.log('\nService Manager Status:');
      console.log(`  Registered: ${isRegistered}`);

      if (isRegistered) {
        const operatorInfo = await this.contracts.serviceManager.getOperator(this.wallet.address);
        console.log(`  Active: ${operatorInfo.isActive}`);
        console.log(`  Successful Responses: ${operatorInfo.successfulResponses}`);
        console.log(`  Failed Responses: ${operatorInfo.failedResponses}`);
      }

      // Check total operators and stake
      const totalOperators = await this.contracts.serviceManager.totalOperators();
      const totalStake = await this.contracts.serviceManager.totalStake();
      console.log('\nNetwork Status:');
      console.log(`  Total Operators: ${totalOperators}`);
      console.log(`  Total Stake: ${ethers.formatEther(totalStake)} ETH`);

    } catch (error) {
      console.error('Status check failed:', error);
    }
  }

  /**
   * Main registration flow
   */
  async register(network = 'sepolia') {
    try {
      console.log('========================================');
      console.log('   CCR Hook AVS Operator Registration  ');
      console.log('========================================\n');

      // Initialize
      await this.initialize(network);

      // Check current balance
      const balance = await this.provider.getBalance(this.wallet.address);
      console.log(`Operator Balance: ${ethers.formatEther(balance)} ETH`);

      if (balance < ethers.parseEther('32.1')) {
        throw new Error('Insufficient balance. Minimum 32.1 ETH required (32 ETH stake + gas)');
      }

      // Register with EigenLayer
      const blsKeypair = await this.registerWithEigenLayer();

      // Register with Service Manager
      await this.registerWithServiceManager(blsKeypair);

      // Create operator configuration
      await this.createOperatorConfig(blsKeypair);

      // Check final status
      await this.checkStatus();

      console.log('\n========================================');
      console.log('   Registration Complete Successfully!  ');
      console.log('========================================');

    } catch (error) {
      console.error('\nRegistration failed:', error);
      process.exit(1);
    }
  }

  /**
   * Deregister operator
   */
  async deregister(network = 'sepolia') {
    try {
      console.log('========================================');
      console.log('  CCR Hook AVS Operator Deregistration ');
      console.log('========================================\n');

      await this.initialize(network);

      // Deregister from Service Manager
      console.log('Deregistering from Service Manager...');
      const tx1 = await this.contracts.serviceManager.deregisterOperator(this.wallet.address);
      await tx1.wait();
      console.log('Deregistered from Service Manager');

      // Deregister from EigenLayer
      console.log('Deregistering from EigenLayer...');
      const quorumNumbers = ethers.hexlify(new Uint8Array([0]));
      const tx2 = await this.contracts.registryCoordinator.deregisterOperator(quorumNumbers);
      await tx2.wait();
      console.log('Deregistered from EigenLayer');

      console.log('\nDeregistration complete!');

    } catch (error) {
      console.error('\nDeregistration failed:', error);
      process.exit(1);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const network = args[1] || 'sepolia';

  const registration = new OperatorRegistration();

  switch (command) {
    case 'register':
      await registration.register(network);
      break;
    case 'deregister':
      await registration.deregister(network);
      break;
    case 'status':
      await registration.initialize(network);
      await registration.checkStatus();
      break;
    default:
      console.log('Usage:');
      console.log('  node register-operator.js register [network]   - Register operator');
      console.log('  node register-operator.js deregister [network] - Deregister operator');
      console.log('  node register-operator.js status [network]     - Check status');
      console.log('\nNetworks: mainnet, sepolia (default: sepolia)');
      process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = OperatorRegistration;