'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { TrendingUp, Lock, Unlock, Info, ArrowUpDown } from 'lucide-react'
import { Pool, CreditTier } from '@/lib/types'
import { cn } from '@/lib/utils'

interface PoolCardProps {
  pool: Pool
  userTier?: CreditTier
  onSimulateSwap?: (pool: Pool) => void
  onViewDetails?: (pool: Pool) => void
  className?: string
}

const tierHierarchy: Record<CreditTier, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4,
  diamond: 5
}

const formatCurrency = (amount: number): string => {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(1)}K`
  }
  return `$${amount.toFixed(2)}`
}

const formatTokenPair = (token0: string, token1: string): string => {
  return `${token0}/${token1}`
}

export function PoolCard({
  pool,
  userTier,
  onSimulateSwap,
  onViewDetails,
  className
}: PoolCardProps) {
  const [isHovered, setIsHovered] = useState(false)

  const canAccess = userTier ? tierHierarchy[userTier] >= tierHierarchy[pool.prsData.minTier] : false
  const userMaxSwap = userTier ? pool.prsData.maxSwapAmount[userTier] : 0
  const userDiscount = userTier ? pool.prsData.feeDiscounts[userTier] : 0

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -2, scale: 1.01 }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      className={cn('transition-all duration-300', className)}
    >
      <Card className={cn(
        'glass-card hover:glass-card-strong transition-all duration-300 relative overflow-hidden',
        !canAccess && 'border-yellow-300/50 bg-yellow-50/10'
      )}>
        {/* Access Status Indicator */}
        <div className="absolute top-3 right-3">
          {canAccess ? (
            <Unlock className="h-4 w-4 text-green-500" />
          ) : (
            <Lock className="h-4 w-4 text-yellow-500" />
          )}
        </div>

        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center text-xs font-bold text-white">
                  {pool.token0.charAt(0)}
                </div>
                <div className="w-6 h-6 rounded-full bg-gradient-to-r from-secondary to-primary flex items-center justify-center text-xs font-bold text-white -ml-2">
                  {pool.token1.charAt(0)}
                </div>
              </div>
              <span className="text-base">{formatTokenPair(pool.token0, pool.token1)}</span>
            </div>
            <Badge variant="outline" className="text-xs">
              {(pool.fee / 10000).toFixed(2)}%
            </Badge>
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Pool Stats */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground">TVL</div>
              <div className="font-semibold text-sm">{formatCurrency(pool.tvl)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">24h Volume</div>
              <div className="font-semibold text-sm flex items-center gap-1">
                {formatCurrency(pool.volume24h)}
                <TrendingUp className="h-3 w-3 text-green-500" />
              </div>
            </div>
          </div>

          {/* PRS Information */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Minimum Tier Required</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Minimum credit tier needed to access this pool</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <Badge
              variant={canAccess ? "default" : "secondary"}
              className={cn(
                'text-xs',
                canAccess && 'bg-green-100 text-green-800 border-green-200'
              )}
            >
              {pool.prsData.minTier.toUpperCase()}
            </Badge>
          </div>

          {/* User Benefits (if accessible) */}
          {canAccess && userTier && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2 border-t pt-3"
            >
              <div className="text-sm font-medium text-green-700">Your Benefits</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">Max Swap:</span>
                  <div className="font-semibold">{formatCurrency(userMaxSwap)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Fee Discount:</span>
                  <div className="font-semibold text-green-600">{userDiscount}%</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Access Restriction (if not accessible) */}
          {!canAccess && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="space-y-2 border-t pt-3"
            >
              <div className="text-sm font-medium text-yellow-700">Access Restricted</div>
              <div className="text-xs text-muted-foreground">
                Upgrade to {pool.prsData.minTier.toUpperCase()} tier or higher to access this pool
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => onSimulateSwap?.(pool)}
              size="sm"
              variant={canAccess ? "default" : "outline"}
              className="flex-1"
              disabled={!canAccess}
            >
              <ArrowUpDown className="h-4 w-4 mr-2" />
              {canAccess ? 'Simulate Swap' : 'Restricted'}
            </Button>
            {onViewDetails && (
              <Button
                onClick={() => onViewDetails(pool)}
                size="sm"
                variant="outline"
              >
                <Info className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>

        {/* Hover Effect */}
        {isHovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 bg-gradient-to-r from-primary/5 to-secondary/5 pointer-events-none"
          />
        )}
      </Card>
    </motion.div>
  )
}