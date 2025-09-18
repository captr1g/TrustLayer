'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import { SwapSimulatorComponent } from '@/components/swap/swap-simulator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Pool, CreditTier } from '@/lib/types'
import { ArrowLeft, Zap } from 'lucide-react'
import Link from 'next/link'

// Pool data - in a real app this would come from an API
const pools: Pool[] = [
  {
    id: 'pool-dai-usdc',
    address: '0x1234...5678',
    token0: 'DAI',
    token1: 'USDC',
    fee: 100,
    tvl: 45000000,
    volume24h: 8500000,
    prsData: {
      minTier: 'bronze',
      maxSwapAmount: {
        bronze: 50000,
        silver: 100000,
        gold: 250000,
        platinum: 1000000,
        diamond: 2500000
      },
      feeDiscounts: {
        bronze: 0,
        silver: 3,
        gold: 8,
        platinum: 15,
        diamond: 25
      }
    }
  },
  {
    id: 'pool-usdc-eth',
    address: '0xabc123...',
    token0: 'USDC',
    token1: 'ETH',
    fee: 500,
    tvl: 12500000,
    volume24h: 2800000,
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
    address: '0xdef456...',
    token0: 'WBTC',
    token1: 'ETH',
    fee: 3000,
    tvl: 8200000,
    volume24h: 1900000,
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
  }
]

export default function SwapSimulatorPage() {
  const searchParams = useSearchParams()
  const poolParam = searchParams.get('pool')

  const [selectedPool, setSelectedPool] = useState<Pool | null>(null)
  const [userTier, setUserTier] = useState<CreditTier>('gold')

  useEffect(() => {
    if (poolParam) {
      const pool = pools.find(p => p.id === poolParam)
      if (pool) {
        setSelectedPool(pool)
      }
    } else if (pools.length > 0) {
      setSelectedPool(pools[0])
    }
  }, [poolParam])

  if (!selectedPool) {
    return (
      <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Pool Not Found</h1>
            <p className="text-muted-foreground mb-6">The requested pool could not be found.</p>
            <Link href="/pools">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Pools
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <Badge
            variant="outline"
            className="glass-card border-primary/30 text-primary mb-6 px-4 py-2"
          >
            <Zap className="h-3 w-3 mr-2" />
            Swap Simulator
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold font-display mb-6">
            Test Your Swap with{' '}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              {selectedPool.token0}/{selectedPool.token1}
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
            Experience how your credit tier affects swap conditions and benefits in real-time.
          </p>
        </motion.div>

        {/* Navigation */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8"
        >
          <Link href="/pools">
            <Button variant="ghost" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Pools
            </Button>
          </Link>
        </motion.div>

        {/* Pool Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mb-8"
        >
          <Card className="glass-card border border-white/20">
            <CardHeader>
              <CardTitle>Select Pool</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                {pools.map((pool) => (
                  <Button
                    key={pool.id}
                    variant={selectedPool.id === pool.id ? "default" : "outline"}
                    className="h-auto p-4 flex flex-col items-start gap-2"
                    onClick={() => setSelectedPool(pool)}
                  >
                    <div className="font-semibold">{pool.token0}/{pool.token1}</div>
                    <div className="text-sm opacity-80">{pool.fee / 10000}% fee</div>
                    <div className="text-xs opacity-60">TVL: ${(pool.tvl / 1000000).toFixed(1)}M</div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Credit Tier Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-8"
        >
          <Card className="glass-card border border-white/20">
            <CardHeader>
              <CardTitle>Your Credit Tier</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                {(['bronze', 'silver', 'gold', 'platinum', 'diamond'] as CreditTier[]).map((tier) => (
                  <Button
                    key={tier}
                    variant={userTier === tier ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUserTier(tier)}
                    className="capitalize"
                  >
                    {tier}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Swap Simulator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <SwapSimulatorComponent
            pool={selectedPool}
            userTier={userTier}
            onSwapSimulated={(simulation) => {
              console.log('Swap simulated:', simulation)
            }}
          />
        </motion.div>

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-8"
        >
          <Card className="glass-card border border-white/20">
            <CardContent className="pt-6">
              <h3 className="text-lg font-semibold mb-4">How It Works</h3>
              <div className="space-y-3 text-sm text-muted-foreground">
                <p>• Higher credit tiers unlock larger swap amounts and better fee discounts</p>
                <p>• Your privacy is protected through Fully Homomorphic Encryption (FHE)</p>
                <p>• Credit scoring is performed by Actively Validated Services (AVS) on EigenLayer</p>
                <p>• No personal financial data leaves your device unencrypted</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}