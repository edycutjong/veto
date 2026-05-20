// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/**
 * @title RiskEngineSol — Solidity Benchmark Implementation
 * @notice Identical variance computation as the Stylus Risk Engine, but in pure Solidity.
 *         This exists ONLY for gas benchmarking to prove WASM is cheaper.
 *         DO NOT use in production — use the Stylus version.
 * @dev All math uses uint256 with fixed-point scaling (prices × 10,000).
 *      Variance = sum((price - mean)²) / n
 *      Variance BPS = (variance × 100,000,000) / mean²
 */
contract RiskEngineSol {
    /// @notice Last computed variance (for reads)
    uint256 public lastVariance;
    /// @notice Last computed mean (for reads)
    uint256 public lastMean;
    /// @notice Last price count (for reads)
    uint256 public lastCount;

    /**
     * @notice Checks if an asset's historical price variance is within threshold
     * @param prices Array of historical prices (fixed-point, scaled by 10,000)
     * @param thresholdBps Maximum acceptable variance in basis points
     * @return True if within threshold (safe), false if exceeds (too volatile)
     */
    function checkVolatility(
        uint256[] calldata prices,
        uint256 thresholdBps
    ) external returns (bool) {
        uint256 len = prices.length;
        if (len < 2) return true;

        // Step 1: Compute mean
        uint256 sum = 0;
        for (uint256 i = 0; i < len; i++) {
            sum += prices[i];
        }
        uint256 mean = sum / len;
        if (mean == 0) return false;

        // Step 2: Sum of squared deviations
        uint256 sumSqDev = 0;
        for (uint256 i = 0; i < len; i++) {
            uint256 dev;
            if (prices[i] >= mean) {
                dev = prices[i] - mean;
            } else {
                dev = mean - prices[i];
            }
            sumSqDev += dev * dev;
        }

        // Step 3: Variance
        uint256 variance = sumSqDev / len;

        // Step 4: Normalize to basis points
        uint256 varianceBps = (variance * 100_000_000) / (mean * mean);

        // Store for reads
        lastVariance = variance;
        lastMean = mean;
        lastCount = len;

        return varianceBps <= thresholdBps;
    }

    /**
     * @notice Pure computation: returns the raw variance of a price array
     * @dev Used for gas benchmarking — identical logic to Stylus version
     * @param prices Array of historical prices (fixed-point, scaled by 10,000)
     * @return The raw variance value
     */
    function computeVariance(
        uint256[] calldata prices
    ) external returns (uint256) {
        uint256 len = prices.length;
        if (len < 2) return 0;

        uint256 sum = 0;
        for (uint256 i = 0; i < len; i++) {
            sum += prices[i];
        }
        uint256 mean = sum / len;
        if (mean == 0) return 0;

        uint256 sumSqDev = 0;
        for (uint256 i = 0; i < len; i++) {
            uint256 dev;
            if (prices[i] >= mean) {
                dev = prices[i] - mean;
            } else {
                dev = mean - prices[i];
            }
            sumSqDev += dev * dev;
        }

        uint256 variance = sumSqDev / len;

        lastVariance = variance;
        lastMean = mean;
        lastCount = len;

        return variance;
    }
}
