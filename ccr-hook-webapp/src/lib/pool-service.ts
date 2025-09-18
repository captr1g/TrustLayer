import { Pool, CreditTier } from './types'

/**
 * Mock pool data generator
 * In production, this would fetch from Uniswap v4 contracts
 */
export function generateMockPools(): Pool[] {
  const pools: Pool[] = [
    {
      id: 'pool-usdc-eth',
      address: '0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8',
      token0: 'USDC',
      token1: 'ETH',
      fee: 500, // 0.05%
      tvl: 125000000,
      volume24h: 28000000,
      prsData: {
        minTier: 'bronze',
        maxSwapAmount: {
          bronze: 10000,
          silver: 25000,
          gold: 100000,
          platinum: 500000,
          diamond: 1000000
        },
        feeDiscounts: {
          bronze: 0,
          silver: 5,
          gold: 10,
          platinum: 15,
          diamond: 20
        }
      }
    },
    {
      id: 'pool-wbtc-eth',
      address: '0xCBCdF9626bC03E24f779434178A73a0B4bad62eD',
      token0: 'WBTC',
      token1: 'ETH',
      fee: 3000, // 0.3%
      tvl: 82000000,
      volume24h: 19000000,
      prsData: {
        minTier: 'silver',
        maxSwapAmount: {
          bronze: 0,
          silver: 15000,
          gold: 75000,
          platinum: 300000,
          diamond: 750000
        },
        feeDiscounts: {
          bronze: 0,
          silver: 8,
          gold: 12,
          platinum: 18,
          diamond: 25
        }
      }
    },
    {
      id: 'pool-dai-usdc',
      address: '0x5777d92f208679DB4b9778590Fa3CAB3aC9e2168',
      token0: 'DAI',
      token1: 'USDC',
      fee: 100, // 0.01%
      tvl: 210000000,
      volume24h: 45000000,
      prsData: {
        minTier: 'bronze',
        maxSwapAmount: {
          bronze: 50000,
          silver: 100000,
          gold: 500000,
          platinum: 2000000,
          diamond: 5000000
        },
        feeDiscounts: {
          bronze: 2,
          silver: 5,
          gold: 8,
          platinum: 12,
          diamond: 15
        }
      }
    },
    {
      id: 'pool-uni-eth',
      address: '0x1d42064Fc4Beb5F8aAF85F4617AE8b3b5B8Bd801',
      token0: 'UNI',
      token1: 'ETH',
      fee: 3000, // 0.3%
      tvl: 45000000,
      volume24h: 12000000,
      prsData: {
        minTier: 'bronze',
        maxSwapAmount: {
          bronze: 5000,
          silver: 15000,
          gold: 50000,
          platinum: 200000,
          diamond: 500000
        },
        feeDiscounts: {
          bronze: 3,
          silver: 7,
          gold: 12,
          platinum: 17,
          diamond: 22
        }
      }
    },
    {
      id: 'pool-aave-eth',
      address: '0x5aB53EE1d50eeF2C0DD42d8e6E226C5fB00A9C07',
      token0: 'AAVE',
      token1: 'ETH',
      fee: 3000, // 0.3%
      tvl: 38000000,
      volume24h: 8500000,
      prsData: {
        minTier: 'gold',
        maxSwapAmount: {
          bronze: 0,
          silver: 0,
          gold: 25000,
          platinum: 100000,
          diamond: 250000
        },
        feeDiscounts: {
          bronze: 0,
          silver: 0,
          gold: 15,
          platinum: 20,
          diamond: 30
        }
      }
    },
    {
      id: 'pool-link-eth',
      address: '0xa6Cc3C2531FdaA6Ae1A3CA84c2855806728693e8',
      token0: 'LINK',
      token1: 'ETH',
      fee: 3000, // 0.3%
      tvl: 52000000,
      volume24h: 15000000,
      prsData: {
        minTier: 'silver',
        maxSwapAmount: {
          bronze: 0,
          silver: 10000,
          gold: 40000,
          platinum: 150000,
          diamond: 400000
        },
        feeDiscounts: {
          bronze: 0,
          silver: 6,
          gold: 11,
          platinum: 16,
          diamond: 23
        }
      }
    },
    {
      id: 'pool-matic-eth',
      address: '0x290A6a7460B308ee3F19023D2D00dE604bcf5B42',
      token0: 'MATIC',
      token1: 'ETH',
      fee: 3000, // 0.3%
      tvl: 28000000,
      volume24h: 6700000,
      prsData: {
        minTier: 'bronze',
        maxSwapAmount: {
          bronze: 8000,
          silver: 20000,
          gold: 60000,
          platinum: 250000,
          diamond: 600000
        },
        feeDiscounts: {
          bronze: 4,
          silver: 8,
          gold: 13,
          platinum: 18,
          diamond: 24
        }
      }
    },
    {
      id: 'pool-crv-eth',
      address: '0x919Fa96e88d67499339577Fa202345436bcDaf79',
      token0: 'CRV',
      token1: 'ETH',
      fee: 10000, // 1%
      tvl: 18000000,
      volume24h: 3200000,
      prsData: {
        minTier: 'platinum',
        maxSwapAmount: {
          bronze: 0,
          silver: 0,
          gold: 0,
          platinum: 50000,
          diamond: 200000
        },
        feeDiscounts: {
          bronze: 0,
          silver: 0,
          gold: 0,
          platinum: 25,
          diamond: 35
        }
      }
    }
  ]

  // Add some randomization to volumes for realism
  return pools.map(pool => ({
    ...pool,
    volume24h: pool.volume24h * (0.8 + Math.random() * 0.4), // ±20% variation
    tvl: pool.tvl * (0.95 + Math.random() * 0.1) // ±5% variation
  }))
}

/**
 * Filter pools based on user's credit tier
 */
export function filterPoolsByTier(pools: Pool[], userTier: CreditTier | null): Pool[] {
  if (!userTier) return pools

  const tierHierarchy: Record<CreditTier, number> = {
    bronze: 1,
    silver: 2,
    gold: 3,
    platinum: 4,
    diamond: 5
  }

  const userTierLevel = tierHierarchy[userTier]

  return pools.filter(pool => {
    const requiredTierLevel = tierHierarchy[pool.prsData.minTier]
    return userTierLevel >= requiredTierLevel
  })
}

/**
 * Calculate pool risk score
 */
export function calculatePoolRisk(pool: Pool): {
  score: number
  level: 'low' | 'medium' | 'high'
  factors: {
    volatility: number
    liquidity: number
    tierRequirement: number
  }
} {
  // Simple risk calculation based on pool metrics
  const volatilityRisk = pool.fee / 100 // Higher fees = higher volatility
  const liquidityRisk = Math.max(0, 1 - (pool.tvl / 100000000)) // Lower TVL = higher risk
  const tierRisk = pool.prsData.minTier === 'platinum' || pool.prsData.minTier === 'diamond' ? 0.5 : 0

  const totalRisk = (volatilityRisk + liquidityRisk + tierRisk) / 3
  const score = Math.round(totalRisk * 100)

  let level: 'low' | 'medium' | 'high'
  if (score < 30) level = 'low'
  else if (score < 60) level = 'medium'
  else level = 'high'

  return {
    score,
    level,
    factors: {
      volatility: Math.round(volatilityRisk * 100),
      liquidity: Math.round(liquidityRisk * 100),
      tierRequirement: Math.round(tierRisk * 100)
    }
  }
}

/**
 * Sort pools by various criteria
 */
export function sortPools(
  pools: Pool[],
  sortBy: 'tvl' | 'volume' | 'fee' | 'tier' = 'tvl',
  ascending = false
): Pool[] {
  const sorted = [...pools].sort((a, b) => {
    switch (sortBy) {
      case 'tvl':
        return b.tvl - a.tvl
      case 'volume':
        return b.volume24h - a.volume24h
      case 'fee':
        return a.fee - b.fee
      case 'tier':
        const tierOrder: Record<CreditTier, number> = {
          bronze: 1,
          silver: 2,
          gold: 3,
          platinum: 4,
          diamond: 5
        }
        return tierOrder[a.prsData.minTier] - tierOrder[b.prsData.minTier]
      default:
        return 0
    }
  })

  return ascending ? sorted.reverse() : sorted
}

/**
 * Get pool recommendations based on user tier
 */
export function getPoolRecommendations(
  pools: Pool[],
  userTier: CreditTier
): {
  bestValue: Pool[]
  highestRewards: Pool[]
  lowestRisk: Pool[]
} {
  const accessiblePools = filterPoolsByTier(pools, userTier)

  // Best value: highest fee discount for user's tier
  const bestValue = [...accessiblePools]
    .sort((a, b) => b.prsData.feeDiscounts[userTier] - a.prsData.feeDiscounts[userTier])
    .slice(0, 3)

  // Highest rewards: largest max swap amounts
  const highestRewards = [...accessiblePools]
    .sort((a, b) => b.prsData.maxSwapAmount[userTier] - a.prsData.maxSwapAmount[userTier])
    .slice(0, 3)

  // Lowest risk: based on risk calculation
  const lowestRisk = [...accessiblePools]
    .sort((a, b) => calculatePoolRisk(a).score - calculatePoolRisk(b).score)
    .slice(0, 3)

  return {
    bestValue,
    highestRewards,
    lowestRisk
  }
}