'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { PoolCard } from '@/components/ccr/pool-card'
import { Pool, CreditTier } from '@/lib/types'
import {
  generateMockPools,
  filterPoolsByTier,
  sortPools,
  getPoolRecommendations,
  calculatePoolRisk
} from '@/lib/pool-service'
import { getStoredAttestation } from '@/lib/cofhe-mock'
import {
  BarChart3,
  Search,
  Filter,
  TrendingUp,
  Shield,
  Award,
  AlertCircle,
  Lock
} from 'lucide-react'

export default function PoolsPage() {
  const { address } = useAccount()
  const [pools, setPools] = useState<Pool[]>([])
  const [filteredPools, setFilteredPools] = useState<Pool[]>([])
  const [userTier, setUserTier] = useState<CreditTier | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'tvl' | 'volume' | 'fee' | 'tier'>('tvl')
  const [filterByAccess, setFilterByAccess] = useState(false)
  const [recommendations, setRecommendations] = useState<{
    bestValue: Pool[]
    highestRewards: Pool[]
    lowestRisk: Pool[]
  } | null>(null)

  useEffect(() => {
    // Load pools
    const mockPools = generateMockPools()
    setPools(mockPools)
    setFilteredPools(mockPools)

    // Check for user attestation
    if (address) {
      const attestation = getStoredAttestation(address)
      if (attestation) {
        setUserTier(attestation.tier)
        const recs = getPoolRecommendations(mockPools, attestation.tier)
        setRecommendations(recs)
      }
    }
  }, [address])

  useEffect(() => {
    // Apply filters and sorting
    let filtered = [...pools]

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(pool =>
        pool.token0.toLowerCase().includes(searchQuery.toLowerCase()) ||
        pool.token1.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Access filter
    if (filterByAccess && userTier) {
      filtered = filterPoolsByTier(filtered, userTier)
    }

    // Sorting
    filtered = sortPools(filtered, sortBy)

    setFilteredPools(filtered)
  }, [pools, searchQuery, sortBy, filterByAccess, userTier])

  const handleSimulateSwap = (pool: Pool) => {
    // Navigate to swap simulator
    window.location.href = `/swap-simulator?pool=${pool.id}`
  }

  const handleViewDetails = (pool: Pool) => {
    // Navigate to pool details
    window.location.href = `/pools/${pool.id}`
  }

  const tierHierarchy: Record<CreditTier, number> = {
    bronze: 1,
    silver: 2,
    gold: 3,
    platinum: 4,
    diamond: 5
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
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
            <BarChart3 className="h-3 w-3 mr-2" />
            Pool Explorer
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold font-display mb-6">
            Explore{' '}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              Credit-Gated Pools
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto text-balance">
            Discover pools with credit tier requirements and unlock better rates
            based on your on-chain reputation.
          </p>
        </motion.div>

        {/* User Status Bar */}
        {userTier && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-8"
          >
            <Card className="glass-card border border-white/20">
              <CardContent className="p-6">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Shield className="h-5 w-5 text-primary" />
                    <span className="font-medium">Your Credit Tier:</span>
                    <Badge className={`tier-${userTier} text-sm px-3 py-1`}>
                      {userTier.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-green-500" />
                      <span>
                        Access to {filterPoolsByTier(pools, userTier).length}/{pools.length} pools
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.location.href = '/demo'}
                    >
                      Upgrade Tier
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Recommendations (if user has tier) */}
        {userTier && recommendations && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mb-12"
          >
            <Tabs defaultValue="bestValue" className="space-y-6">
              <TabsList className="grid grid-cols-3 glass-card border border-white/20">
                <TabsTrigger value="bestValue">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Best Value
                </TabsTrigger>
                <TabsTrigger value="highestRewards">
                  <Award className="h-4 w-4 mr-2" />
                  Highest Rewards
                </TabsTrigger>
                <TabsTrigger value="lowestRisk">
                  <Shield className="h-4 w-4 mr-2" />
                  Lowest Risk
                </TabsTrigger>
              </TabsList>

              <TabsContent value="bestValue" className="grid md:grid-cols-3 gap-6">
                {recommendations.bestValue.map((pool) => (
                  <PoolCard
                    key={pool.id}
                    pool={pool}
                    userTier={userTier}
                    onSimulateSwap={handleSimulateSwap}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </TabsContent>

              <TabsContent value="highestRewards" className="grid md:grid-cols-3 gap-6">
                {recommendations.highestRewards.map((pool) => (
                  <PoolCard
                    key={pool.id}
                    pool={pool}
                    userTier={userTier}
                    onSimulateSwap={handleSimulateSwap}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </TabsContent>

              <TabsContent value="lowestRisk" className="grid md:grid-cols-3 gap-6">
                {recommendations.lowestRisk.map((pool) => (
                  <PoolCard
                    key={pool.id}
                    pool={pool}
                    userTier={userTier}
                    onSimulateSwap={handleSimulateSwap}
                    onViewDetails={handleViewDetails}
                  />
                ))}
              </TabsContent>
            </Tabs>
          </motion.div>
        )}

        {/* Filters and Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-8"
        >
          <Card className="glass-card border border-white/20">
            <CardHeader>
              <CardTitle className="text-lg">Filter & Search</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by token..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Sort */}
                <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Sort by..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tvl">TVL</SelectItem>
                    <SelectItem value="volume">24h Volume</SelectItem>
                    <SelectItem value="fee">Fee Tier</SelectItem>
                    <SelectItem value="tier">Required Tier</SelectItem>
                  </SelectContent>
                </Select>

                {/* Access Filter */}
                {userTier && (
                  <Button
                    variant={filterByAccess ? 'default' : 'outline'}
                    onClick={() => setFilterByAccess(!filterByAccess)}
                  >
                    <Filter className="h-4 w-4 mr-2" />
                    {filterByAccess ? 'Showing Accessible' : 'Show All'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Pool Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          {filteredPools.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPools.map((pool, index) => (
                <motion.div
                  key={pool.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <PoolCard
                    pool={pool}
                    userTier={userTier}
                    onSimulateSwap={handleSimulateSwap}
                    onViewDetails={handleViewDetails}
                  />
                </motion.div>
              ))}
            </div>
          ) : (
            <Card className="glass-card border border-white/20">
              <CardContent className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-xl font-semibold mb-2">No pools found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search or filters
                </p>
              </CardContent>
            </Card>
          )}
        </motion.div>

        {/* CTA Section */}
        {!userTier && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="text-center mt-16"
          >
            <Card className="glass-card border border-white/20 p-8 max-w-2xl mx-auto">
              <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-2xl font-semibold mb-4">
                Get Your Credit Tier to Unlock More Pools
              </h3>
              <p className="text-muted-foreground mb-6">
                Request a privacy-preserving credit attestation to access exclusive pools
                with better rates and higher limits.
              </p>
              <Button
                size="lg"
                className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
                onClick={() => window.location.href = '/demo'}
              >
                Request Credit Attestation
              </Button>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  )
}