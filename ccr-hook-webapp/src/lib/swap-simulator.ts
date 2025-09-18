import { Pool, CreditTier } from './types'

export interface SwapSimulation {
  allowed: boolean
  reason?: string
  estimatedOutput: string
  inputAmount: string
  outputAmount: string
  priceImpact: number
  fee: number
  feeInUSD: number
  creditTierDiscount: number
  discountedFee: number
  requiredTier?: CreditTier
  effectivePrice: number
  route: string[]
}

export interface TokenPrice {
  [key: string]: number // USD prices
}

// Mock token prices in USD
const mockTokenPrices: TokenPrice = {
  ETH: 2500,
  WBTC: 45000,
  USDC: 1,
  DAI: 1,
  UNI: 6.5,
  AAVE: 85,
  LINK: 14,
  MATIC: 0.8,
  CRV: 0.6
}

/**
 * Calculate swap simulation based on pool, amount, and user tier
 */
export function simulateSwap(
  pool: Pool,
  inputToken: string,
  inputAmount: number,
  userTier: CreditTier | null
): SwapSimulation {
  // Check tier requirements
  const tierHierarchy: Record<CreditTier, number> = {
    bronze: 1,
    silver: 2,
    gold: 3,
    platinum: 4,
    diamond: 5
  }

  const requiredTierLevel = tierHierarchy[pool.prsData.minTier]
  const userTierLevel = userTier ? tierHierarchy[userTier] : 0

  // Check if swap is allowed
  if (userTierLevel < requiredTierLevel) {
    return {
      allowed: false,
      reason: `This pool requires ${pool.prsData.minTier.toUpperCase()} tier or higher`,
      estimatedOutput: '0',
      inputAmount: inputAmount.toString(),
      outputAmount: '0',
      priceImpact: 0,
      fee: pool.fee / 10000,
      feeInUSD: 0,
      creditTierDiscount: 0,
      discountedFee: pool.fee / 10000,
      requiredTier: pool.prsData.minTier,
      effectivePrice: 0,
      route: []
    }
  }

  // Check swap amount limits
  const maxSwapAmount = userTier ? pool.prsData.maxSwapAmount[userTier] : 0
  const inputValueUSD = inputAmount * (mockTokenPrices[inputToken] || 1)

  if (inputValueUSD > maxSwapAmount) {
    return {
      allowed: false,
      reason: `Amount exceeds your tier limit of $${maxSwapAmount.toLocaleString()}`,
      estimatedOutput: '0',
      inputAmount: inputAmount.toString(),
      outputAmount: '0',
      priceImpact: 0,
      fee: pool.fee / 10000,
      feeInUSD: 0,
      creditTierDiscount: 0,
      discountedFee: pool.fee / 10000,
      requiredTier: pool.prsData.minTier,
      effectivePrice: 0,
      route: []
    }
  }

  // Determine output token
  const outputToken = inputToken === pool.token0 ? pool.token1 : pool.token0

  // Calculate base swap (simplified constant product formula)
  const inputPrice = mockTokenPrices[inputToken] || 1
  const outputPrice = mockTokenPrices[outputToken] || 1
  const baseOutputAmount = (inputAmount * inputPrice) / outputPrice

  // Apply fee
  const baseFee = pool.fee / 10000 // Convert from basis points to percentage
  const feeAmount = inputAmount * baseFee
  const feeInUSD = feeAmount * inputPrice

  // Apply credit tier discount
  const tierDiscount = userTier ? pool.prsData.feeDiscounts[userTier] / 100 : 0
  const discountedFee = baseFee * (1 - tierDiscount)
  const discountedFeeAmount = inputAmount * discountedFee
  const discountedFeeInUSD = discountedFeeAmount * inputPrice

  // Calculate final output after fees
  const effectiveInputAmount = inputAmount - discountedFeeAmount
  const outputAmount = (effectiveInputAmount * inputPrice) / outputPrice

  // Calculate price impact (simplified)
  const poolLiquidity = pool.tvl
  const tradeSize = inputValueUSD
  const priceImpact = Math.min((tradeSize / poolLiquidity) * 100, 10) // Cap at 10%

  // Apply price impact to output
  const finalOutputAmount = outputAmount * (1 - priceImpact / 100)

  // Calculate effective price
  const effectivePrice = inputAmount / finalOutputAmount

  return {
    allowed: true,
    estimatedOutput: finalOutputAmount.toFixed(6),
    inputAmount: inputAmount.toString(),
    outputAmount: finalOutputAmount.toFixed(6),
    priceImpact: priceImpact,
    fee: baseFee * 100, // Convert to percentage
    feeInUSD: feeInUSD,
    creditTierDiscount: tierDiscount * 100, // Convert to percentage
    discountedFee: discountedFee * 100, // Convert to percentage
    effectivePrice: effectivePrice,
    route: [inputToken, outputToken]
  }
}

/**
 * Calculate savings from credit tier benefits
 */
export function calculateTierSavings(
  pool: Pool,
  inputAmount: number,
  inputToken: string,
  userTier: CreditTier | null
): {
  baseFee: number
  discountedFee: number
  savings: number
  savingsPercentage: number
} {
  const inputPrice = mockTokenPrices[inputToken] || 1
  const baseFee = (inputAmount * pool.fee / 10000) * inputPrice

  if (!userTier) {
    return {
      baseFee,
      discountedFee: baseFee,
      savings: 0,
      savingsPercentage: 0
    }
  }

  const tierDiscount = pool.prsData.feeDiscounts[userTier] / 100
  const discountedFee = baseFee * (1 - tierDiscount)
  const savings = baseFee - discountedFee
  const savingsPercentage = tierDiscount * 100

  return {
    baseFee,
    discountedFee,
    savings,
    savingsPercentage
  }
}

/**
 * Get swap recommendations based on user tier
 */
export function getSwapRecommendations(
  pools: Pool[],
  inputToken: string,
  outputToken: string,
  userTier: CreditTier | null
): {
  bestRate: Pool | null
  lowestFee: Pool | null
  highestLimit: Pool | null
} {
  // Filter pools that have the token pair
  const relevantPools = pools.filter(pool =>
    (pool.token0 === inputToken && pool.token1 === outputToken) ||
    (pool.token1 === inputToken && pool.token0 === outputToken)
  )

  if (relevantPools.length === 0) {
    return {
      bestRate: null,
      lowestFee: null,
      highestLimit: null
    }
  }

  // Filter by user access
  const accessiblePools = userTier
    ? relevantPools.filter(pool => {
        const tierHierarchy: Record<CreditTier, number> = {
          bronze: 1,
          silver: 2,
          gold: 3,
          platinum: 4,
          diamond: 5
        }
        return tierHierarchy[userTier] >= tierHierarchy[pool.prsData.minTier]
      })
    : []

  if (accessiblePools.length === 0) {
    return {
      bestRate: null,
      lowestFee: null,
      highestLimit: null
    }
  }

  // Best rate (considering tier discounts)
  const bestRate = accessiblePools.reduce((best, pool) => {
    const bestDiscount = userTier ? best.prsData.feeDiscounts[userTier] : 0
    const poolDiscount = userTier ? pool.prsData.feeDiscounts[userTier] : 0
    const bestEffectiveFee = best.fee * (1 - bestDiscount / 100)
    const poolEffectiveFee = pool.fee * (1 - poolDiscount / 100)
    return poolEffectiveFee < bestEffectiveFee ? pool : best
  })

  // Lowest base fee
  const lowestFee = accessiblePools.reduce((best, pool) =>
    pool.fee < best.fee ? pool : best
  )

  // Highest swap limit
  const highestLimit = userTier
    ? accessiblePools.reduce((best, pool) =>
        pool.prsData.maxSwapAmount[userTier] > best.prsData.maxSwapAmount[userTier]
          ? pool
          : best
      )
    : null

  return {
    bestRate,
    lowestFee,
    highestLimit
  }
}