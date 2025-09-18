/**
 * Pool Risk Score (PRS) Computer
 * Implements the pool risk scoring algorithm described in the backend plan
 */
class PRSComputer {
  constructor() {
    // Scoring weights
    this.weights = {
      volatility: 0.35,       // 35% weight for realized volatility
      depth: 0.25,            // 25% weight for liquidity depth
      concentration: 0.25,    // 25% weight for liquidity concentration
      oracle: 0.15            // 15% weight for oracle dispersion
    };

    // Risk bands (0-100 scale)
    this.bands = {
      0: 'Calm',          // 0-24
      25: 'Normal',       // 25-49
      50: 'Volatile',     // 50-74
      75: 'Turbulent'     // 75-100
    };
  }

  /**
   * Compute Pool Risk Score
   * @param {Object} poolMetrics - Pool metrics from on-chain data
   * @returns {Object} PRS result with score, band, and breakdown
   */
  async computePRS(poolMetrics) {
    try {
      // Validate input metrics
      this.validateMetrics(poolMetrics);

      // Compute individual risk components
      const volatilityScore = this.computeVolatilityScore(poolMetrics.volatility || 0);
      const depthScore = this.computeDepthScore(poolMetrics.liquidityDepth || 0);
      const concentrationScore = this.computeConcentrationScore(poolMetrics.concentration || 0);
      const oracleScore = this.computeOracleScore(poolMetrics.oracleDispersion || 0);

      // Calculate weighted composite score
      const compositeScore = (
        (volatilityScore * this.weights.volatility) +
        (depthScore * this.weights.depth) +
        (concentrationScore * this.weights.concentration) +
        (oracleScore * this.weights.oracle)
      );

      // Clamp to 0-100 range
      const finalScore = Math.max(0, Math.min(100, Math.round(compositeScore)));

      // Determine risk band
      const band = this.getBandFromScore(finalScore);

      return {
        score: finalScore,
        band: band,
        breakdown: {
          volatilityScore: Math.round(volatilityScore),
          depthScore: Math.round(depthScore),
          concentrationScore: Math.round(concentrationScore),
          oracleScore: Math.round(oracleScore),
          weights: this.weights,
          compositeScore: Math.round(compositeScore)
        }
      };

    } catch (error) {
      throw new Error(`PRS computation failed: ${error.message}`);
    }
  }

  /**
   * Validate input metrics
   * @param {Object} poolMetrics - Input pool metrics
   */
  validateMetrics(poolMetrics) {
    if (!poolMetrics || typeof poolMetrics !== 'object') {
      throw new Error('Pool metrics must be a valid object');
    }

    // Set defaults for missing metrics
    const defaults = {
      volatility: 0,
      liquidityDepth: 0,
      concentration: 0,
      oracleDispersion: 0,
      volume24h: 0,
      tvl: 0
    };

    Object.keys(defaults).forEach(key => {
      if (poolMetrics[key] === undefined) {
        poolMetrics[key] = defaults[key];
      }
    });
  }

  /**
   * Compute volatility risk score (0-100)
   * Higher volatility = higher risk score
   * @param {number} volatility - Realized volatility (0-1, where 1 = 100% volatility)
   * @returns {number} Volatility risk score
   */
  computeVolatilityScore(volatility) {
    // Convert volatility to risk score (0-100)
    // Formula: sigmoid transformation to handle extreme values
    const normalizedVol = Math.min(1, Math.max(0, volatility));

    // Sigmoid function: maps 0-1 volatility to 0-100 risk score
    const score = 100 * (1 / (1 + Math.exp(-10 * (normalizedVol - 0.5))));

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Compute liquidity depth risk score (0-100)
   * Lower depth = higher risk score
   * @param {number} liquidityDepth - Available liquidity depth in USD
   * @returns {number} Depth risk score
   */
  computeDepthScore(liquidityDepth) {
    if (liquidityDepth <= 0) return 100; // Maximum risk for no liquidity

    // Inverse relationship: more liquidity = lower risk
    // Use log scale to handle wide range of values
    const logDepth = Math.log10(liquidityDepth + 1);

    // Map log depth to risk score (higher depth = lower risk)
    // Assume $10M depth = very low risk (score ~0)
    // Assume $1K depth = high risk (score ~90)
    const score = Math.max(0, 100 - (logDepth * 15));

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Compute concentration risk score (0-100)
   * Higher concentration = higher risk score
   * @param {number} concentration - Liquidity concentration metric (0-1)
   * @returns {number} Concentration risk score
   */
  computeConcentrationScore(concentration) {
    // Concentration close to 0 = well distributed (low risk)
    // Concentration close to 1 = highly concentrated (high risk)
    const normalizedConcentration = Math.min(1, Math.max(0, concentration));

    // Linear mapping with slight curve for extreme values
    const score = normalizedConcentration * 100;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Compute oracle dispersion risk score (0-100)
   * Higher dispersion = higher risk score
   * @param {number} oracleDispersion - Oracle price dispersion (0-1)
   * @returns {number} Oracle risk score
   */
  computeOracleScore(oracleDispersion) {
    // Oracle dispersion measures price feed reliability
    // 0 = all oracles agree (low risk)
    // 1 = high dispersion (high risk)
    const normalizedDispersion = Math.min(1, Math.max(0, oracleDispersion));

    // Exponential function to penalize high dispersion more severely
    const score = 100 * Math.pow(normalizedDispersion, 2);

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Get risk band from score
   * @param {number} score - PRS score (0-100)
   * @returns {string} Risk band name
   */
  getBandFromScore(score) {
    if (score >= 75) return 'Turbulent';
    if (score >= 50) return 'Volatile';
    if (score >= 25) return 'Normal';
    return 'Calm';
  }

  /**
   * Get minimum score for band
   * @param {string} band - Band name
   * @returns {number} Minimum score
   */
  getMinScoreForBand(band) {
    const bandMap = {
      'Calm': 0,
      'Normal': 25,
      'Volatile': 50,
      'Turbulent': 75
    };
    return bandMap[band] || 0;
  }

  /**
   * Analyze pool metrics and provide insights
   * @param {Object} poolMetrics - Pool metrics
   * @returns {Object} Analysis with insights and recommendations
   */
  async analyzePool(poolMetrics) {
    const prsResult = await this.computePRS(poolMetrics);

    const insights = [];
    const recommendations = [];

    // Analyze each component
    if (prsResult.breakdown.volatilityScore > 70) {
      insights.push('High price volatility detected');
      recommendations.push('Consider implementing wider spread parameters');
    }

    if (prsResult.breakdown.depthScore > 70) {
      insights.push('Low liquidity depth may cause slippage');
      recommendations.push('Incentivize additional liquidity provision');
    }

    if (prsResult.breakdown.concentrationScore > 70) {
      insights.push('Liquidity is highly concentrated');
      recommendations.push('Encourage more distributed liquidity positions');
    }

    if (prsResult.breakdown.oracleScore > 70) {
      insights.push('Oracle price feeds show high dispersion');
      recommendations.push('Verify oracle integrity and consider additional feeds');
    }

    return {
      ...prsResult,
      insights,
      recommendations,
      riskLevel: this.getRiskLevel(prsResult.score)
    };
  }

  /**
   * Get qualitative risk level
   * @param {number} score - PRS score
   * @returns {string} Risk level description
   */
  getRiskLevel(score) {
    if (score >= 75) return 'Very High Risk';
    if (score >= 50) return 'High Risk';
    if (score >= 25) return 'Moderate Risk';
    return 'Low Risk';
  }

  /**
   * Simulate PRS computation with random metrics (for testing)
   * @returns {Object} Simulated PRS result
   */
  async simulatePRS() {
    const mockMetrics = {
      volatility: Math.random() * 0.5, // 0-50% volatility
      liquidityDepth: Math.random() * 10000000, // 0-10M USD
      concentration: Math.random(), // 0-1 concentration
      oracleDispersion: Math.random() * 0.2, // 0-20% dispersion
      volume24h: Math.random() * 1000000, // 0-1M USD daily volume
      tvl: Math.random() * 50000000 // 0-50M USD TVL
    };

    return await this.computePRS(mockMetrics);
  }

  /**
   * Get scoring configuration
   * @returns {Object} Current weights and bands
   */
  getConfig() {
    return {
      weights: this.weights,
      bands: this.bands
    };
  }

  /**
   * Compute historical PRS trend
   * @param {Array} historicalMetrics - Array of historical pool metrics
   * @returns {Object} Trend analysis
   */
  async computeTrend(historicalMetrics) {
    if (!Array.isArray(historicalMetrics) || historicalMetrics.length < 2) {
      throw new Error('At least 2 historical data points required for trend analysis');
    }

    const scores = [];
    for (const metrics of historicalMetrics) {
      const result = await this.computePRS(metrics);
      scores.push(result.score);
    }

    // Calculate trend (simple linear regression slope)
    const n = scores.length;
    const sumX = n * (n - 1) / 2; // Sum of indices 0,1,2,...,n-1
    const sumY = scores.reduce((a, b) => a + b, 0);
    const sumXY = scores.reduce((sum, score, index) => sum + score * index, 0);
    const sumX2 = n * (n - 1) * (2 * n - 1) / 6; // Sum of squares

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    return {
      currentScore: scores[scores.length - 1],
      trend: slope > 0.5 ? 'Increasing Risk' : slope < -0.5 ? 'Decreasing Risk' : 'Stable',
      slope: slope,
      historicalScores: scores
    };
  }
}

module.exports = PRSComputer;