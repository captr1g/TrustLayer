const { ethers } = require('ethers');
const EventEmitter = require('events');

/**
 * Consensus Manager for Multi-Operator Coordination
 * Manages consensus formation and response aggregation across multiple operators
 */
class ConsensusManager extends EventEmitter {
  constructor(eigenLayerService) {
    super();

    this.eigenLayerService = eigenLayerService;
    this.operators = new Map();
    this.taskResponses = new Map();
    this.consensusThreshold = 0.66; // 66% consensus required
    this.responseTimeout = 30000; // 30 seconds timeout
    this.pendingConsensus = new Map();
  }

  /**
   * Initialize consensus manager
   */
  async initialize() {
    console.log('Initializing Consensus Manager...');

    // Load active operators
    await this.loadActiveOperators();

    // Start consensus monitoring
    this.startConsensusMonitoring();

    console.log(`Consensus Manager initialized with ${this.operators.size} operators`);
    console.log(`Consensus threshold: ${this.consensusThreshold * 100}%`);
  }

  /**
   * Load active operators from the network
   */
  async loadActiveOperators() {
    try {
      // This would typically fetch from the ServiceManager contract
      // For now, we'll simulate with mock data
      const mockOperators = [
        {
          address: '0x1234567890123456789012345678901234567890',
          stake: ethers.parseEther('32'),
          reputation: 0.95
        },
        {
          address: '0x2345678901234567890123456789012345678901',
          stake: ethers.parseEther('64'),
          reputation: 0.98
        },
        {
          address: '0x3456789012345678901234567890123456789012',
          stake: ethers.parseEther('48'),
          reputation: 0.92
        }
      ];

      for (const operator of mockOperators) {
        this.operators.set(operator.address, {
          ...operator,
          weight: this.calculateOperatorWeight(operator),
          lastSeen: Date.now(),
          responseCount: 0,
          consensusParticipation: 0
        });
      }

    } catch (error) {
      console.error('Failed to load operators:', error);
      throw error;
    }
  }

  /**
   * Calculate operator weight based on stake and reputation
   */
  calculateOperatorWeight(operator) {
    // Weight = 70% stake + 30% reputation
    const stakeWeight = Number(ethers.formatEther(operator.stake)) / 100; // Normalize to 0-1
    const reputationWeight = operator.reputation;

    return (stakeWeight * 0.7) + (reputationWeight * 0.3);
  }

  /**
   * Process task response from an operator
   */
  async processOperatorResponse(taskId, operatorAddress, response, signature) {
    console.log(`Processing response from operator ${operatorAddress} for task ${taskId}`);

    // Verify operator is active
    if (!this.operators.has(operatorAddress)) {
      throw new Error(`Unknown operator: ${operatorAddress}`);
    }

    // Verify signature
    const isValid = await this.verifyResponseSignature(
      taskId,
      operatorAddress,
      response,
      signature
    );

    if (!isValid) {
      throw new Error('Invalid response signature');
    }

    // Store response
    if (!this.taskResponses.has(taskId)) {
      this.taskResponses.set(taskId, new Map());

      // Start timeout for this task
      setTimeout(() => {
        this.finalizeConsensus(taskId);
      }, this.responseTimeout);
    }

    const responses = this.taskResponses.get(taskId);
    responses.set(operatorAddress, {
      response,
      signature,
      timestamp: Date.now(),
      weight: this.operators.get(operatorAddress).weight
    });

    // Update operator stats
    const operator = this.operators.get(operatorAddress);
    operator.lastSeen = Date.now();
    operator.responseCount++;

    // Check if consensus can be formed
    await this.checkConsensus(taskId);
  }

  /**
   * Verify response signature
   */
  async verifyResponseSignature(taskId, operatorAddress, response, signature) {
    try {
      const messageHash = ethers.solidityPackedKeccak256(
        ['uint256', 'bytes'],
        [taskId, response]
      );

      const recoveredAddress = ethers.verifyMessage(
        ethers.getBytes(messageHash),
        signature
      );

      return recoveredAddress.toLowerCase() === operatorAddress.toLowerCase();

    } catch (error) {
      console.error('Signature verification failed:', error);
      return false;
    }
  }

  /**
   * Check if consensus has been reached
   */
  async checkConsensus(taskId) {
    const responses = this.taskResponses.get(taskId);
    if (!responses) return;

    // Group responses by content
    const responseGroups = new Map();

    for (const [operator, data] of responses) {
      const responseHash = ethers.keccak256(data.response);

      if (!responseGroups.has(responseHash)) {
        responseGroups.set(responseHash, {
          operators: [],
          totalWeight: 0,
          response: data.response
        });
      }

      const group = responseGroups.get(responseHash);
      group.operators.push(operator);
      group.totalWeight += data.weight;
    }

    // Calculate total weight of all responses
    const totalWeight = Array.from(this.operators.values())
      .reduce((sum, op) => sum + op.weight, 0);

    // Check each response group for consensus
    for (const [hash, group] of responseGroups) {
      const consensusPercentage = group.totalWeight / totalWeight;

      if (consensusPercentage >= this.consensusThreshold) {
        console.log(`Consensus reached for task ${taskId}`);
        console.log(`Response hash: ${hash}`);
        console.log(`Consensus: ${(consensusPercentage * 100).toFixed(2)}%`);
        console.log(`Operators: ${group.operators.length}`);

        await this.submitConsensusResponse(taskId, group);
        return true;
      }
    }

    console.log(`Consensus not yet reached for task ${taskId}`);
    return false;
  }

  /**
   * Submit consensus response to the network
   */
  async submitConsensusResponse(taskId, consensusGroup) {
    try {
      // Mark task as having consensus
      this.pendingConsensus.set(taskId, {
        response: consensusGroup.response,
        operators: consensusGroup.operators,
        weight: consensusGroup.totalWeight,
        timestamp: Date.now()
      });

      // Update operator participation stats
      for (const operatorAddress of consensusGroup.operators) {
        const operator = this.operators.get(operatorAddress);
        if (operator) {
          operator.consensusParticipation++;
        }
      }

      // Emit consensus event
      this.emit('consensusReached', {
        taskId,
        response: consensusGroup.response,
        operators: consensusGroup.operators,
        consensusWeight: consensusGroup.totalWeight
      });

      // Clean up
      this.taskResponses.delete(taskId);

      return true;

    } catch (error) {
      console.error('Failed to submit consensus response:', error);
      throw error;
    }
  }

  /**
   * Finalize consensus when timeout is reached
   */
  finalizeConsensus(taskId) {
    const responses = this.taskResponses.get(taskId);
    if (!responses || responses.size === 0) {
      console.log(`No responses received for task ${taskId}`);
      this.emit('consensusFailed', { taskId, reason: 'No responses' });
      return;
    }

    // Try to form consensus with available responses
    this.checkConsensus(taskId).then(hasConsensus => {
      if (!hasConsensus) {
        console.log(`Failed to reach consensus for task ${taskId}`);
        this.emit('consensusFailed', {
          taskId,
          reason: 'Insufficient consensus',
          responses: responses.size
        });
      }
    });
  }

  /**
   * Start monitoring consensus formation
   */
  startConsensusMonitoring() {
    setInterval(() => {
      // Check for stale tasks
      for (const [taskId, responses] of this.taskResponses) {
        const oldestResponse = Math.min(
          ...Array.from(responses.values()).map(r => r.timestamp)
        );

        if (Date.now() - oldestResponse > this.responseTimeout * 2) {
          console.log(`Cleaning up stale task ${taskId}`);
          this.taskResponses.delete(taskId);
        }
      }

      // Update operator health
      for (const [address, operator] of this.operators) {
        const timeSinceLastSeen = Date.now() - operator.lastSeen;

        if (timeSinceLastSeen > 300000) { // 5 minutes
          console.log(`Operator ${address} appears offline`);
          operator.isHealthy = false;
        } else {
          operator.isHealthy = true;
        }
      }

      // Emit metrics
      this.emitMetrics();

    }, 30000); // Every 30 seconds
  }

  /**
   * Emit consensus metrics
   */
  emitMetrics() {
    const activeOperators = Array.from(this.operators.values())
      .filter(op => op.isHealthy).length;

    const avgParticipation = Array.from(this.operators.values())
      .reduce((sum, op) => sum + (op.consensusParticipation || 0), 0) / this.operators.size;

    const metrics = {
      totalOperators: this.operators.size,
      activeOperators,
      pendingTasks: this.taskResponses.size,
      consensusThreshold: this.consensusThreshold,
      avgParticipation
    };

    this.emit('metrics', metrics);
  }

  /**
   * Simulate operator responses (for testing)
   */
  async simulateOperatorResponses(taskId, response) {
    console.log(`Simulating operator responses for task ${taskId}`);

    for (const [address, operator] of this.operators) {
      // Simulate 80% of operators responding
      if (Math.random() < 0.8) {
        // Simulate 90% agreement
        const operatorResponse = Math.random() < 0.9 ? response : ethers.randomBytes(32);

        const messageHash = ethers.solidityPackedKeccak256(
          ['uint256', 'bytes'],
          [taskId, operatorResponse]
        );

        // Create mock signature
        const signature = ethers.hexlify(ethers.randomBytes(65));

        // Add small delay to simulate network latency
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));

        // Process response
        try {
          await this.processOperatorResponse(
            taskId,
            address,
            operatorResponse,
            signature
          );
        } catch (error) {
          console.error(`Failed to process simulated response: ${error.message}`);
        }
      }
    }
  }

  /**
   * Get consensus status for a task
   */
  getConsensusStatus(taskId) {
    const responses = this.taskResponses.get(taskId);
    if (!responses) {
      return { status: 'not_found' };
    }

    const pending = this.pendingConsensus.get(taskId);
    if (pending) {
      return {
        status: 'completed',
        consensus: pending,
        responseCount: responses.size
      };
    }

    return {
      status: 'pending',
      responseCount: responses.size,
      requiredResponses: Math.ceil(this.operators.size * this.consensusThreshold)
    };
  }

  /**
   * Get operator statistics
   */
  getOperatorStats() {
    const stats = [];

    for (const [address, operator] of this.operators) {
      stats.push({
        address,
        stake: ethers.formatEther(operator.stake),
        weight: operator.weight.toFixed(4),
        reputation: operator.reputation,
        responseCount: operator.responseCount,
        consensusParticipation: operator.consensusParticipation,
        isHealthy: operator.isHealthy || false,
        lastSeen: new Date(operator.lastSeen).toISOString()
      });
    }

    return stats.sort((a, b) => b.weight - a.weight);
  }

  /**
   * Update consensus threshold
   */
  updateConsensusThreshold(threshold) {
    if (threshold < 0.51 || threshold > 1.0) {
      throw new Error('Consensus threshold must be between 51% and 100%');
    }

    this.consensusThreshold = threshold;
    console.log(`Consensus threshold updated to ${threshold * 100}%`);
  }

  /**
   * Add or update operator
   */
  addOperator(address, stake, reputation) {
    const operator = {
      address,
      stake,
      reputation,
      weight: this.calculateOperatorWeight({ stake, reputation }),
      lastSeen: Date.now(),
      responseCount: 0,
      consensusParticipation: 0,
      isHealthy: true
    };

    this.operators.set(address, operator);
    console.log(`Operator ${address} added/updated`);

    return operator;
  }

  /**
   * Remove operator
   */
  removeOperator(address) {
    if (this.operators.delete(address)) {
      console.log(`Operator ${address} removed`);
      return true;
    }
    return false;
  }

  /**
   * Shutdown consensus manager
   */
  shutdown() {
    console.log('Shutting down Consensus Manager...');

    // Clear all pending tasks
    this.taskResponses.clear();
    this.pendingConsensus.clear();

    // Remove all listeners
    this.removeAllListeners();

    console.log('Consensus Manager shut down');
  }
}

module.exports = ConsensusManager;