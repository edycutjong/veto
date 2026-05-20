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
@patch('agent.VAULT_ADDRESS', '')
@patch('agent.AGENT_PRIVATE_KEY', '')
def test_run_live_missing_env(mock_exit, capsys):
    mock_exit.side_effect = SystemExit(1)
    with pytest.raises(SystemExit):
        _run_live()
    mock_exit.assert_called_once_with(1)
    assert "Error: AEGIS_VAULT_ADDRESS and AGENT_PRIVATE_KEY required" in capsys.readouterr().out


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
