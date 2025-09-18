export type CreditTier = 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'

export interface PCSAttestation {
  id: string
  score: number
  tier: CreditTier
  issuer: string
  issuedAt: Date
  expiresAt: Date
  operator: string
  signature: string
  published: boolean
}

export interface Pool {
  id: string
  address: string
  token0: string
  token1: string
  fee: number
  tvl: number
  volume24h: number
  prsData: {
    minTier: CreditTier
    maxSwapAmount: Record<CreditTier, number>
    feeDiscounts: Record<CreditTier, number>
  }
}

export interface UserXP {
  level: number
  currentXP: number
  xpToNextLevel: number
  totalXP: number
  badges: Badge[]
}

export interface Badge {
  id: string
  name: string
  description: string
  icon: string
  tier: CreditTier
  unlockedAt?: Date
}

export interface SwapSimulation {
  allowed: boolean
  reason?: string
  estimatedOutput: string
  feeImpact: number
  creditTierDiscount: number
  requiredTier?: CreditTier
}