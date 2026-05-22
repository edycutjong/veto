import pytest
from unittest.mock import patch, MagicMock

import sys
import os

# Add parent directory to path so we can import modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from price_fetcher import fetch_live_prices, get_prices_for_trade
from config import DEMO_STABLE_PRICES_USD, DEMO_VOLATILE_PRICES_USD


def test_fetch_live_prices_success():
    with patch("price_fetcher.requests.get") as mock_get:
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "prices": [[1000, 10.0], [2000, 20.0]]
        }
        mock_get.return_value = mock_response

        prices = fetch_live_prices("ethereum", days=1, num_points=2)
        assert prices == [10.0, 20.0]
        mock_get.assert_called_once()


import requests

def test_fetch_live_prices_fallback():
    with patch("price_fetcher.requests.get") as mock_get:
        mock_get.side_effect = requests.RequestException("API error")
        prices = fetch_live_prices()
        assert prices == DEMO_STABLE_PRICES_USD


def test_get_prices_for_trade_demo_stable():
    with patch("price_fetcher.DEMO_MODE", True):
        scaled, raw, meta = get_prices_for_trade("ethereum")
        assert raw == DEMO_STABLE_PRICES_USD
        assert meta["demo_mode"] is True
        assert not meta["asset"] == "shitcoin"


def test_get_prices_for_trade_demo_volatile():
    with patch("price_fetcher.DEMO_MODE", True):
        scaled, raw, meta = get_prices_for_trade("rugcoin")
        assert raw == DEMO_VOLATILE_PRICES_USD
        assert meta["demo_mode"] is True


def test_get_prices_for_trade_live():
    with patch("price_fetcher.DEMO_MODE", False), patch("price_fetcher.fetch_live_prices") as mock_fetch:
        mock_fetch.return_value = [100.0, 200.0, 300.0]
        scaled, raw, meta = get_prices_for_trade("bitcoin")
        
        assert raw == [100.0, 200.0, 300.0]
        assert meta["demo_mode"] is False
        assert meta["mean"] == 200.0
        assert meta["min"] == 100.0
        assert meta["max"] == 300.0
        mock_fetch.assert_called_once_with(coin_id="bitcoin")


def test_fetch_live_prices_downsampling():
    with patch("price_fetcher.requests.get") as mock_get:
        mock_response = MagicMock()
        # Generate 200 dummy prices
        dummy_prices = [[i * 1000, float(i)] for i in range(200)]
        mock_response.json.return_value = {
            "prices": dummy_prices
        }
        mock_get.return_value = mock_response

        # Request 100 points
        prices = fetch_live_prices("ethereum", days=1, num_points=100)
        assert len(prices) == 100
        # verify downsampling by checking step size
        assert prices[0] == 0.0
        assert prices[1] == 2.0  # step = 200 // 100 = 2
        assert prices[99] == 198.0


def test_fetch_live_prices_volatile_fallback():
    with patch("price_fetcher.requests.get") as mock_get:
        mock_get.side_effect = requests.RequestException("API error")
        
        # Shitcoin/volatile coin ID fallback
        prices = fetch_live_prices("shitcoin")
        assert prices == DEMO_VOLATILE_PRICES_USD

