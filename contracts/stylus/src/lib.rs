//! VetoVault Risk Engine — Stylus (WASM) Math Coprocessor
//!
//! Computes historical asset variance on-chain using pure U256 integer math.
//! This contract is called by the Solidity VetoVault contract to determine
//! whether an AI agent's proposed trade exceeds the owner's volatility threshold.
//!
//! Architecture: "WASM as a Math Coprocessor"
//!   - Solidity holds the funds and enforces access control
//!   - This Rust contract does the heavy computation (variance over 100+ prices)
//!   - If variance > threshold, returns false → Solidity reverts the trade
//!
//! All prices are fixed-point integers: off-chain prices × 10,000.
//! Example: $3,241.57 → 32415700
//!
//! Note: this code is a template-only and has not been audited.

// Allow `cargo stylus export-abi` to generate a main function.
#![cfg_attr(not(any(test, feature = "export-abi")), no_main)]
extern crate alloc;

use alloc::vec::Vec;
use stylus_sdk::{alloy_primitives::U256, prelude::*};

// Persistent storage — keeps track of the last computed variance for reads.
sol_storage! {
    #[entrypoint]
    pub struct RiskEngine {
        /// The last computed variance value (for dashboard reads)
        uint256 last_variance;
        /// The last computed mean value (for dashboard reads)
        uint256 last_mean;
        /// The number of prices in the last computation
        uint256 last_count;
    }
}

/// Declare that `RiskEngine` is a contract with the following external methods.
#[public]
impl RiskEngine {
    /// Computes the variance of a price array and checks it against a threshold.
    ///
    /// Returns `true` if the variance is WITHIN the acceptable limit (trade is safe).
    /// Returns `false` if the variance EXCEEDS the threshold (trade is too volatile).
    ///
    /// # Arguments
    /// * `prices` - Array of historical prices (fixed-point, scaled by 10,000)
    /// * `threshold_bps` - Maximum acceptable variance in basis points (e.g., 500 = 5%)
    ///
    /// # Math (all integer arithmetic, no floats):
    /// 1. mean = sum(prices) / len(prices)
    /// 2. variance = sum((price - mean)² for each price) / len(prices)
    /// 3. variance_bps = (variance * 10,000) / mean²  (normalize to basis points)
    /// 4. Return: variance_bps <= threshold_bps
    pub fn check_volatility(&mut self, prices: Vec<U256>, threshold_bps: U256) -> bool {
        let len = prices.len();
        // Require at least 2 prices for meaningful variance
        if len < 2 {
            return true; // Not enough data to compute variance — allow trade
        }

        let n = U256::from(len);

        // Step 1: Compute mean = sum / n
        let mut sum = U256::ZERO;
        for price in &prices {
            sum += *price;
        }
        let mean = sum / n;

        // Guard against zero mean (would cause division by zero)
        if mean == U256::ZERO {
            return false; // All prices are zero — block trade
        }

        // Step 2: Compute sum of squared deviations
        let mut sum_sq_dev = U256::ZERO;
        for price in &prices {
            let dev = if *price >= mean {
                *price - mean
            } else {
                mean - *price
            };
            sum_sq_dev += dev * dev;
        }

        // Step 3: Variance = sum_sq_dev / n
        let variance = sum_sq_dev / n;

        // Step 4: Normalize to basis points relative to mean²
        // variance_bps = (variance * 10_000) / (mean * mean / 10_000)
        // Simplified: variance_bps = (variance * 10_000 * 10_000) / (mean * mean)
        // = (variance * 100_000_000) / mean²
        let scale = U256::from(100_000_000u64);
        let mean_sq = mean * mean;
        let variance_bps = (variance * scale) / mean_sq;

        // Store results for dashboard reads
        self.last_variance.set(variance);
        self.last_mean.set(mean);
        self.last_count.set(n);

        // Return true if within threshold (safe), false if exceeds (too volatile)
        variance_bps <= threshold_bps
    }

    /// Pure computation: returns the raw variance of a price array.
    /// Does not check against any threshold. Used for gas benchmarking.
    ///
    /// # Arguments
    /// * `prices` - Array of historical prices (fixed-point, scaled by 10,000)
    ///
    /// # Returns
    /// The raw variance value (not normalized to basis points)
    pub fn compute_variance(&mut self, prices: Vec<U256>) -> U256 {
        let len = prices.len();
        if len < 2 {
            return U256::ZERO;
        }

        let n = U256::from(len);

        // Mean
        let mut sum = U256::ZERO;
        for price in &prices {
            sum += *price;
        }
        let mean = sum / n;

        if mean == U256::ZERO {
            return U256::ZERO;
        }

        // Sum of squared deviations
        let mut sum_sq_dev = U256::ZERO;
        for price in &prices {
            let dev = if *price >= mean {
                *price - mean
            } else {
                mean - *price
            };
            sum_sq_dev += dev * dev;
        }

        // Variance
        let variance = sum_sq_dev / n;

        // Store for reads
        self.last_variance.set(variance);
        self.last_mean.set(mean);
        self.last_count.set(n);

        variance
    }

    /// Returns the variance from the last computation.
    pub fn last_variance(&self) -> U256 {
        self.last_variance.get()
    }

    /// Returns the mean from the last computation.
    pub fn last_mean(&self) -> U256 {
        self.last_mean.get()
    }

    /// Returns the number of prices from the last computation.
    pub fn last_count(&self) -> U256 {
        self.last_count.get()
    }
}

#[cfg(all(test, feature = "stylus-test"))]
mod test {
    use super::*;

    #[test]
    fn test_stable_prices_pass() {
        use stylus_sdk::testing::*;
        let vm = TestVM::default();
        let mut engine = RiskEngine::from(&vm);

        // Stable prices: $100.00 ± $0.50 (scaled by 10,000)
        // Computed variance ≈ 583 bps — within a 1000 bps (10%) threshold
        let prices: Vec<U256> = vec![
            U256::from(1_000_000u64), // $100.00
            U256::from(1_005_000u64), // $100.50
            U256::from(999_000u64),   // $99.90
            U256::from(1_001_000u64), // $100.10
            U256::from(998_000u64),   // $99.80
        ];

        // 1000 bps = 10% threshold — stable ±0.5% prices should pass
        let result = engine.check_volatility(prices, U256::from(1000u64));
        assert!(result, "Stable prices should pass volatility check");
    }

    #[test]
    fn test_volatile_prices_fail() {
        use stylus_sdk::testing::*;
        let vm = TestVM::default();
        let mut engine = RiskEngine::from(&vm);

        // Extremely volatile prices (pump and dump pattern)
        let prices: Vec<U256> = vec![
            U256::from(1_000_000u64),  // $100.00
            U256::from(5_000_000u64),  // $500.00 (pump)
            U256::from(500_000u64),    // $50.00 (dump)
            U256::from(3_000_000u64),  // $300.00
            U256::from(200_000u64),    // $20.00 (dump)
        ];

        // 500 bps = 5% threshold — volatile prices should fail
        let result = engine.check_volatility(prices, U256::from(500u64));
        assert!(!result, "Volatile prices should fail volatility check");
    }

    #[test]
    fn test_compute_variance_basic() {
        use stylus_sdk::testing::*;
        let vm = TestVM::default();
        let mut engine = RiskEngine::from(&vm);

        // Simple test: [10, 20, 30] → mean = 20, deviations = [-10, 0, 10]
        // variance = (100 + 0 + 100) / 3 = 66 (integer division)
        let prices: Vec<U256> = vec![
            U256::from(10u64),
            U256::from(20u64),
            U256::from(30u64),
        ];

        let variance = engine.compute_variance(prices);
        assert_eq!(variance, U256::from(66u64));
    }

    #[test]
    fn test_single_price_returns_true() {
        use stylus_sdk::testing::*;
        let vm = TestVM::default();
        let mut engine = RiskEngine::from(&vm);

        // Single price — can't compute variance, should return true (allow)
        let prices: Vec<U256> = vec![U256::from(1_000_000u64)];
        let result = engine.check_volatility(prices, U256::from(500u64));
        assert!(result, "Single price should pass (not enough data)");
    }

    #[test]
    fn test_identical_prices_zero_variance() {
        use stylus_sdk::testing::*;
        let vm = TestVM::default();
        let mut engine = RiskEngine::from(&vm);

        // All same price — zero variance
        let prices: Vec<U256> = vec![
            U256::from(1_000_000u64),
            U256::from(1_000_000u64),
            U256::from(1_000_000u64),
        ];

        let variance = engine.compute_variance(prices);
        assert_eq!(variance, U256::ZERO);
    }

    #[test]
    fn test_coverage_edge_cases() {
        use stylus_sdk::testing::*;
        let vm = TestVM::default();
        let mut engine = RiskEngine::from(&vm);

        // check_volatility with zero mean
        let zero_prices = vec![U256::ZERO, U256::ZERO];
        let result = engine.check_volatility(zero_prices.clone(), U256::from(500u64));
        assert!(!result, "Zero mean prices should fail check_volatility");

        // compute_variance with zero mean
        let var_zero = engine.compute_variance(zero_prices);
        assert_eq!(var_zero, U256::ZERO);

        // compute_variance with less than 2 prices
        let empty_prices: Vec<U256> = vec![];
        let var_empty = engine.compute_variance(empty_prices);
        assert_eq!(var_empty, U256::ZERO);

        // Call getters: last_variance, last_mean, last_count
        let prices = vec![U256::from(10u64), U256::from(20u64)];
        let _ = engine.check_volatility(prices, U256::from(1000u64));

        assert_eq!(engine.last_count(), U256::from(2u64));
        assert_eq!(engine.last_mean(), U256::from(15u64));
        // variance of [10, 20]: mean = 15, dev = [-5, 5], sum_sq_dev = 25+25 = 50. variance = 50 / 2 = 25.
        assert_eq!(engine.last_variance(), U256::from(25u64));
    }
}
