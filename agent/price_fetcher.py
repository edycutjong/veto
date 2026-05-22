"""
Veto Price Fetcher
Fetches historical price data from CoinGecko and formats it for on-chain consumption.

In DEMO_MODE, uses hardcoded price sets instead of live API calls.
"""

import requests
import time
from config import (
    COINGECKO_API_URL,
    DEMO_MODE,
    DEMO_STABLE_PRICES_USD,
    DEMO_VOLATILE_PRICES_USD,
    PRICE_SCALE,
    scale_prices,
)


def fetch_live_prices(
    coin_id: str = "ethereum",
    vs_currency: str = "usd",
    days: int = 1,
    num_points: int = 100,
) -> list[float]:
    """Fetch historical prices from CoinGecko API.
    
    Args:
        coin_id: CoinGecko coin ID (e.g., 'ethereum', 'bitcoin')
        vs_currency: Quote currency (e.g., 'usd')
        days: Number of days of history
        num_points: Target number of data points to return
        
    Returns:
        List of price floats
    """
    url = f"{COINGECKO_API_URL}/coins/{coin_id}/market_chart"
    params = {
        "vs_currency": vs_currency,
        "days": days,
        "interval": "5min" if days <= 1 else "hourly",
    }
    
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        # CoinGecko returns [[timestamp, price], ...]
        all_prices = [point[1] for point in data.get("prices", [])]
        
        # Sample down to num_points if we have more
        if len(all_prices) > num_points:
            step = len(all_prices) // num_points
            all_prices = all_prices[::step][:num_points]
        
        print(f"[PriceFetcher] Fetched {len(all_prices)} prices for {coin_id}")
        print(f"[PriceFetcher] Range: ${min(all_prices):.2f} — ${max(all_prices):.2f}")
        
        return all_prices
        
    except requests.RequestException as e:
        print(f"[PriceFetcher] API error: {e}")
        print(f"[PriceFetcher] Falling back to demo prices")
        if coin_id.lower() in ("shitcoin", "rugcoin", "memecoin", "volatile"):
            return DEMO_VOLATILE_PRICES_USD
        return DEMO_STABLE_PRICES_USD


def get_prices_for_trade(asset: str = "ethereum") -> tuple[list[int], list[float], dict]:
    """Get prices formatted for on-chain consumption.
    
    Returns:
        Tuple of:
            - scaled_prices: List of integers for on-chain (× 10,000)
            - raw_prices: Original float prices for display
            - metadata: Dict with asset info and stats
    """
    if DEMO_MODE:
        # In demo mode, pick prices based on asset name
        if asset.lower() in ("shitcoin", "rugcoin", "memecoin", "volatile"):
            raw_prices = DEMO_VOLATILE_PRICES_USD
            is_volatile = True
        else:
            raw_prices = DEMO_STABLE_PRICES_USD
            is_volatile = False
            
        print(f"[PriceFetcher] DEMO MODE — using {'volatile' if is_volatile else 'stable'} prices")
    else:
        # Live mode — fetch from CoinGecko
        raw_prices = fetch_live_prices(coin_id=asset)
        is_volatile = False  # Determined by the risk engine
    
    scaled_prices = scale_prices(raw_prices)
    
    # Compute basic stats for display
    mean_price = sum(raw_prices) / len(raw_prices)
    min_price = min(raw_prices)
    max_price = max(raw_prices)
    spread_pct = ((max_price - min_price) / mean_price) * 100
    
    metadata = {
        "asset": asset,
        "count": len(raw_prices),
        "mean": round(mean_price, 2),
        "min": round(min_price, 2),
        "max": round(max_price, 2),
        "spread_pct": round(spread_pct, 2),
        "timestamp": int(time.time()),
        "demo_mode": DEMO_MODE,
    }
    
    print(f"[PriceFetcher] Stats: mean=${metadata['mean']}, "
          f"range=${metadata['min']}—${metadata['max']}, "
          f"spread={metadata['spread_pct']}%")
    
    return scaled_prices, raw_prices, metadata


if __name__ == "__main__":  # pragma: no cover
    # Quick test
    scaled, raw, meta = get_prices_for_trade("ethereum")
    print(f"\nScaled prices (first 5): {scaled[:5]}")
    print(f"Raw prices (first 5): {raw[:5]}")
    print(f"Metadata: {meta}")
    
    print("\n--- Volatile test ---")
    scaled_v, raw_v, meta_v = get_prices_for_trade("shitcoin")
    print(f"Scaled prices (first 5): {scaled_v[:5]}")
    print(f"Metadata: {meta_v}")
