const { ethers } = require('ethers');

/**
 * Personal Credit Score (PCS) Computer
 * Implements the scoring algorithm described in the backend plan
 */
class PCSComputer {
  constructor() {
    // Scoring weights (should match policy contract)
    this.weights = {
      age: 0.25,          // 25% weight for wallet age
      activity: 0.30,     // 30% weight for activity score
      liquidity: 0.25,    // 25% weight for LP contribution
      liquidation: 0.20   // 20% weight for liquidation penalty
    };

    // Tier thresholds (0-1000 scale)
    this.tiers = {
      0: 'Bronze',    // 0-299
      300: 'Silver',  // 300-499
      500: 'Gold',    // 500-699
      700: 'Platinum', // 700-849
      850: 'Diamond'  // 850-1000
    };
  }

  /**
   * Compute Personal Credit Score
   * @param {Object} features - User features from on-chain data
   * @returns {Object} PCS result with score, tier, and breakdown
   */
  async computePCS(features) {
    try {
      // Validate input features
      this.validateFeatures(features);

      // Compute individual scores
      const ageScore = this.computeAgeScore(features.walletAge || 0);
      const activityScore = this.computeActivityScore(
        features.transactionCount || 0,
        features.successRate || 0
      );
      const liquidityScore = this.computeLiquidityScore(features.lpContribution || 0);
      const liquidationPenalty = this.computeLiquidationPenalty(features.liquidationCount || 0);

      // Calculate weighted composite score
      const compositeScore = (
        (ageScore * this.weights.age) +
        (activityScore * this.weights.activity) +
        (liquidityScore * this.weights.liquidity) +
        (liquidationPenalty * this.weights.liquidation)
      );

      // Clamp to 0-1000 range
      const finalScore = Math.max(0, Math.min(1000, Math.round(compositeScore)));

      // Determine tier
      const tier = this.getTierFromScore(finalScore);

      return {
        score: finalScore,
        tier: tier,
        breakdown: {
          ageScore: Math.round(ageScore),
          activityScore: Math.round(activityScore),
          liquidityScore: Math.round(liquidityScore),
          liquidationPenalty: Math.round(liquidationPenalty),
          weights: this.weights,
          compositeScore: Math.round(compositeScore)
        }
      };

    } catch (error) {
      throw new Error(`PCS computation failed: ${error.message}`);
    }
  }

  /**
   * Validate input features
   * @param {Object} features - Input features
   */
  validateFeatures(features) {
    if (!features || typeof features !== 'object') {
      throw new Error('Features must be a valid object');
    }

    // Set defaults for missing features
    const defaults = {
      walletAge: 0,
      transactionCount: 0,
      successRate: 0,
      lpContribution: 0,
      liquidationCount: 0
    };

    Object.keys(defaults).forEach(key => {
      if (features[key] === undefined) {
        features[key] = defaults[key];
      }
    });
  }

  /**
   * Compute age score (0-1000)
   * @param {number} walletAgeInDays - Wallet age in days
   * @returns {number} Age score
   */
  computeAgeScore(walletAgeInDays) {
    // Sigmoid-like function: more points for older wallets, diminishing returns
    // Formula: 1000 * (1 - e^(-age/365)) for age in days
    const years = walletAgeInDays / 365;
    const score = 1000 * (1 - Math.exp(-years * 0.8));
    return Math.max(0, Math.min(1000, score));
  }

  /**
   * Compute activity score (0-1000)
   * @param {number} txCount - Transaction count
   * @param {number} successRate - Success rate (0-1)
   * @returns {number} Activity score
   */
  computeActivityScore(txCount, successRate) {
    // Normalize transaction count (log scale for diminishing returns)
    const normalizedTxCount = Math.min(1000, Math.log10(txCount + 1) * 200);

    // Success rate component (0-1000)
    const successComponent = successRate * 1000;

    // Combine with weights: 60% tx count, 40% success rate
    const score = (normalizedTxCount * 0.6) + (successComponent * 0.4);

    return Math.max(0, Math.min(1000, score));
  }

  /**
   * Compute liquidity score (0-1000)
   * @param {number} lpContribution - Total LP contribution value
   * @returns {number} Liquidity score
   */
  computeLiquidityScore(lpContribution) {
    // Log scale for LP contribution with cap
    if (lpContribution <= 0) return 0;

    // Formula: log10(contribution + 1) * 250, capped at 1000
    const score = Math.log10(lpContribution + 1) * 250;
    return Math.max(0, Math.min(1000, score));
  }

  /**
   * Compute liquidation penalty (penalty reduces score)
   * @param {number} liquidationCount - Number of liquidations
   * @returns {number} Score after penalty
   */
  computeLiquidationPenalty(liquidationCount) {
    // Base score of 1000, reduced by liquidations
    // Each liquidation reduces score by 200 points, with diminishing impact
    const penalty = liquidationCount * 200 * Math.exp(-liquidationCount * 0.2);
    const score = 1000 - penalty;

    return Math.max(0, Math.min(1000, score));
  }

  /**
   * Get tier from score
   * @param {number} score - PCS score (0-1000)
   * @returns {string} Tier name
   */
  getTierFromScore(score) {
    if (score >= 850) return 'Diamond';
    if (score >= 700) return 'Platinum';
    if (score >= 500) return 'Gold';
    if (score >= 300) return 'Silver';
    return 'Bronze';
  }

  /**
   * Get minimum score for tier
   * @param {string} tier - Tier name
   * @returns {number} Minimum score
   */
  getMinScoreForTier(tier) {
    const tierMap = {
      'Bronze': 0,
      'Silver': 300,
      'Gold': 500,
      'Platinum': 700,
      'Diamond': 850
    };
    return tierMap[tier] || 0;
  }

  /**
   * Simulate PCS computation with random features (for testing)
   * @returns {Object} Simulated PCS result
   */
  async simulatePCS() {
    const mockFeatures = {
      walletAge: Math.floor(Math.random() * 1000), // 0-1000 days
      transactionCount: Math.floor(Math.random() * 10000), // 0-10k txs
      successRate: Math.random(), // 0-1
      lpContribution: Math.random() * 1000, // 0-1000 ETH equivalent
      liquidationCount: Math.floor(Math.random() * 5) // 0-5 liquidations
    };

    return await this.computePCS(mockFeatures);
  }

  /**
   * Get scoring configuration
   * @returns {Object} Current weights and tiers
   */
  getConfig() {
    return {
      weights: this.weights,
      tiers: this.tiers
    };
  }
}

module.exports = PCSComputer;