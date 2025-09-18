const { ethers } = require('ethers');
const axios = require('axios');
const EventEmitter = require('events');

/**
 * EigenLayer Integration Service
 * Manages interactions with EigenLayer AVS and operator coordination
 */
class EigenLayerService extends EventEmitter {
  constructor(config) {
    super();

    this.config = config;
    this.provider = null;
    this.wallet = null;
    this.contracts = {};
    this.operatorInfo = null;
    this.taskQueue = [];
    this.isProcessing = false;
  }

  /**
   * Initialize the EigenLayer service
   */
  async initialize() {
    try {
      // Initialize provider
      const rpcUrl = this.config.rpcUrl || process.env.RPC_URL;
      this.provider = new ethers.JsonRpcProvider(rpcUrl);

      // Initialize wallet
      const privateKey = process.env.OPERATOR_PRIVATE_KEY;
      if (!privateKey) {
        throw new Error('OPERATOR_PRIVATE_KEY not found');
      }
      this.wallet = new ethers.Wallet(privateKey, this.provider);

      // Load contracts
      await this.loadContracts();

      // Load operator info
      await this.loadOperatorInfo();

      // Start task processor
      this.startTaskProcessor();

      console.log('EigenLayer service initialized');
      console.log(`Operator: ${this.wallet.address}`);
      console.log(`Network: ${await this.provider.getNetwork().then(n => n.name)}`);

      return true;
    } catch (error) {
      console.error('Failed to initialize EigenLayer service:', error);
      throw error;
    }
  }

  /**
   * Load contract instances
   */
  async loadContracts() {
    // Service Manager ABI
    const serviceManagerABI = [
      "function createTask(uint8 taskType, bytes calldata taskData) external returns (uint256)",
      "function respondToTask(uint256 taskId, bytes calldata response, bytes calldata signature) external",
      "function getTask(uint256 taskId) external view returns (tuple(uint256 taskId, uint8 taskType, bytes taskData, uint256 createdAt, uint256 respondedAt, uint8 status, address requester, bytes32 responseHash, uint256 quorumAchieved))",
      "function getOperator(address operator) external view returns (tuple(address operatorAddress, uint256 stake, bool isActive, uint256 registeredAt, uint256 lastResponseTime, uint256 successfulResponses, uint256 failedResponses, bytes blsPublicKey))",
      "event TaskCreated(uint256 indexed taskId, uint8 taskType, address requester)",
      "event TaskResponded(uint256 indexed taskId, address indexed operator)",
      "event TaskCompleted(uint256 indexed taskId, bytes32 responseHash)",
      "event QuorumAchieved(uint256 indexed taskId, uint256 responseCount, uint256 threshold)"
    ];

    const serviceManagerAddress = process.env.SERVICE_MANAGER_ADDRESS;
    if (!serviceManagerAddress) {
      throw new Error('SERVICE_MANAGER_ADDRESS not configured');
    }

    this.contracts.serviceManager = new ethers.Contract(
      serviceManagerAddress,
      serviceManagerABI,
      this.wallet
    );

    // Listen to events
    this.setupEventListeners();
  }

  /**
   * Load operator information
   */
  async loadOperatorInfo() {
    try {
      this.operatorInfo = await this.contracts.serviceManager.getOperator(this.wallet.address);

      if (!this.operatorInfo.isActive) {
        throw new Error('Operator is not active');
      }

      console.log('Operator info loaded:');
      console.log(`  Stake: ${ethers.formatEther(this.operatorInfo.stake)} ETH`);
      console.log(`  Successful responses: ${this.operatorInfo.successfulResponses}`);
      console.log(`  Failed responses: ${this.operatorInfo.failedResponses}`);

    } catch (error) {
      console.error('Failed to load operator info:', error);
      throw error;
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen for new tasks
    this.contracts.serviceManager.on('TaskCreated', async (taskId, taskType, requester) => {
      console.log(`New task created: ${taskId} (type: ${taskType})`);
      await this.handleNewTask(taskId);
    });

    // Listen for task responses
    this.contracts.serviceManager.on('TaskResponded', (taskId, operator) => {
      if (operator === this.wallet.address) {
        console.log(`Task ${taskId} response submitted successfully`);
      }
    });

    // Listen for task completion
    this.contracts.serviceManager.on('TaskCompleted', (taskId, responseHash) => {
      console.log(`Task ${taskId} completed with consensus: ${responseHash}`);
      this.emit('taskCompleted', { taskId, responseHash });
    });

    // Listen for quorum achievement
    this.contracts.serviceManager.on('QuorumAchieved', (taskId, responseCount, threshold) => {
      console.log(`Quorum achieved for task ${taskId}: ${responseCount}/${threshold}`);
    });
  }

  /**
   * Handle new task
   */
  async handleNewTask(taskId) {
    try {
      // Get task details
      const task = await this.contracts.serviceManager.getTask(taskId);

      // Add to queue
      this.taskQueue.push({
        id: taskId,
        type: task.taskType,
        data: task.taskData,
        createdAt: task.createdAt,
        requester: task.requester
      });

      // Process queue
      this.processTaskQueue();

    } catch (error) {
      console.error(`Failed to handle task ${taskId}:`, error);
    }
  }

  /**
   * Start task processor
   */
  startTaskProcessor() {
    setInterval(() => {
      if (this.taskQueue.length > 0 && !this.isProcessing) {
        this.processTaskQueue();
      }
    }, 1000); // Check every second
  }

  /**
   * Process task queue
   */
  async processTaskQueue() {
    if (this.isProcessing || this.taskQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const task = this.taskQueue.shift();
      await this.processTask(task);
    } catch (error) {
      console.error('Task processing error:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process individual task
   */
  async processTask(task) {
    console.log(`Processing task ${task.id} (type: ${task.type})`);

    try {
      // Decode task data
      const taskData = this.decodeTaskData(task.type, task.data);

      // Execute task based on type
      let response;
      switch (task.type) {
        case 0: // COMPUTE_PCS
          response = await this.computePCS(taskData);
          break;
        case 1: // COMPUTE_PRS
          response = await this.computePRS(taskData);
          break;
        case 2: // BATCH_ATTESTATION
          response = await this.processBatchAttestation(taskData);
          break;
        case 3: // VERIFY_COMPUTATION
          response = await this.verifyComputation(taskData);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }

      // Submit response
      await this.submitTaskResponse(task.id, response);

    } catch (error) {
      console.error(`Failed to process task ${task.id}:`, error);
      this.emit('taskError', { taskId: task.id, error: error.message });
    }
  }

  /**
   * Decode task data based on type
   */
  decodeTaskData(taskType, encodedData) {
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();

    switch (taskType) {
      case 0: // COMPUTE_PCS
        return abiCoder.decode(
          ['address', 'bytes'],
          encodedData
        );
      case 1: // COMPUTE_PRS
        return abiCoder.decode(
          ['bytes32', 'tuple(uint256 volatility, uint256 liquidityDepth, uint256 concentration, uint256 oracleDispersion)'],
          encodedData
        );
      case 2: // BATCH_ATTESTATION
        return abiCoder.decode(
          ['tuple(uint8 type, bytes data)[]'],
          encodedData
        );
      case 3: // VERIFY_COMPUTATION
        return abiCoder.decode(
          ['uint256', 'bytes32'],
          encodedData
        );
      default:
        return encodedData;
    }
  }

  /**
   * Compute PCS using AVS worker
   */
  async computePCS(taskData) {
    const [subject, encryptedFeatures] = taskData;

    // Call AVS worker API
    const response = await axios.post(`http://localhost:${process.env.PORT || 3000}/compute/pcs`, {
      subject: subject,
      encryptedFeatures: ethers.hexlify(encryptedFeatures)
    });

    if (!response.data.success) {
      throw new Error('PCS computation failed');
    }

    // Encode response
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    return abiCoder.encode(
      ['uint256', 'string', 'bytes'],
      [
        response.data.computation.score,
        response.data.computation.tier,
        response.data.signature
      ]
    );
  }

  /**
   * Compute PRS using AVS worker
   */
  async computePRS(taskData) {
    const [poolId, poolMetrics] = taskData;

    // Call AVS worker API
    const response = await axios.post(`http://localhost:${process.env.PORT || 3000}/compute/prs`, {
      poolId: poolId,
      poolMetrics: poolMetrics
    });

    if (!response.data.success) {
      throw new Error('PRS computation failed');
    }

    // Encode response
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    return abiCoder.encode(
      ['uint256', 'string', 'bytes'],
      [
        response.data.computation.score,
        response.data.computation.band,
        response.data.signature
      ]
    );
  }

  /**
   * Process batch attestation
   */
  async processBatchAttestation(taskData) {
    const requests = taskData;

    // Call AVS worker API
    const response = await axios.post(`http://localhost:${process.env.PORT || 3000}/compute/batch`, {
      requests: requests
    });

    if (!response.data.success) {
      throw new Error('Batch attestation failed');
    }

    // Encode response
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    return abiCoder.encode(
      ['tuple(bool success, bytes attestation, bytes signature)[]'],
      [response.data.results]
    );
  }

  /**
   * Verify computation
   */
  async verifyComputation(taskData) {
    const [taskId, expectedHash] = taskData;

    // Get task details
    const task = await this.contracts.serviceManager.getTask(taskId);

    // Verify the computation
    const isValid = task.responseHash === expectedHash;

    // Encode response
    const abiCoder = ethers.AbiCoder.defaultAbiCoder();
    return abiCoder.encode(
      ['bool', 'bytes32'],
      [isValid, task.responseHash]
    );
  }

  /**
   * Submit task response to EigenLayer
   */
  async submitTaskResponse(taskId, response) {
    try {
      // Sign the response
      const messageHash = ethers.solidityPackedKeccak256(
        ['uint256', 'bytes'],
        [taskId, response]
      );
      const signature = await this.wallet.signMessage(ethers.getBytes(messageHash));

      // Submit to contract
      const tx = await this.contracts.serviceManager.respondToTask(
        taskId,
        response,
        signature
      );

      console.log(`Response submitted for task ${taskId}: ${tx.hash}`);
      const receipt = await tx.wait();

      console.log(`Response confirmed. Gas used: ${receipt.gasUsed.toString()}`);

      this.emit('responseSubmitted', {
        taskId,
        txHash: tx.hash,
        gasUsed: receipt.gasUsed.toString()
      });

      return receipt;

    } catch (error) {
      console.error(`Failed to submit response for task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Create a new task (for testing)
   */
  async createTask(taskType, taskData) {
    try {
      const tx = await this.contracts.serviceManager.createTask(taskType, taskData);
      console.log(`Task creation tx: ${tx.hash}`);

      const receipt = await tx.wait();
      const taskId = receipt.logs[0].args[0];

      console.log(`Task created with ID: ${taskId}`);
      return taskId;

    } catch (error) {
      console.error('Failed to create task:', error);
      throw error;
    }
  }

  /**
   * Get operator statistics
   */
  async getOperatorStats() {
    const operator = await this.contracts.serviceManager.getOperator(this.wallet.address);

    return {
      address: this.wallet.address,
      stake: ethers.formatEther(operator.stake),
      isActive: operator.isActive,
      registeredAt: new Date(Number(operator.registeredAt) * 1000),
      lastResponseTime: operator.lastResponseTime > 0
        ? new Date(Number(operator.lastResponseTime) * 1000)
        : null,
      successfulResponses: Number(operator.successfulResponses),
      failedResponses: Number(operator.failedResponses),
      successRate: operator.successfulResponses > 0
        ? (Number(operator.successfulResponses) / (Number(operator.successfulResponses) + Number(operator.failedResponses)) * 100).toFixed(2)
        : 0
    };
  }

  /**
   * Monitor operator performance
   */
  async startMonitoring(interval = 60000) {
    setInterval(async () => {
      try {
        const stats = await this.getOperatorStats();
        console.log('\n=== Operator Performance ===');
        console.log(`Success Rate: ${stats.successRate}%`);
        console.log(`Total Responses: ${stats.successfulResponses + stats.failedResponses}`);
        console.log(`Last Response: ${stats.lastResponseTime || 'Never'}`);

        this.emit('performanceUpdate', stats);

      } catch (error) {
        console.error('Monitoring error:', error);
      }
    }, interval);
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    console.log('Shutting down EigenLayer service...');

    // Remove event listeners
    this.contracts.serviceManager.removeAllListeners();

    // Clear task queue
    this.taskQueue = [];

    console.log('EigenLayer service shut down');
  }
}

module.exports = EigenLayerService;