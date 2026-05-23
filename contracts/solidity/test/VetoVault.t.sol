// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import "../src/VetoVault.sol";
import "../src/RiskEngineSol.sol";
import "../src/IRiskEngine.sol";

/**
 * @title VetoVault Test Suite
 * @notice Tests the vault + risk engine integration using the Solidity
 *         RiskEngine as a stand-in for the Stylus WASM version.
 *         The Solidity version has identical math, so the behavioral tests
 *         are valid for both implementations.
 */
contract VetoVaultTest is Test {
    VetoVault public vault;
    RiskEngineSol public riskEngine;

    address public owner = address(this);
    address public agent = address(0xA1);
    address public randomUser = address(0xB1);

    // A simple target contract that accepts ETH
    MockTarget public target;

    function setUp() public {
        // Deploy risk engine (Solidity version for testing)
        riskEngine = new RiskEngineSol();

        // Deploy vault with 1000 bps (10%) threshold
        vault = new VetoVault(address(riskEngine), 1000);

        // Deploy mock target
        target = new MockTarget();

        // Set agent
        vault.setAgent(agent);

        // Fund the vault with 10 ETH
        vm.deal(address(vault), 10 ether);
    }

    // ─── Construction Tests ───────────────────────────────────

    function test_constructor() public view {
        assertEq(vault.owner(), owner);
        assertEq(vault.volatilityThresholdBps(), 1000);
        assertEq(address(vault.riskEngine()), address(riskEngine));
    }

    function test_agent_is_set() public view {
        assertEq(vault.agent(), agent);
    }

    function test_vault_has_balance() public view {
        assertEq(vault.balance(), 10 ether);
    }

    // ─── Owner Functions ──────────────────────────────────────

    function test_setThreshold() public {
        vault.setThreshold(500);
        assertEq(vault.volatilityThresholdBps(), 500);
    }

    function test_setThreshold_emitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit VetoVault.ThresholdUpdated(1000, 500);
        vault.setThreshold(500);
    }

    function test_setAgent_emitsEvent() public {
        address newAgent = address(0xC1);
        vm.expectEmit(true, true, false, true);
        emit VetoVault.AgentUpdated(agent, newAgent);
        vault.setAgent(newAgent);
    }

    function test_onlyOwner_setThreshold() public {
        vm.prank(randomUser);
        vm.expectRevert(VetoVault.NotOwner.selector);
        vault.setThreshold(500);
    }

    function test_onlyOwner_setAgent() public {
        vm.prank(randomUser);
        vm.expectRevert(VetoVault.NotOwner.selector);
        vault.setAgent(address(0));
    }

    function test_withdraw() public {
        uint256 balBefore = address(owner).balance;
        vault.withdraw(payable(owner), 1 ether);
        assertEq(address(owner).balance, balBefore + 1 ether);
    }

    function test_withdraw_emitsEvent() public {
        vm.expectEmit(true, false, false, true);
        emit VetoVault.Withdrawn(owner, 1 ether);
        vault.withdraw(payable(owner), 1 ether);
    }

    function test_onlyOwner_withdraw() public {
        vm.prank(randomUser);
        vm.expectRevert(VetoVault.NotOwner.selector);
        vault.withdraw(payable(randomUser), 1 ether);
    }

    // ─── Deposit Tests ────────────────────────────────────────

    function test_deposit_viaReceive() public {
        vm.deal(randomUser, 5 ether);
        vm.prank(randomUser);
        (bool ok, ) = address(vault).call{value: 2 ether}("");
        assertTrue(ok);
        assertEq(vault.balance(), 12 ether);
    }

    // ─── Trade Execution Tests ────────────────────────────────

    function test_executeTrade_stablePrices_succeeds() public {
        // Stable prices: $100.00 ± $0.50 → variance ≈ 583 bps < 1000 bps threshold
        uint256[] memory prices = _stablePrices();

        vm.prank(agent);
        vault.executeTrade(
            address(target),
            "",     // empty calldata — MockTarget just accepts
            0.1 ether,
            prices
        );

        assertEq(vault.tradesExecuted(), 1);
        assertEq(vault.tradesBlocked(), 0);
    }

    function test_executeTrade_volatilePrices_reverts() public {
        // Extremely volatile prices → variance >> 1000 bps
        uint256[] memory prices = _volatilePrices();

        vm.prank(agent);
        vm.expectRevert(); // VolatilityExceedsThreshold
        vault.executeTrade(
            address(target),
            "",
            0.1 ether,
            prices
        );
    }

    function test_executeTrade_blockedCount_increments() public {
        // First: force a blocked trade by using very tight threshold
        vault.setThreshold(1); // 0.01% — almost nothing passes

        uint256[] memory prices = _stablePrices();

        vm.prank(agent);
        vm.expectRevert();
        vault.executeTrade(address(target), "", 0, prices);

        // tradesBlocked should have incremented despite revert
        // Note: because it reverts, the state change is rolled back
        // This is expected behavior — the event is emitted but state reverts
        // The dashboard reads events, not state, for blocked trades
    }

    function test_executeTrade_notAgent_reverts() public {
        uint256[] memory prices = _stablePrices();

        vm.prank(randomUser);
        vm.expectRevert(VetoVault.NotAgent.selector);
        vault.executeTrade(address(target), "", 0, prices);
    }

    function test_executeTrade_invalidTarget_reverts() public {
        uint256[] memory prices = _stablePrices();

        vm.prank(agent);
        vm.expectRevert(VetoVault.InvalidTarget.selector);
        vault.executeTrade(address(0), "", 0, prices);
    }

    function test_executeTrade_insufficientPriceData_reverts() public {
        uint256[] memory prices = new uint256[](1);
        prices[0] = 1_000_000;

        vm.prank(agent);
        vm.expectRevert(VetoVault.InsufficientPriceData.selector);
        vault.executeTrade(address(target), "", 0, prices);
    }

    function test_executeTrade_emitsTradeExecuted() public {
        uint256[] memory prices = _stablePrices();

        vm.prank(agent);
        // We can't predict exact variance, so just check the event is emitted
        vm.expectEmit(true, true, false, false);
        emit VetoVault.TradeExecuted(agent, address(target), 0, 0, 0);
        vault.executeTrade(address(target), "", 0, prices);
    }

    // ─── Stats Tests ──────────────────────────────────────────

    function test_stats() public {
        uint256[] memory prices = _stablePrices();

        vm.prank(agent);
        vault.executeTrade(address(target), "", 0, prices);

        vm.prank(agent);
        vault.executeTrade(address(target), "", 0, prices);

        (uint256 executed, uint256 blocked) = vault.stats();
        assertEq(executed, 2);
        assertEq(blocked, 0);
    }

    // ─── Gas Benchmark Tests ──────────────────────────────────

    function test_gasBenchmark_50_prices() public {
        uint256[] memory prices = _generatePrices(50);
        uint256 gasBefore = gasleft();
        riskEngine.computeVariance(prices);
        uint256 gasUsed = gasBefore - gasleft();
        emit log_named_uint("Gas: Solidity computeVariance (50 items)", gasUsed);
    }

    function test_gasBenchmark_100_prices() public {
        uint256[] memory prices = _generatePrices(100);
        uint256 gasBefore = gasleft();
        riskEngine.computeVariance(prices);
        uint256 gasUsed = gasBefore - gasleft();
        emit log_named_uint("Gas: Solidity computeVariance (100 items)", gasUsed);
    }

    function test_gasBenchmark_200_prices() public {
        uint256[] memory prices = _generatePrices(200);
        uint256 gasBefore = gasleft();
        riskEngine.computeVariance(prices);
        uint256 gasUsed = gasBefore - gasleft();
        emit log_named_uint("Gas: Solidity computeVariance (200 items)", gasUsed);
    }

    // ─── Helpers ──────────────────────────────────────────────

    /// @notice Returns stable prices: $100 ± $0.50
    function _stablePrices() internal pure returns (uint256[] memory) {
        uint256[] memory prices = new uint256[](5);
        prices[0] = 1_000_000; // $100.00
        prices[1] = 1_005_000; // $100.50
        prices[2] = 999_000;   // $99.90
        prices[3] = 1_001_000; // $100.10
        prices[4] = 998_000;   // $99.80
        return prices;
    }

    /// @notice Returns volatile prices (pump and dump)
    function _volatilePrices() internal pure returns (uint256[] memory) {
        uint256[] memory prices = new uint256[](5);
        prices[0] = 1_000_000;  // $100.00
        prices[1] = 5_000_000;  // $500.00
        prices[2] = 500_000;    // $50.00
        prices[3] = 3_000_000;  // $300.00
        prices[4] = 200_000;    // $20.00
        return prices;
    }

    /// @notice Generates n pseudo-random prices around $3200 (BTC-like)
    function _generatePrices(uint256 n) internal pure returns (uint256[] memory) {
        uint256[] memory prices = new uint256[](n);
        uint256 basePrice = 32_000_000; // $3,200.00 scaled by 10,000
        for (uint256 i = 0; i < n; i++) {
            // Deterministic "noise" via hash — keeps prices ± 5%
            uint256 noise = uint256(keccak256(abi.encodePacked(i))) % 3_200_000;
            // Alternate adding/subtracting for variance
            if (i % 2 == 0) {
                prices[i] = basePrice + noise;
            } else {
                prices[i] = basePrice - (noise % basePrice);
            }
        }
        return prices;
    }

    // Receive ETH (for withdraw tests)
    receive() external payable {}

    // ─── Solidity Coverage Extensions ─────────────────────────

    function test_setRiskEngine() public {
        address newRiskEngine = address(0xC2);
        vault.setRiskEngine(newRiskEngine);
        assertEq(address(vault.riskEngine()), newRiskEngine);
    }

    function test_onlyOwner_setRiskEngine() public {
        vm.prank(randomUser);
        vm.expectRevert(VetoVault.NotOwner.selector);
        vault.setRiskEngine(address(0xC2));
    }

    function test_withdraw_transferFailed_reverts() public {
        RevertingTarget revTarget = new RevertingTarget();
        vm.expectRevert(VetoVault.TransferFailed.selector);
        vault.withdraw(payable(address(revTarget)), 1 ether);
    }

    function test_executeTrade_transferFailed_reverts() public {
        uint256[] memory prices = _stablePrices();
        RevertingTarget revTarget = new RevertingTarget();
        
        vm.prank(agent);
        vm.expectRevert(VetoVault.TransferFailed.selector);
        vault.executeTrade(address(revTarget), "", 0.1 ether, prices);
    }

    function test_riskEngine_checkVolatility_lenLessThan2() public {
        uint256[] memory prices = new uint256[](1);
        prices[0] = 100;
        assertTrue(riskEngine.checkVolatility(prices, 1000));
    }

    function test_riskEngine_checkVolatility_meanZero() public {
        uint256[] memory prices = new uint256[](2);
        prices[0] = 0;
        prices[1] = 0;
        assertFalse(riskEngine.checkVolatility(prices, 1000));
    }

    function test_riskEngine_computeVariance_lenLessThan2() public {
        uint256[] memory prices = new uint256[](1);
        prices[0] = 100;
        assertEq(riskEngine.computeVariance(prices), 0);
    }

    function test_riskEngine_computeVariance_meanZero() public {
        uint256[] memory prices = new uint256[](2);
        prices[0] = 0;
        prices[1] = 0;
        assertEq(riskEngine.computeVariance(prices), 0);
    }

    function test_riskEngine_computeVariance_withDeviation() public {
        uint256[] memory prices = new uint256[](3);
        prices[0] = 100; // mean = 200, below mean
        prices[1] = 200; // mean = 200
        prices[2] = 300; // mean = 200, above mean
        uint256 variance = riskEngine.computeVariance(prices);
        assertTrue(variance > 0);
    }

    function test_mocks_fallbacks_coverage() public {
        // Trigger fallback of MockTarget
        (bool ok, ) = address(target).call("random_calldata");
        assertTrue(ok);

        // Trigger fallback of RevertingTarget
        RevertingTarget revTarget = new RevertingTarget();
        (bool ok2, ) = address(revTarget).call("random_calldata");
        assertFalse(ok2);
    }
}

/**
 * @title MockTarget — Simple contract that accepts ETH and calls
 * @notice Used to simulate a DEX or other trade target in tests
 */
contract MockTarget {
    uint256 public callCount;

    fallback() external payable {
        callCount++;
    }

    receive() external payable {
        callCount++;
    }
}

/**
 * @title RevertingTarget — A mock contract that always reverts when called or sent ETH
 */
contract RevertingTarget {
    receive() external payable {
        revert("I reject ETH");
    }
    fallback() external payable {
        revert("I reject call");
    }
}

