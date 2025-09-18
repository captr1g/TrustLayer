'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  ArrowDownUp,
  Info,
  AlertCircle,
  CheckCircle,
  TrendingDown,
  Zap,
  Lock
} from 'lucide-react'
import { Pool, CreditTier } from '@/lib/types'
import { simulateSwap, calculateTierSavings, SwapSimulation } from '@/lib/swap-simulator'
import { cn } from '@/lib/utils'

interface SwapSimulatorProps {
  pool: Pool
  userTier?: CreditTier | null
  onSwapSimulated?: (simulation: SwapSimulation) => void
}

const tokens = ['ETH', 'WBTC', 'USDC', 'DAI', 'UNI', 'AAVE', 'LINK', 'MATIC', 'CRV']

export function SwapSimulatorComponent({
  pool,
  userTier,
  onSwapSimulated
}: SwapSimulatorProps) {
  const [inputToken, setInputToken] = useState(pool.token0)
  const [outputToken, setOutputToken] = useState(pool.token1)
  const [inputAmount, setInputAmount] = useState('')
  const [simulation, setSimulation] = useState<SwapSimulation | null>(null)
  const [tierSavings, setTierSavings] = useState<ReturnType<typeof calculateTierSavings> | null>(null)

  useEffect(() => {
    if (inputAmount && parseFloat(inputAmount) > 0) {
      const sim = simulateSwap(pool, inputToken, parseFloat(inputAmount), userTier || null)
      setSimulation(sim)

      const savings = calculateTierSavings(pool, parseFloat(inputAmount), inputToken, userTier || null)
      setTierSavings(savings)

      onSwapSimulated?.(sim)
    } else {
      setSimulation(null)
      setTierSavings(null)
    }
  }, [inputAmount, inputToken, outputToken, pool, userTier, onSwapSimulated])

  const handleSwapTokens = () => {
    const temp = inputToken
    setInputToken(outputToken)
    setOutputToken(temp)
    setInputAmount('')
    setSimulation(null)
  }

  const tierHierarchy: Record<CreditTier, number> = {
    bronze: 1,
    silver: 2,
    gold: 3,
    platinum: 4,
    diamond: 5
  }

  const canAccess = userTier ? tierHierarchy[userTier] >= tierHierarchy[pool.prsData.minTier] : false

  return (
    <Card className="glass-card border border-white/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <ArrowDownUp className="h-5 w-5 text-primary" />
            Swap Simulator
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            {pool.token0}/{pool.token1} • {(pool.fee / 10000).toFixed(2)}%
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Tier Access Status */}
        {!canAccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4"
          >
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-yellow-500" />
              <span className="font-medium text-yellow-600">Access Restricted</span>
            </div>
            <p className="text-sm text-yellow-600/80 mt-1">
              This pool requires {pool.prsData.minTier.toUpperCase()} tier or higher.
              {userTier && ` You currently have ${userTier.toUpperCase()} tier.`}
            </p>
          </motion.div>
        )}

        {/* Swap Inputs */}
        <div className="space-y-4">
          {/* From Token */}
          <div className="space-y-2">
            <label className="text-sm font-medium">From</label>
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="0.0"
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                className="flex-1"
                disabled={!canAccess}
              />
              <Select value={inputToken} onValueChange={setInputToken} disabled={!canAccess}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[pool.token0, pool.token1].map(token => (
                    <SelectItem key={token} value={token}>
                      {token}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Swap Direction Button */}
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSwapTokens}
              className="rounded-full w-10 h-10 p-0"
              disabled={!canAccess}
            >
              <ArrowDownUp className="h-4 w-4" />
            </Button>
          </div>

          {/* To Token */}
          <div className="space-y-2">
            <label className="text-sm font-medium">To</label>
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="0.0"
                value={simulation?.outputAmount || ''}
                readOnly
                className="flex-1"
                disabled={!canAccess}
              />
              <Select value={outputToken} onValueChange={setOutputToken} disabled={!canAccess}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[pool.token0, pool.token1].map(token => (
                    <SelectItem key={token} value={token}>
                      {token}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Simulation Results */}
        {simulation && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {/* Swap Status */}
            {simulation.allowed ? (
              <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span className="font-medium text-green-600">Swap Allowed</span>
                </div>
                {userTier && (
                  <p className="text-sm text-green-600/80 mt-1">
                    Your {userTier.toUpperCase()} tier grants access to this pool
                  </p>
                )}
              </div>
            ) : (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <span className="font-medium text-red-600">Swap Blocked</span>
                </div>
                <p className="text-sm text-red-600/80 mt-1">{simulation.reason}</p>
              </div>
            )}

            {/* Swap Details */}
            {simulation.allowed && (
              <div className="glass-card p-4 rounded-xl border border-white/20 space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Info className="h-4 w-4 text-muted-foreground" />
                  Swap Details
                </h4>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Exchange Rate</span>
                    <span>1 {inputToken} = {simulation.effectivePrice.toFixed(6)} {outputToken}</span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Price Impact</span>
                    <span className={cn(
                      simulation.priceImpact > 5 ? 'text-red-500' :
                      simulation.priceImpact > 2 ? 'text-yellow-500' :
                      'text-green-500'
                    )}>
                      <TrendingDown className="inline h-3 w-3 mr-1" />
                      {simulation.priceImpact.toFixed(2)}%
                    </span>
                  </div>

                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Fee</span>
                    <span>{simulation.fee.toFixed(3)}%</span>
                  </div>

                  {userTier && simulation.creditTierDiscount > 0 && (
                    <>
                      <div className="flex justify-between text-green-600">
                        <span className="text-green-600/80">Tier Discount</span>
                        <span>-{simulation.creditTierDiscount.toFixed(0)}%</span>
                      </div>

                      <div className="flex justify-between font-medium">
                        <span className="text-muted-foreground">Effective Fee</span>
                        <span className="text-green-600">{simulation.discountedFee.toFixed(3)}%</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Tier Benefits */}
            {tierSavings && userTier && tierSavings.savingsPercentage > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="glass-card p-4 rounded-xl border border-green-500/30 bg-green-500/5"
              >
                <h4 className="font-medium text-sm flex items-center gap-2 text-green-700 mb-3">
                  <Zap className="h-4 w-4" />
                  Your {userTier.toUpperCase()} Tier Benefits
                </h4>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground mb-1">Fee Savings</p>
                    <p className="font-bold text-green-600">
                      ${tierSavings.savings.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Discount Rate</p>
                    <p className="font-bold text-green-600">
                      {tierSavings.savingsPercentage.toFixed(0)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">Max Swap</p>
                    <p className="font-bold">
                      ${(pool.prsData.maxSwapAmount[userTier] || 0).toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-1">You Pay</p>
                    <p className="font-bold">
                      ${tierSavings.discountedFee.toFixed(2)}
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Action Button */}
            <Button
              className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
              size="lg"
              disabled={!simulation.allowed}
            >
              {simulation.allowed ? 'Execute Swap (Demo)' : 'Swap Not Available'}
            </Button>
          </motion.div>
        )}

        {/* Helper Text */}
        {!simulation && canAccess && (
          <p className="text-sm text-muted-foreground text-center">
            Enter an amount to simulate your swap
          </p>
        )}
      </CardContent>
    </Card>
  )
}