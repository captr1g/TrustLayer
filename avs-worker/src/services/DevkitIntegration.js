const { spawn, exec } = require('child_process');
const { promisify } = require('util');
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

const execAsync = promisify(exec);

/**
 * EigenLayer Devkit CLI Integration
 * Provides Node.js wrapper for devkit-cli commands
 */
class DevkitIntegration extends EventEmitter {
  constructor(config = {}) {
    super();

    this.config = {
      devkitPath: config.devkitPath || 'devkit',
      configFile: config.configFile || './avs.config.yaml',
      network: config.network || 'sepolia',
      workDir: config.workDir || process.cwd(),
      ...config
    };

    this.operatorProcess = null;
    this.isRunning = false;
  }

  /**
   * Check if devkit CLI is installed
   */
  async checkInstallation() {
    try {
      const { stdout } = await execAsync(`${this.config.devkitPath} --version`);
      console.log(`Devkit CLI version: ${stdout.trim()}`);
      return true;
    } catch (error) {
      console.error('Devkit CLI not found. Please install it first.');
      return false;
    }
  }

  /**
   * Initialize AVS project
   */
  async initializeAVS(name = 'ccr-hook-avs') {
    console.log(`Initializing AVS project: ${name}`);

    try {
      const command = `${this.config.devkitPath} init ${name} --type avs --network ${this.config.network} --framework foundry`;
      const { stdout, stderr } = await execAsync(command, { cwd: this.config.workDir });

      if (stderr) {
        console.error(`Init stderr: ${stderr}`);
      }

      console.log(`AVS initialized: ${stdout}`);
      return { success: true, output: stdout };

    } catch (error) {
      console.error(`Failed to initialize AVS: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Deploy AVS contracts
   */
  async deployContracts(privateKey) {
    console.log('Deploying AVS contracts...');

    try {
      const command = `${this.config.devkitPath} deploy --config ${this.config.configFile} --network ${this.config.network}`;

      const env = {
        ...process.env,
        PRIVATE_KEY: privateKey
      };

      const { stdout, stderr } = await execAsync(command, {
        cwd: this.config.workDir,
        env
      });

      if (stderr) {
        console.error(`Deploy stderr: ${stderr}`);
      }

      // Parse deployment addresses from output
      const addresses = this.parseDeploymentAddresses(stdout);

      console.log('Contracts deployed successfully');
      return { success: true, addresses, output: stdout };

    } catch (error) {
      console.error(`Deployment failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Register as operator
   */
  async registerOperator(privateKey, stake = 32) {
    console.log(`Registering operator with ${stake} ETH stake...`);

    try {
      const command = `${this.config.devkitPath} operator register --config ${this.config.configFile} --stake ${stake}`;

      const env = {
        ...process.env,
        OPERATOR_PRIVATE_KEY: privateKey
      };

      const { stdout, stderr } = await execAsync(command, {
        cwd: this.config.workDir,
        env
      });

      if (stderr) {
        console.error(`Register stderr: ${stderr}`);
      }

      console.log('Operator registered successfully');
      return { success: true, output: stdout };

    } catch (error) {
      console.error(`Registration failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Start operator node
   */
  async startOperator(options = {}) {
    if (this.isRunning) {
      console.log('Operator already running');
      return { success: false, error: 'Operator already running' };
    }

    console.log('Starting operator node...');

    const args = ['operator', 'start', '--config', this.config.configFile];

    if (options.metrics) {
      args.push('--metrics');
    }

    if (options.port) {
      args.push('--port', options.port.toString());
    }

    try {
      this.operatorProcess = spawn(this.config.devkitPath, args, {
        cwd: this.config.workDir,
        env: {
          ...process.env,
          OPERATOR_PRIVATE_KEY: options.privateKey || process.env.OPERATOR_PRIVATE_KEY
        }
      });

      this.operatorProcess.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`[Devkit] ${output}`);
        this.emit('log', { type: 'stdout', data: output });
      });

      this.operatorProcess.stderr.on('data', (data) => {
        const output = data.toString();
        console.error(`[Devkit Error] ${output}`);
        this.emit('log', { type: 'stderr', data: output });
      });

      this.operatorProcess.on('error', (error) => {
        console.error(`Operator process error: ${error.message}`);
        this.emit('error', error);
        this.isRunning = false;
      });

      this.operatorProcess.on('exit', (code, signal) => {
        console.log(`Operator process exited with code ${code} and signal ${signal}`);
        this.emit('exit', { code, signal });
        this.isRunning = false;
        this.operatorProcess = null;
      });

      this.isRunning = true;
      console.log('Operator node started');

      return { success: true, pid: this.operatorProcess.pid };

    } catch (error) {
      console.error(`Failed to start operator: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop operator node
   */
  async stopOperator() {
    if (!this.isRunning || !this.operatorProcess) {
      console.log('Operator not running');
      return { success: false, error: 'Operator not running' };
    }

    console.log('Stopping operator node...');

    return new Promise((resolve) => {
      this.operatorProcess.once('exit', () => {
        this.isRunning = false;
        this.operatorProcess = null;
        console.log('Operator stopped');
        resolve({ success: true });
      });

      this.operatorProcess.kill('SIGTERM');

      // Force kill after 10 seconds
      setTimeout(() => {
        if (this.operatorProcess) {
          this.operatorProcess.kill('SIGKILL');
        }
      }, 10000);
    });
  }

  /**
   * Get operator status
   */
  async getOperatorStatus() {
    try {
      const command = `${this.config.devkitPath} operator status --config ${this.config.configFile}`;
      const { stdout } = await execAsync(command, { cwd: this.config.workDir });

      const status = this.parseOperatorStatus(stdout);
      return { success: true, status };

    } catch (error) {
      console.error(`Failed to get status: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Create task
   */
  async createTask(taskType, taskData) {
    console.log(`Creating task: ${taskType}`);

    try {
      const command = `${this.config.devkitPath} task create --type ${taskType} --data '${JSON.stringify(taskData)}'`;
      const { stdout } = await execAsync(command, { cwd: this.config.workDir });

      const taskId = this.parseTaskId(stdout);
      console.log(`Task created with ID: ${taskId}`);

      return { success: true, taskId, output: stdout };

    } catch (error) {
      console.error(`Failed to create task: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get task status
   */
  async getTaskStatus(taskId) {
    try {
      const command = `${this.config.devkitPath} task status --id ${taskId}`;
      const { stdout } = await execAsync(command, { cwd: this.config.workDir });

      const status = this.parseTaskStatus(stdout);
      return { success: true, status };

    } catch (error) {
      console.error(`Failed to get task status: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Monitor AVS metrics
   */
  async startMonitoring(interval = 30000) {
    console.log('Starting AVS monitoring...');

    const monitor = async () => {
      try {
        const command = `${this.config.devkitPath} monitor --config ${this.config.configFile} --json`;
        const { stdout } = await execAsync(command, { cwd: this.config.workDir });

        const metrics = JSON.parse(stdout);
        this.emit('metrics', metrics);

        console.log('AVS Metrics:');
        console.log(`  Total Operators: ${metrics.totalOperators}`);
        console.log(`  Active Tasks: ${metrics.activeTasks}`);
        console.log(`  Consensus Rate: ${metrics.consensusRate}%`);

      } catch (error) {
        console.error(`Monitoring error: ${error.message}`);
      }
    };

    // Initial monitoring
    await monitor();

    // Set up interval
    this.monitoringInterval = setInterval(monitor, interval);

    return { success: true };
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('Monitoring stopped');
    }
  }

  /**
   * Parse deployment addresses from output
   */
  parseDeploymentAddresses(output) {
    const addresses = {};
    const lines = output.split('\n');

    for (const line of lines) {
      // Look for contract deployment lines
      const match = line.match(/(\w+)\s+deployed at:\s+(0x[a-fA-F0-9]{40})/);
      if (match) {
        addresses[match[1]] = match[2];
      }
    }

    return addresses;
  }

  /**
   * Parse operator status from output
   */
  parseOperatorStatus(output) {
    // Parse devkit status output
    // This would depend on the actual output format
    const status = {
      isActive: output.includes('active'),
      stake: null,
      tasks: {
        completed: 0,
        failed: 0,
        pending: 0
      }
    };

    // Extract stake amount
    const stakeMatch = output.match(/Stake:\s+(\d+(\.\d+)?)\s+ETH/);
    if (stakeMatch) {
      status.stake = parseFloat(stakeMatch[1]);
    }

    // Extract task counts
    const tasksMatch = output.match(/Tasks:\s+(\d+)\s+completed,\s+(\d+)\s+failed,\s+(\d+)\s+pending/);
    if (tasksMatch) {
      status.tasks.completed = parseInt(tasksMatch[1]);
      status.tasks.failed = parseInt(tasksMatch[2]);
      status.tasks.pending = parseInt(tasksMatch[3]);
    }

    return status;
  }

  /**
   * Parse task ID from creation output
   */
  parseTaskId(output) {
    const match = output.match(/Task created with ID:\s+(\d+)/);
    return match ? match[1] : null;
  }

  /**
   * Parse task status from output
   */
  parseTaskStatus(output) {
    return {
      status: output.includes('completed') ? 'completed' :
              output.includes('pending') ? 'pending' : 'failed',
      responseCount: 0,
      consensusAchieved: output.includes('consensus achieved')
    };
  }

  /**
   * Generate AVS configuration file
   */
  async generateConfig(options) {
    const config = {
      name: options.name || 'ccr-hook-avs',
      version: options.version || '1.0.0',
      type: 'avs',
      network: options.network || 'sepolia',
      framework: 'foundry',

      service: {
        name: 'CCRServiceManager',
        registry: options.registryAddress || '0x0000000000000000000000000000000000000000'
      },

      operators: {
        minOperators: options.minOperators || 3,
        maxOperators: options.maxOperators || 21,
        minStake: options.minStake || '32000000000000000000',
        quorumThreshold: options.quorumThreshold || 66
      },

      tasks: [
        {
          name: 'computePCS',
          type: 'offchain_compute',
          timeout: 30,
          gasLimit: 500000
        },
        {
          name: 'computePRS',
          type: 'offchain_compute',
          timeout: 20,
          gasLimit: 400000
        }
      ],

      endpoints: {
        rpc: options.rpcUrl || process.env.RPC_URL,
        eigenlayer: {
          slasher: options.slasherAddress,
          delegation: options.delegationAddress,
          strategy: options.strategyAddress
        }
      }
    };

    const configPath = path.join(this.config.workDir, 'avs.config.yaml');
    const yaml = require('js-yaml');
    await fs.writeFile(configPath, yaml.dump(config));

    console.log(`Configuration saved to: ${configPath}`);
    return configPath;
  }

  /**
   * Run devkit command
   */
  async runCommand(command, args = []) {
    const fullCommand = `${this.config.devkitPath} ${command} ${args.join(' ')}`;
    console.log(`Running: ${fullCommand}`);

    try {
      const { stdout, stderr } = await execAsync(fullCommand, {
        cwd: this.config.workDir
      });

      if (stderr) {
        console.error(`Command stderr: ${stderr}`);
      }

      return { success: true, stdout, stderr };

    } catch (error) {
      console.error(`Command failed: ${error.message}`);
      return { success: false, error: error.message };
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    console.log('Cleaning up Devkit integration...');

    if (this.isRunning) {
      await this.stopOperator();
    }

    this.stopMonitoring();
    this.removeAllListeners();

    console.log('Cleanup complete');
  }
}

module.exports = DevkitIntegration;