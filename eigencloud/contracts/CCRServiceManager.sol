// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title CCRServiceManager
 * @notice EigenLayer AVS Service Manager for CCR Hook attestations
 * @dev Manages operator registration, task creation, and response aggregation
 */
contract CCRServiceManager is Ownable, Pausable {
    using ECDSA for bytes32;

    // ============ Constants ============
    uint256 public constant MIN_OPERATORS = 3;
    uint256 public constant QUORUM_THRESHOLD_PERCENTAGE = 66;
    uint256 public constant TASK_CHALLENGE_WINDOW = 1 hours;
    uint256 public constant MAX_TASK_DURATION = 5 minutes;

    // ============ Structs ============

    struct Operator {
        address operatorAddress;
        uint256 stake;
        bool isActive;
        uint256 registeredAt;
        uint256 lastResponseTime;
        uint256 successfulResponses;
        uint256 failedResponses;
        bytes blsPublicKey;
    }

    struct Task {
        uint256 taskId;
        TaskType taskType;
        bytes taskData;
        uint256 createdAt;
        uint256 respondedAt;
        TaskStatus status;
        address requester;
        bytes32 responseHash;
        uint256 quorumAchieved;
    }

    struct TaskResponse {
        uint256 taskId;
        address operator;
        bytes response;
        bytes signature;
        uint256 timestamp;
    }

    enum TaskType {
        COMPUTE_PCS,
        COMPUTE_PRS,
        BATCH_ATTESTATION,
        VERIFY_COMPUTATION
    }

    enum TaskStatus {
        PENDING,
        PROCESSING,
        COMPLETED,
        FAILED,
        CHALLENGED
    }

    // ============ State Variables ============

    // Operator management
    mapping(address => Operator) public operators;
    address[] public operatorList;
    uint256 public totalOperators;
    uint256 public totalStake;

    // Task management
    mapping(uint256 => Task) public tasks;
    mapping(uint256 => TaskResponse[]) public taskResponses;
    mapping(uint256 => mapping(address => bool)) public hasOperatorResponded;
    uint256 public nextTaskId;

    // Quorum management
    mapping(uint256 => bytes32) public taskQuorumResponses;
    mapping(uint256 => uint256) public taskResponseCounts;

    // Slashing conditions
    mapping(address => uint256) public operatorSlashings;
    uint256 public slashingPercentage = 10; // 10% slash for malicious behavior

    // Registry addresses (EigenLayer integration)
    address public registryCoordinator;
    address public stakeRegistry;
    address public avsDirectory;

    // ============ Events ============

    event OperatorRegistered(address indexed operator, uint256 stake);
    event OperatorDeregistered(address indexed operator);
    event OperatorSlashed(address indexed operator, uint256 amount, string reason);

    event TaskCreated(uint256 indexed taskId, TaskType taskType, address requester);
    event TaskResponded(uint256 indexed taskId, address indexed operator);
    event TaskCompleted(uint256 indexed taskId, bytes32 responseHash);
    event TaskFailed(uint256 indexed taskId, string reason);
    event TaskChallenged(uint256 indexed taskId, address challenger);

    event QuorumAchieved(uint256 indexed taskId, uint256 responseCount, uint256 threshold);

    // ============ Modifiers ============

    modifier onlyOperator() {
        require(operators[msg.sender].isActive, "Not an active operator");
        _;
    }

    modifier onlyRegistryCoordinator() {
        require(msg.sender == registryCoordinator, "Only registry coordinator");
        _;
    }

    modifier taskExists(uint256 taskId) {
        require(tasks[taskId].createdAt > 0, "Task does not exist");
        _;
    }

    modifier taskPending(uint256 taskId) {
        require(tasks[taskId].status == TaskStatus.PENDING, "Task not pending");
        _;
    }

    // ============ Constructor ============

    constructor(
        address _owner,
        address _registryCoordinator,
        address _stakeRegistry,
        address _avsDirectory
    ) Ownable(_owner) {
        registryCoordinator = _registryCoordinator;
        stakeRegistry = _stakeRegistry;
        avsDirectory = _avsDirectory;
    }

    // ============ Operator Management ============

    /**
     * @notice Register a new operator
     * @param operatorAddress Address of the operator
     * @param blsPublicKey BLS public key for signature aggregation
     * @param stake Initial stake amount
     */
    function registerOperator(
        address operatorAddress,
        bytes calldata blsPublicKey,
        uint256 stake
    ) external onlyRegistryCoordinator {
        require(!operators[operatorAddress].isActive, "Operator already registered");
        require(stake >= 32 ether, "Insufficient stake");

        operators[operatorAddress] = Operator({
            operatorAddress: operatorAddress,
            stake: stake,
            isActive: true,
            registeredAt: block.timestamp,
            lastResponseTime: 0,
            successfulResponses: 0,
            failedResponses: 0,
            blsPublicKey: blsPublicKey
        });

        operatorList.push(operatorAddress);
        totalOperators++;
        totalStake += stake;

        emit OperatorRegistered(operatorAddress, stake);
    }

    /**
     * @notice Deregister an operator
     * @param operatorAddress Address of the operator to deregister
     */
    function deregisterOperator(address operatorAddress) external onlyRegistryCoordinator {
        require(operators[operatorAddress].isActive, "Operator not registered");

        operators[operatorAddress].isActive = false;
        totalOperators--;
        totalStake -= operators[operatorAddress].stake;

        // Remove from operator list
        for (uint256 i = 0; i < operatorList.length; i++) {
            if (operatorList[i] == operatorAddress) {
                operatorList[i] = operatorList[operatorList.length - 1];
                operatorList.pop();
                break;
            }
        }

        emit OperatorDeregistered(operatorAddress);
    }

    // ============ Task Management ============

    /**
     * @notice Create a new computation task
     * @param taskType Type of task to create
     * @param taskData Encoded task data
     * @return taskId The ID of the created task
     */
    function createTask(
        TaskType taskType,
        bytes calldata taskData
    ) external whenNotPaused returns (uint256 taskId) {
        require(totalOperators >= MIN_OPERATORS, "Insufficient operators");

        taskId = nextTaskId++;

        tasks[taskId] = Task({
            taskId: taskId,
            taskType: taskType,
            taskData: taskData,
            createdAt: block.timestamp,
            respondedAt: 0,
            status: TaskStatus.PENDING,
            requester: msg.sender,
            responseHash: bytes32(0),
            quorumAchieved: 0
        });

        emit TaskCreated(taskId, taskType, msg.sender);
        return taskId;
    }

    /**
     * @notice Submit a response to a task
     * @param taskId ID of the task
     * @param response Response data
     * @param signature Operator's signature
     */
    function respondToTask(
        uint256 taskId,
        bytes calldata response,
        bytes calldata signature
    ) external onlyOperator taskExists(taskId) taskPending(taskId) {
        require(!hasOperatorResponded[taskId][msg.sender], "Already responded");
        require(
            block.timestamp <= tasks[taskId].createdAt + MAX_TASK_DURATION,
            "Task expired"
        );

        // Verify signature
        bytes32 messageHash = keccak256(abi.encodePacked(taskId, response));
        address signer = messageHash.toEthSignedMessageHash().recover(signature);
        require(signer == msg.sender, "Invalid signature");

        // Store response
        taskResponses[taskId].push(TaskResponse({
            taskId: taskId,
            operator: msg.sender,
            response: response,
            signature: signature,
            timestamp: block.timestamp
        }));

        hasOperatorResponded[taskId][msg.sender] = true;

        // Update operator stats
        operators[msg.sender].lastResponseTime = block.timestamp;

        // Track response for quorum
        bytes32 responseHash = keccak256(response);
        taskResponseCounts[uint256(responseHash)]++;

        emit TaskResponded(taskId, msg.sender);

        // Check if quorum is achieved
        _checkQuorum(taskId, responseHash);
    }

    /**
     * @notice Check if quorum is achieved for a task
     * @param taskId ID of the task
     * @param responseHash Hash of the response to check
     */
    function _checkQuorum(uint256 taskId, bytes32 responseHash) internal {
        uint256 responseCount = taskResponseCounts[uint256(responseHash)];
        uint256 requiredQuorum = (totalOperators * QUORUM_THRESHOLD_PERCENTAGE) / 100;

        if (responseCount >= requiredQuorum) {
            tasks[taskId].status = TaskStatus.COMPLETED;
            tasks[taskId].responseHash = responseHash;
            tasks[taskId].respondedAt = block.timestamp;
            tasks[taskId].quorumAchieved = responseCount;

            // Update operator success counts
            TaskResponse[] memory responses = taskResponses[taskId];
            for (uint256 i = 0; i < responses.length; i++) {
                if (keccak256(responses[i].response) == responseHash) {
                    operators[responses[i].operator].successfulResponses++;
                }
            }

            emit QuorumAchieved(taskId, responseCount, requiredQuorum);
            emit TaskCompleted(taskId, responseHash);
        }
    }

    /**
     * @notice Challenge a task response
     * @param taskId ID of the task to challenge
     * @param evidence Evidence of incorrect computation
     */
    function challengeTask(
        uint256 taskId,
        bytes calldata evidence
    ) external taskExists(taskId) {
        require(tasks[taskId].status == TaskStatus.COMPLETED, "Task not completed");
        require(
            block.timestamp <= tasks[taskId].respondedAt + TASK_CHALLENGE_WINDOW,
            "Challenge window expired"
        );

        tasks[taskId].status = TaskStatus.CHALLENGED;

        // In production, this would trigger a dispute resolution process
        // For now, we emit an event for off-chain handling
        emit TaskChallenged(taskId, msg.sender);
    }

    /**
     * @notice Slash an operator for malicious behavior
     * @param operator Address of the operator to slash
     * @param reason Reason for slashing
     */
    function slashOperator(
        address operator,
        string calldata reason
    ) external onlyOwner {
        require(operators[operator].isActive, "Operator not active");

        uint256 slashAmount = (operators[operator].stake * slashingPercentage) / 100;
        operators[operator].stake -= slashAmount;
        operatorSlashings[operator] += slashAmount;

        // If stake falls below minimum, deregister operator
        if (operators[operator].stake < 32 ether) {
            operators[operator].isActive = false;
            totalOperators--;
        }

        totalStake -= slashAmount;

        emit OperatorSlashed(operator, slashAmount, reason);
    }

    // ============ View Functions ============

    /**
     * @notice Get task details
     * @param taskId ID of the task
     * @return task Task struct
     */
    function getTask(uint256 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    /**
     * @notice Get task responses
     * @param taskId ID of the task
     * @return responses Array of task responses
     */
    function getTaskResponses(uint256 taskId) external view returns (TaskResponse[] memory) {
        return taskResponses[taskId];
    }

    /**
     * @notice Get operator details
     * @param operator Address of the operator
     * @return Operator struct
     */
    function getOperator(address operator) external view returns (Operator memory) {
        return operators[operator];
    }

    /**
     * @notice Get all active operators
     * @return Array of active operator addresses
     */
    function getActiveOperators() external view returns (address[] memory) {
        uint256 activeCount = 0;
        for (uint256 i = 0; i < operatorList.length; i++) {
            if (operators[operatorList[i]].isActive) {
                activeCount++;
            }
        }

        address[] memory activeOperators = new address[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < operatorList.length; i++) {
            if (operators[operatorList[i]].isActive) {
                activeOperators[index++] = operatorList[i];
            }
        }

        return activeOperators;
    }

    /**
     * @notice Check if quorum is achieved for a response
     * @param taskId ID of the task
     * @param responseHash Hash of the response
     * @return bool True if quorum is achieved
     */
    function isQuorumAchieved(uint256 taskId, bytes32 responseHash) external view returns (bool) {
        uint256 responseCount = taskResponseCounts[uint256(responseHash)];
        uint256 requiredQuorum = (totalOperators * QUORUM_THRESHOLD_PERCENTAGE) / 100;
        return responseCount >= requiredQuorum;
    }

    // ============ Admin Functions ============

    /**
     * @notice Update registry addresses
     * @param _registryCoordinator New registry coordinator address
     * @param _stakeRegistry New stake registry address
     * @param _avsDirectory New AVS directory address
     */
    function updateRegistryAddresses(
        address _registryCoordinator,
        address _stakeRegistry,
        address _avsDirectory
    ) external onlyOwner {
        registryCoordinator = _registryCoordinator;
        stakeRegistry = _stakeRegistry;
        avsDirectory = _avsDirectory;
    }

    /**
     * @notice Update slashing percentage
     * @param _percentage New slashing percentage (0-100)
     */
    function updateSlashingPercentage(uint256 _percentage) external onlyOwner {
        require(_percentage <= 100, "Invalid percentage");
        slashingPercentage = _percentage;
    }

    /**
     * @notice Pause the contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Emergency withdraw for stuck funds
     * @param token Token address (address(0) for ETH)
     * @param amount Amount to withdraw
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (token == address(0)) {
            payable(owner()).transfer(amount);
        } else {
            // Transfer ERC20 tokens
            (bool success, ) = token.call(
                abi.encodeWithSignature("transfer(address,uint256)", owner(), amount)
            );
            require(success, "Transfer failed");
        }
    }
}