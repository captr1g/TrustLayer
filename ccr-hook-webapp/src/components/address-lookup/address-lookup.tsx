'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Search,
  Wallet,
  Shield,
  TrendingUp,
  Award,
  AlertCircle,
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { isAddress } from 'viem'
import { CreditTier } from '@/lib/types'

interface PCSResult {
  score: number
  tier: CreditTier
  details: {
    ageScore: number
    activityScore: number
    lpScore: number
    liquidationPenalty: number
  }
}

interface PoolRiskData {
  poolId: string
  poolName: string
  riskScore: number
  riskBand: 'Calm' | 'Normal' | 'Volatile' | 'Turbulent'
  maxSwapAmount: number
  feeDiscount: number
  accessAllowed: boolean
}

const tierColors: Record<CreditTier, string> = {
  bronze: 'bg-amber-600',
  silver: 'bg-gray-400',
  gold: 'bg-yellow-500',
  platinum: 'bg-purple-600',
  diamond: 'bg-cyan-500'
}

const riskBandColors = {
  Calm: 'text-green-500',
  Normal: 'text-blue-500',
  Volatile: 'text-yellow-500',
  Turbulent: 'text-red-500'
}

export function AddressLookup() {
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [pcsResult, setPcsResult] = useState<PCSResult | null>(null)
  const [poolRisks, setPoolRisks] = useState<PoolRiskData[]>([])

  const mockComputePCS = async (walletAddress: string): Promise<PCSResult> => {
    await new Promise(resolve => setTimeout(resolve, 1500))

    const hash = walletAddress.toLowerCase()
    const seed = parseInt(hash.slice(2, 10), 16)
    const score = 300 + (seed % 600)

    let tier: CreditTier = 'bronze'
    if (score >= 800) tier = 'diamond'
    else if (score >= 700) tier = 'platinum'
    else if (score >= 600) tier = 'gold'
    else if (score >= 450) tier = 'silver'

    return {
      score,
      tier,
      details: {
        ageScore: 100 + (seed % 150),
        activityScore: 100 + ((seed * 2) % 150),
        lpScore: 50 + ((seed * 3) % 200),
        liquidationPenalty: Math.max(0, 50 - (seed % 100))
      }
    }
  }

  const mockComputePoolRisks = async (walletTier: CreditTier): Promise<PoolRiskData[]> => {
    await new Promise(resolve => setTimeout(resolve, 800))

    const pools = [
      { name: 'USDC/ETH', volatility: 15 },
      { name: 'WBTC/ETH', volatility: 25 },
      { name: 'DAI/USDC', volatility: 5 },
      { name: 'UNI/ETH', volatility: 35 },
      { name: 'AAVE/ETH', volatility: 30 }
    ]

    const tierMultipliers = {
      bronze: 1,
      silver: 2,
      gold: 5,
      platinum: 10,
      diamond: 20
    }

    const tierDiscounts = {
      bronze: 0,
      silver: 5,
      gold: 10,
      platinum: 15,
      diamond: 25
    }

    return pools.map((pool, index) => {
      const riskScore = pool.volatility + Math.random() * 20
      let riskBand: PoolRiskData['riskBand'] = 'Normal'

      if (riskScore < 15) riskBand = 'Calm'
      else if (riskScore < 30) riskBand = 'Normal'
      else if (riskScore < 45) riskBand = 'Volatile'
      else riskBand = 'Turbulent'

      const baseAmount = 10000
      const maxSwap = baseAmount * tierMultipliers[walletTier] * (1 - pool.volatility / 100)

      const minTierRequired = pool.volatility > 30 ? 'silver' : 'bronze'
      const tierValues = { bronze: 1, silver: 2, gold: 3, platinum: 4, diamond: 5 }
      const accessAllowed = tierValues[walletTier] >= tierValues[minTierRequired as CreditTier]

      return {
        poolId: `pool-${index + 1}`,
        poolName: pool.name,
        riskScore: Math.round(riskScore),
        riskBand,
        maxSwapAmount: Math.round(maxSwap),
        feeDiscount: tierDiscounts[walletTier],
        accessAllowed
      }
    })
  }

  const handleLookup = async () => {
    if (!address) {
      setError('Please enter a wallet address')
      return
    }

    if (!isAddress(address)) {
      setError('Invalid Ethereum address format')
      return
    }

    setError('')
    setLoading(true)

    try {
      const pcs = await mockComputePCS(address)
      setPcsResult(pcs)

      const risks = await mockComputePoolRisks(pcs.tier)
      setPoolRisks(risks)
    } catch (err) {
      setError('Failed to fetch credit data. Please try again.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleExampleAddress = () => {
    setAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb7')
  }

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <Card className="glass-card border border-white/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Address Credit Lookup
          </CardTitle>
          <CardDescription>
            Enter any Ethereum address to view its Personal Credit Score (PCS) and Pool Risk assessments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="0x..."
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="font-mono"
            />
            <Button
              onClick={handleLookup}
              disabled={loading}
              className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 mr-2" />
                  Lookup
                </>
              )}
            </Button>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExampleAddress}
            className="text-xs"
          >
            Use Example Address
          </Button>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {pcsResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-6"
        >
          {/* PCS Score Card */}
          <Card className="glass-card border border-white/20 overflow-hidden">
            <div className={`h-2 ${tierColors[pcsResult.tier]}`} />
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Personal Credit Score
                </span>
                <Badge className={`${tierColors[pcsResult.tier]} text-white capitalize`}>
                  <Award className="h-3 w-3 mr-1" />
                  {pcsResult.tier} Tier
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center mb-6">
                <div className="text-6xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  {pcsResult.score}
                </div>
                <p className="text-muted-foreground text-sm mt-2">out of 1000</p>
              </div>

              <Separator className="my-4" />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Wallet Age</span>
                    <span className="font-semibold">{pcsResult.details.ageScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Activity Score</span>
                    <span className="font-semibold">{pcsResult.details.activityScore}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">LP Contribution</span>
                    <span className="font-semibold">{pcsResult.details.lpScore}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Liquidation Penalty</span>
                    <span className="font-semibold text-red-500">-{pcsResult.details.liquidationPenalty}</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  Address: <code className="font-mono">{address.slice(0, 6)}...{address.slice(-4)}</code>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Pool Risk Assessments */}
          <Card className="glass-card border border-white/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Pool Risk Assessments
              </CardTitle>
              <CardDescription>
                Personalized pool access and risk scores based on your credit tier
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {poolRisks.map((pool) => (
                  <div
                    key={pool.poolId}
                    className="p-4 border border-white/10 rounded-lg hover:border-white/20 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <h3 className="font-semibold">{pool.poolName}</h3>
                        <Badge
                          variant="outline"
                          className={riskBandColors[pool.riskBand]}
                        >
                          {pool.riskBand}
                        </Badge>
                      </div>
                      {pool.accessAllowed ? (
                        <Badge variant="default" className="bg-green-500/20 text-green-500">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Access Granted
                        </Badge>
                      ) : (
                        <Badge variant="destructive">
                          <XCircle className="h-3 w-3 mr-1" />
                          Tier Too Low
                        </Badge>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Risk Score</span>
                        <p className="font-semibold">{pool.riskScore}/100</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Max Swap</span>
                        <p className="font-semibold">${pool.maxSwapAmount.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Fee Discount</span>
                        <p className="font-semibold text-green-500">{pool.feeDiscount}%</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 p-4 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-lg border border-primary/20">
                <p className="text-sm">
                  <span className="font-semibold">💡 Pro Tip:</span> Higher credit tiers unlock better swap limits,
                  lower fees, and access to exclusive pools. Keep building your on-chain reputation!
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  )
}