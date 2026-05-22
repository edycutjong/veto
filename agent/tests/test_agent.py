import pytest
from unittest.mock import patch, MagicMock

import sys
import os

# Add parent directory to path so we can import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agent import banner, _run_demo_simulated, run_demo, _run_live
from config import DEMO_STABLE_PRICES_USD


@patch('agent.time.sleep')
@patch('agent.get_prices_for_trade')
def test_run_demo_simulated(mock_get_prices, mock_sleep, capsys):
    # Mock to prevent long running and control the prices returned
    mock_get_prices.side_effect = [
        ([10000, 20000, 30000], [1.0, 2.0, 3.0], {"mean": 2.0, "spread_pct": 50.0}), # Volatile run
        ([10000, 10100, 10200], [1.0, 1.01, 1.02], {"mean": 1.01, "spread_pct": 2.0}) # Stable run
    ]
    
    _run_demo_simulated()
    
    captured = capsys.readouterr()
    # Check that volatile was blocked
    assert "SCENARIO 1" in captured.out
    assert "TRANSACTION INTERCEPTED" in captured.out
    
    # Check that stable was approved
    assert "SCENARIO 2" in captured.out
    assert "TRADE EXECUTED SUCCESSFULLY" in captured.out


@patch('agent.DEMO_MODE', True)
@patch('agent._run_demo_simulated')
def test_run_demo_true(mock_sim, capsys):
    run_demo()
    assert "Running in DEMO MODE" in capsys.readouterr().out
    mock_sim.assert_called_once()


@patch('agent.DEMO_MODE', False)
@patch('agent._run_live')
def test_run_demo_false(mock_live, capsys):
    run_demo()
    mock_live.assert_called_once()


@patch('agent.sys.exit')
@patch('agent.VAULT_ADDRESS', '0x1234')
@patch('agent.AGENT_PRIVATE_KEY', '0xabcd')
@patch('agent.Web3')
def test_run_live_rpc_fail(mock_web3, mock_exit, capsys):
    mock_exit.side_effect = SystemExit(1)
    mock_w3_instance = MagicMock()
    mock_w3_instance.is_connected.return_value = False
    mock_web3.return_value = mock_w3_instance
    mock_web3.HTTPProvider = MagicMock()
    
    with pytest.raises(SystemExit):
        _run_live()
    mock_exit.assert_called_once_with(1)
    assert "Error: Cannot connect to RPC" in capsys.readouterr().out


def test_calculate_variance_bps():
    from agent import calculate_variance_bps
    assert calculate_variance_bps([]) == 0
    assert calculate_variance_bps([100]) == 0
    assert calculate_variance_bps([0, 0]) == 0
    # mean = 200, variance = 6666, variance_bps = (6666 * 100_000_000) // 40000 = 16665000
    assert calculate_variance_bps([100, 200, 300]) == 16665000


@patch('agent.sys.exit')
@patch('agent.VAULT_ADDRESS', '')
@patch('agent.AGENT_PRIVATE_KEY', '')
def test_run_live_missing_env(mock_exit, capsys):
    mock_exit.side_effect = SystemExit(1)
    with pytest.raises(SystemExit):
        _run_live()
    mock_exit.assert_called_once_with(1)
    assert "Error: VETO_VAULT_ADDRESS and AGENT_PRIVATE_KEY required" in capsys.readouterr().out


def test_print_success(capsys):
    from agent import print_success
    print_success("hello success")
    captured = capsys.readouterr()
    assert "hello success" in captured.out


@patch('agent.os.path.exists')
@patch('agent.os.makedirs')
@patch('agent.open', create=True)
@patch('agent.json.load')
@patch('agent.json.dump')
def test_log_trade_to_json_success(mock_dump, mock_load, mock_open, mock_makedirs, mock_exists):
    # public dir doesn't exist, trades file exists
    mock_exists.side_effect = lambda path: False if "public" in path else True
    mock_load.return_value = [{"id": 1, "txHash": "0xmock1"}]
    
    from agent import log_trade_to_json
    log_trade_to_json("ETH", "executed", 50, 1000, "1.0 ETH", [100.0, 101.0], "0xmock1")
    
    mock_makedirs.assert_called_once()
    mock_open.assert_called()
    mock_dump.assert_called_once()


@patch('agent.os.path.exists')
@patch('agent.open', create=True)
def test_log_trade_to_json_json_error(mock_open, mock_exists):
    mock_exists.return_value = True
    # raise exception on read open to trigger except Exception
    mock_open.side_effect = Exception("read error")
    
    from agent import log_trade_to_json
    # Should not raise exception
    log_trade_to_json("ETH", "executed", 50, 1000, "1.0 ETH", [100.0, 101.0], "0xmock1")


@patch('agent.os.path.exists')
@patch('agent.open', create=True)
@patch('agent.json.load')
@patch('agent.json.dump')
def test_log_trade_to_json_write_error(mock_dump, mock_load, mock_open, mock_exists):
    mock_exists.return_value = True
    mock_load.return_value = []
    # Make dump raise exception
    mock_dump.side_effect = Exception("write error")
    
    from agent import log_trade_to_json
    # Should not raise exception
    log_trade_to_json("ETH", "executed", 50, 1000, "1.0 ETH", [100.0, 101.0], "0xmock1")


@patch('agent.time.sleep')
@patch('agent.get_prices_for_trade')
@patch('agent.log_trade_to_json')
def test_run_demo_simulated_zero_mean(mock_log, mock_get_prices, mock_sleep, capsys):
    # Volatile run returning prices that average to 0 (to hit the zero-mean else block)
    mock_get_prices.side_effect = [
        ([0, 0, 0], [0.0, 0.0, 0.0], {"mean": 0.0, "spread_pct": 0.0}), # Volatile run
        ([10000, 10100, 10200], [1.0, 1.01, 1.02], {"mean": 1.01, "spread_pct": 2.0}) # Stable run
    ]
    _run_demo_simulated()
    captured = capsys.readouterr()
    assert "Variance 999999 bps" in captured.out


from web3.exceptions import ContractLogicError

@patch('agent.Web3')
@patch('agent.get_prices_for_trade')
@patch('agent.log_trade_to_json')
@patch('agent.calculate_variance_bps')
@patch('agent.VAULT_ADDRESS', '0x1234567890123456789012345678901234567890')
@patch('agent.AGENT_PRIVATE_KEY', '0x' + 'a'*64)
def test_run_live_all_scenarios(mock_calc_var, mock_log, mock_get_prices, mock_web3):
    # Setup Web3 mock instance
    mock_w3 = MagicMock()
    mock_w3.is_connected.return_value = True
    mock_w3.eth.chain_id = 11155111
    mock_w3.eth.gas_price = 1000000000
    mock_w3.eth.get_transaction_count.return_value = 0
    
    mock_tx_hash = MagicMock()
    mock_tx_hash.hex.return_value = "0xmockhash"
    mock_w3.eth.send_raw_transaction.return_value = mock_tx_hash
    
    # Mock receipt status 1 (success)
    mock_receipt = {"status": 1}
    mock_w3.eth.wait_for_transaction_receipt.return_value = mock_receipt
    
    mock_web3.return_value = mock_w3
    mock_web3.HTTPProvider = MagicMock()
    mock_web3.to_checksum_address = lambda x: x
    
    # Mock account EOA
    mock_account = MagicMock()
    mock_account.address = "0xagentaddress"
    mock_w3.eth.account.from_key.return_value = mock_account
    
    # Mock vault contract
    mock_vault = MagicMock()
    mock_vault.functions.volatilityThresholdBps().call.return_value = 1000
    mock_vault.functions.balance().call.return_value = 2000000000000000000
    mock_vault.functions.stats().call.return_value = [10, 5]
    
    # executeTrade build_transaction mock
    mock_tx_func = MagicMock()
    mock_tx_func.build_transaction.return_value = {"to": "0x123"}
    mock_vault.functions.executeTrade.return_value = mock_tx_func
    
    mock_w3.eth.contract.return_value = mock_vault
    
    # Mock prices for trade: volatile then stable
    mock_get_prices.side_effect = [
        ([50000, 10000], [5.0, 1.0], {"mean": 3.0, "spread_pct": 133.3}), # volatile
        ([10000, 10100], [1.0, 1.01], {"mean": 1.005, "spread_pct": 1.0}) # stable
    ]
    
    mock_calc_var.return_value = 500
    
    # Run 1: Normal success receipts
    _run_live()
    
    # Run 2: Receipts indicating reverted on-chain (status 0)
    mock_receipt_fail = {"status": 0}
    mock_w3.eth.wait_for_transaction_receipt.side_effect = [mock_receipt_fail, mock_receipt_fail]
    mock_get_prices.side_effect = [
        ([50000, 10000], [5.0, 1.0], {"mean": 3.0, "spread_pct": 133.3}), # volatile
        ([10000, 10100], [1.0, 1.01], {"mean": 1.005, "spread_pct": 1.0}) # stable
    ]
    _run_live()

    # Run 3: ContractLogicError containing "VolatilityExceedsThreshold"
    mock_tx_func_fail = MagicMock()
    mock_tx_func_fail.build_transaction.side_effect = ContractLogicError("execution reverted: VolatilityExceedsThreshold(5000, 1000)")
    mock_vault.functions.executeTrade.return_value = mock_tx_func_fail
    mock_get_prices.side_effect = [
        ([50000, 10000], [5.0, 1.0], {"mean": 3.0, "spread_pct": 133.3}), # volatile
        ([10000, 10100], [1.0, 1.01], {"mean": 1.005, "spread_pct": 1.0}) # stable
    ]
    _run_live()

    # Run 3.5: ContractLogicError without "VolatilityExceedsThreshold"
    mock_tx_func_fail_other = MagicMock()
    mock_tx_func_fail_other.build_transaction.side_effect = ContractLogicError("execution reverted: InsufficientFunds")
    mock_vault.functions.executeTrade.return_value = mock_tx_func_fail_other
    mock_get_prices.side_effect = [
        ([50000, 10000], [5.0, 1.0], {"mean": 3.0, "spread_pct": 133.3}), # volatile
        ([10000, 10100], [1.0, 1.01], {"mean": 1.005, "spread_pct": 1.0}) # stable
    ]
    _run_live()

    # Run 4: General Exception
    mock_tx_func_error = MagicMock()
    mock_tx_func_error.build_transaction.side_effect = Exception("network error")
    mock_vault.functions.executeTrade.return_value = mock_tx_func_error
    mock_get_prices.side_effect = [
        ([50000, 10000], [5.0, 1.0], {"mean": 3.0, "spread_pct": 133.3}), # volatile
        ([10000, 10100], [1.0, 1.01], {"mean": 1.005, "spread_pct": 1.0}) # stable
    ]
    _run_live()

