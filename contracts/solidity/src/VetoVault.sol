// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IRiskEngine} from "./IRiskEngine.sol";

/**
 * @title VetoVault — Hybrid EVM/WASM Execution Sandbox
 * @notice A smart vault that holds funds and delegates risk computation to a
 *         Stylus (WASM) coprocessor contract. AI agents can only execute trades
 *         that pass the on-chain variance check.
 *
 * Architecture:
 *   ┌─────────────┐     ┌──────────────┐     ┌──────────────┐
 *   │  AI Agent    │────▶│ VetoVault   │────▶│ RiskEngine   │
 *   │  (Python)    │     │ (EVM-Funds)  │     │ (WASM-Math)  │
 *   └─────────────┘     └──────────────┘     └──────────────┘
 *
 * @dev The vault owner sets a volatility threshold in basis points.
 *      When the agent submits a trade, it includes historical price data.
 *      The vault forwards the prices to the Stylus contract for variance
 *      computation. If variance > threshold → REVERT. Funds stay safe.
 */
contract VetoVault {
    // ─── Errors ───────────────────────────────────────────────
    
    /// @notice Thrown when the Stylus risk engine determines asset is too volatile
    /// @param computedBps The computed variance in basis points
    /// @param thresholdBps The maximum allowed variance in basis points
    error VolatilityExceedsThreshold(uint256 computedBps, uint256 thresholdBps);
    
    /// @notice Thrown when a non-owner tries to call owner-only functions
    error NotOwner();
    
    /// @notice Thrown when a non-agent tries to execute a trade
    error NotAgent();
    
    /// @notice Thrown when the agent is not registered (address zero)
    error AgentNotRegistered();
    
    /// @notice Thrown when the trade target address is invalid
    error InvalidTarget();
    
    /// @notice Thrown when the price array has insufficient data points
    error InsufficientPriceData();

    /// @notice Thrown when ETH transfer fails
    error TransferFailed();

    // ─── Events ───────────────────────────────────────────────

    /// @notice Emitted when a trade is successfully executed
    event TradeExecuted(
        address indexed agent,
        address indexed target,
        uint256 value,
        uint256 variance,
        uint256 threshold
    );

    /// @notice Emitted when a trade is blocked by the risk engine
    event TradeBlocked(
        address indexed agent,
        address indexed target,
        uint256 value,
        uint256 variance,
        uint256 threshold
    );

    /// @notice Emitted when the volatility threshold is updated
    event ThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    /// @notice Emitted when the agent address is updated
    event AgentUpdated(address indexed oldAgent, address indexed newAgent);

    /// @notice Emitted when funds are deposited
    event Deposited(address indexed from, uint256 amount);

    /// @notice Emitted when the owner withdraws funds
    event Withdrawn(address indexed to, uint256 amount);

    // ─── State ────────────────────────────────────────────────

    /// @notice The vault owner (human who sets the rules)
    address public owner;

    /// @notice The AI agent authorized to propose trades
    address public agent;

    /// @notice The Stylus risk engine contract address
    IRiskEngine public riskEngine;

    /// @notice Maximum allowed variance in basis points (e.g., 500 = 5%)
    uint256 public volatilityThresholdBps;

    /// @notice Total number of trades executed successfully
    uint256 public tradesExecuted;

    /// @notice Total number of trades blocked by the risk engine
    uint256 public tradesBlocked;

    // ─── Modifiers ────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────

    /**
     * @notice Initialize the vault with a risk engine and default threshold
     * @param _riskEngine Address of the deployed Stylus RiskEngine contract
     * @param _thresholdBps Initial volatility threshold in basis points
     */
    constructor(address _riskEngine, uint256 _thresholdBps) {
        owner = msg.sender;
        riskEngine = IRiskEngine(_riskEngine);
        volatilityThresholdBps = _thresholdBps;
    }

    // ─── Owner Functions ──────────────────────────────────────

    /**
     * @notice Set the AI agent address authorized to propose trades
     * @param _agent The agent's EOA or contract address
     */
    function setAgent(address _agent) external onlyOwner {
        address old = agent;
        agent = _agent;
        emit AgentUpdated(old, _agent);
    }

    /**
     * @notice Update the volatility threshold
     * @param _thresholdBps New threshold in basis points
     */
    function setThreshold(uint256 _thresholdBps) external onlyOwner {
        uint256 old = volatilityThresholdBps;
        volatilityThresholdBps = _thresholdBps;
        emit ThresholdUpdated(old, _thresholdBps);
    }

    /**
     * @notice Update the risk engine contract address
     * @param _riskEngine New Stylus RiskEngine address
     */
    function setRiskEngine(address _riskEngine) external onlyOwner {
        riskEngine = IRiskEngine(_riskEngine);
    }

    /**
     * @notice Withdraw ETH from the vault (owner only)
     * @param to Destination address
     * @param amount Amount in wei
     */
    function withdraw(address payable to, uint256 amount) external onlyOwner {
        (bool success, ) = to.call{value: amount}("");
        if (!success) revert TransferFailed();
        emit Withdrawn(to, amount);
    }

    // ─── Agent Functions ──────────────────────────────────────

    /**
     * @notice Execute a trade on behalf of the vault, subject to risk check
     * @dev The agent submits the target contract, calldata, value, AND the
     *      historical price array. The vault forwards prices to the Stylus
     *      risk engine. If variance exceeds threshold → REVERT.
     *
     * Flow:
     *   1. Agent calls executeTrade(target, data, value, prices)
     *   2. Vault calls riskEngine.checkVolatility(prices, threshold)
     *   3. If Stylus returns false → emit TradeBlocked + revert
     *   4. If Stylus returns true → execute the trade → emit TradeExecuted
     *
     * @param target The contract to call (e.g., DEX router)
     * @param data The calldata for the trade (e.g., swap function)
     * @param value The ETH value to send with the trade
     * @param prices Historical price array (fixed-point, scaled by 10,000)
     */
    function executeTrade(
        address target,
        bytes calldata data,
        uint256 value,
        uint256[] calldata prices
    ) external onlyAgent returns (bytes memory) {
        if (target == address(0)) revert InvalidTarget();
        if (prices.length < 2) revert InsufficientPriceData();

        // ── RISK CHECK: Call the Stylus WASM coprocessor ──
        bool safe = riskEngine.checkVolatility(prices, volatilityThresholdBps);

        if (!safe) {
            // Get the computed variance for the error/event
            uint256 computedVariance = riskEngine.lastVariance();
            tradesBlocked++;
            
            emit TradeBlocked(
                msg.sender,
                target,
                value,
                computedVariance,
                volatilityThresholdBps
            );

            revert VolatilityExceedsThreshold(
                computedVariance,
                volatilityThresholdBps
            );
        }

        // ── TRADE EXECUTION: Variance within threshold ──
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) revert TransferFailed();

        tradesExecuted++;

        emit TradeExecuted(
            msg.sender,
            target,
            value,
            riskEngine.lastVariance(),
            volatilityThresholdBps
        );

        return result;
    }

    // ─── View Functions ───────────────────────────────────────

    /**
     * @notice Get the vault's ETH balance
     */
    function balance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Get vault stats (trades executed, trades blocked)
     */
    function stats() external view returns (uint256 executed, uint256 blocked) {
        return (tradesExecuted, tradesBlocked);
    }

    // ─── Receive ──────────────────────────────────────────────

    /// @notice Accept ETH deposits
    receive() external payable {
        emit Deposited(msg.sender, msg.value);
    }
}
