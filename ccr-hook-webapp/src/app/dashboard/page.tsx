'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { AttestationCard } from '@/components/ccr/attestation-card'
import { PoolCard } from '@/components/ccr/pool-card'
import { XPProgress } from '@/components/ccr/xp-progress'
import {
  User,
  Shield,
  TrendingUp,
  Award,
  Clock,
  BarChart3,
  Zap,
  RefreshCw,
  Download,
  Eye,
  Calendar
} from 'lucide-react'
import { PCSAttestation, Pool, UserXP, CreditTier } from '@/lib/types'
import { getStoredAttestation, PCSComputeResult } from '@/lib/cofhe-mock'
import { generateMockPools, getPoolRecommendations } from '@/lib/pool-service'

interface DashboardStats {
  totalSwaps: number
  totalVolume: number
  feesSaved: number
  poolsAccessed: number
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount()
  const [attestation, setAttestation] = useState<PCSAttestation | null>(null)
  const [userTier, setUserTier] = useState<CreditTier | null>(null)
  const [pools, setPools] = useState<Pool[]>([])
  const [recommendations, setRecommendations] = useState<{
    bestValue: Pool[]
    highestRewards: Pool[]
    lowestRisk: Pool[]
  } | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    totalSwaps: 0,
    totalVolume: 0,
    feesSaved: 0,
    poolsAccessed: 0
  })
  const [userXP, setUserXP] = useState<UserXP>({
    level: 1,
    currentXP: 0,
    xpToNextLevel: 100,
    totalXP: 0,
    badges: []
  })

  useEffect(() => {
    const loadUserData = async () => {
      if (!address) return

      // Load user attestation
      const storedAttestation = getStoredAttestation(address)
      if (storedAttestation) {
        const pcsAttestation: PCSAttestation = {
          id: `att-${Date.now()}`,
          score: storedAttestation.score,
          tier: storedAttestation.tier,
          issuer: 'CCR-AVS',
          issuedAt: new Date(storedAttestation.attestation.issuedAt),
          expiresAt: new Date(storedAttestation.attestation.expiresAt),
          operator: storedAttestation.attestation.operator,
          signature: storedAttestation.attestation.signature,
          published: true
        }
        setAttestation(pcsAttestation)
        setUserTier(storedAttestation.tier)

        // Load mock stats based on tier
        const mockStats = generateMockStats(storedAttestation.tier, storedAttestation.score)
        setStats(mockStats)

        // Generate XP based on score and tier
        const mockXP = generateMockXP(storedAttestation.tier, storedAttestation.score)
        setUserXP(mockXP)
      }

      // Load pools and recommendations
      const mockPools = generateMockPools()
      setPools(mockPools)

      if (storedAttestation) {
        const recs = getPoolRecommendations(mockPools, storedAttestation.tier)
        setRecommendations(recs)
      }
    }

    loadUserData()
  }, [address])

  const generateMockStats = (tier: CreditTier, score: number): DashboardStats => {
    const tierMultiplier = {
      bronze: 1,
      silver: 1.5,
      gold: 2.5,
      platinum: 4,
      diamond: 6
    }[tier] || 1

    const baseStats = {
      totalSwaps: Math.round(25 * tierMultiplier + (score / 100) * 10),
      totalVolume: Math.round(50000 * tierMultiplier + (score / 100) * 25000),
      feesSaved: Math.round(150 * tierMultiplier + (score / 100) * 75),
      poolsAccessed: Math.round(5 * tierMultiplier)
    }

    return baseStats
  }

  const generateMockXP = (tier: CreditTier, score: number): UserXP => {
    const tierLevel = {
      bronze: 3,
      silver: 5,
      gold: 7,
      platinum: 9,
      diamond: 12
    }[tier] || 1

    const level = tierLevel + Math.floor(score / 200)
    const totalXP = (level - 1) * 250 + (score % 200)
    const currentXP = totalXP % 250
    const xpToNextLevel = 250

    const badges = [
      {
        id: 'badge-001',
        name: 'First Steps',
        description: 'Completed your first PCS request',
        icon: '🚀',
        tier: 'bronze' as CreditTier,
        unlockedAt: new Date('2024-01-10')
      },
      {
        id: 'badge-002',
        name: 'Pool Explorer',
        description: 'Explored 10+ different pools',
        icon: '🔍',
        tier: 'silver' as CreditTier,
        unlockedAt: new Date('2024-01-20')
      }
    ]

    if (tier !== 'bronze') {
      badges.push({
        id: 'badge-003',
        name: `${tier.charAt(0).toUpperCase() + tier.slice(1)} Achiever`,
        description: `Reached ${tier} credit tier`,
        icon: tier === 'gold' ? '🏆' : tier === 'platinum' ? '💎' : '💠',
        tier: tier,
        unlockedAt: new Date('2024-02-01')
      })
    }

    return {
      level,
      currentXP,
      xpToNextLevel,
      totalXP,
      badges
    }
  }

  const handleRefreshAttestation = () => {
    // Navigate to demo page to request new attestation
    window.location.href = '/demo'
  }

  const handleDownloadHistory = () => {
    const data = {
      attestation,
      stats,
      userXP,
      exportedAt: new Date().toISOString()
    }

    const dataStr = JSON.stringify(data, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)

    const exportFileDefaultName = `ccr-dashboard-${address?.slice(0, 8)}.json`

    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <Card className="glass-card border border-white/20 max-w-md w-full">
          <CardHeader className="text-center">
            <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <CardTitle>Dashboard Access</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-6">
              Connect your wallet to access your CCR Hook dashboard
            </p>
            <Button disabled className="w-full">
              Connect Wallet First
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!attestation) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <Card className="glass-card border border-white/20 max-w-md w-full">
          <CardHeader className="text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <CardTitle>No Attestation Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-6">
              You haven't requested a credit attestation yet. Get started to unlock your dashboard.
            </p>
            <Button
              onClick={() => window.location.href = '/demo'}
              className="w-full bg-gradient-to-r from-primary to-secondary"
            >
              Request Credit Attestation
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-8"
        >
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold font-display mb-2">
                Welcome back! 👋
              </h1>
              <p className="text-muted-foreground">
                Manage your credit tier and track your DeFi journey
              </p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={handleDownloadHistory}
                className="glass-card"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Data
              </Button>
              <Button
                onClick={handleRefreshAttestation}
                className="bg-gradient-to-r from-primary to-secondary"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Update Credit
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          {[
            {
              title: 'Total Swaps',
              value: stats.totalSwaps.toLocaleString(),
              icon: TrendingUp,
              color: 'text-blue-500'
            },
            {
              title: 'Volume Traded',
              value: `$${stats.totalVolume.toLocaleString()}`,
              icon: BarChart3,
              color: 'text-green-500'
            },
            {
              title: 'Fees Saved',
              value: `$${stats.feesSaved.toLocaleString()}`,
              icon: Zap,
              color: 'text-yellow-500'
            },
            {
              title: 'Pools Accessed',
              value: stats.poolsAccessed.toString(),
              icon: Eye,
              color: 'text-purple-500'
            }
          ].map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="glass-card border border-white/20 hover:border-white/30 transition-all duration-300">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.title}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                    <stat.icon className={`h-8 w-8 ${stat.color}`} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Main Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid grid-cols-4 glass-card border border-white/20">
              <TabsTrigger value="overview">
                <User className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="attestation">
                <Shield className="h-4 w-4 mr-2" />
                Attestation
              </TabsTrigger>
              <TabsTrigger value="pools">
                <BarChart3 className="h-4 w-4 mr-2" />
                Pools
              </TabsTrigger>
              <TabsTrigger value="achievements">
                <Award className="h-4 w-4 mr-2" />
                Progress
              </TabsTrigger>
            </TabsList>

            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Current Attestation */}
                <AttestationCard
                  attestation={attestation}
                  variant="detailed"
                  showActions={true}
                  onPublish={() => alert('Publishing to registry...')}
                  onDownload={() => alert('Downloading attestation...')}
                  onRefresh={handleRefreshAttestation}
                />

                {/* XP Progress */}
                <XPProgress userXP={userXP} variant="detailed" />
              </div>

              {/* Recommendations */}
              {recommendations && (
                <Card className="glass-card border border-white/20">
                  <CardHeader>
                    <CardTitle>Recommended for You</CardTitle>
                    <p className="text-muted-foreground">
                      Based on your {userTier?.toUpperCase()} tier status
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-3 gap-4">
                      {recommendations.bestValue.slice(0, 3).map((pool) => (
                        <PoolCard
                          key={pool.id}
                          pool={pool}
                          userTier={userTier || undefined}
                          onSimulateSwap={() => window.location.href = `/pools/${pool.id}`}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Attestation Details Tab */}
            <TabsContent value="attestation" className="space-y-6">
              <div className="max-w-2xl mx-auto">
                <AttestationCard
                  attestation={attestation}
                  variant="detailed"
                  showActions={true}
                  onPublish={() => alert('Publishing to registry...')}
                  onDownload={() => alert('Downloading attestation...')}
                  onRefresh={handleRefreshAttestation}
                />

                {/* Attestation Timeline */}
                <Card className="glass-card border border-white/20 mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Attestation Timeline
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-4 p-4 border border-green-500/30 bg-green-500/10 rounded-lg">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <div className="flex-1">
                          <p className="font-medium">Attestation Issued</p>
                          <p className="text-sm text-muted-foreground">
                            {attestation.issuedAt.toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="default" className="bg-green-500">Active</Badge>
                      </div>

                      <div className="flex items-center gap-4 p-4 border border-yellow-500/30 bg-yellow-500/10 rounded-lg">
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <div className="flex-1">
                          <p className="font-medium">Expires</p>
                          <p className="text-sm text-muted-foreground">
                            {attestation.expiresAt.toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="outline">
                          {Math.ceil((attestation.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Pools Tab */}
            <TabsContent value="pools" className="space-y-6">
              {recommendations && (
                <div className="space-y-8">
                  <div>
                    <h3 className="text-xl font-semibold mb-4">Best Value Pools</h3>
                    <div className="grid md:grid-cols-3 gap-6">
                      {recommendations.bestValue.map((pool) => (
                        <PoolCard
                          key={pool.id}
                          pool={pool}
                          userTier={userTier || undefined}
                          onSimulateSwap={() => window.location.href = `/pools/${pool.id}`}
                          onViewDetails={() => window.location.href = `/pools/${pool.id}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold mb-4">Highest Rewards</h3>
                    <div className="grid md:grid-cols-3 gap-6">
                      {recommendations.highestRewards.map((pool) => (
                        <PoolCard
                          key={pool.id}
                          pool={pool}
                          userTier={userTier || undefined}
                          onSimulateSwap={() => window.location.href = `/pools/${pool.id}`}
                          onViewDetails={() => window.location.href = `/pools/${pool.id}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="text-center">
                    <Button
                      variant="outline"
                      onClick={() => window.location.href = '/pools'}
                      className="glass-card"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      View All Pools
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Progress Tab */}
            <TabsContent value="achievements" className="space-y-6">
              <div className="max-w-2xl mx-auto">
                <XPProgress userXP={userXP} variant="detailed" showBadges={true} />

                {/* Achievement History */}
                <Card className="glass-card border border-white/20 mt-6">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5" />
                      Achievement History
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {userXP.badges.map((badge, index) => (
                        <motion.div
                          key={badge.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center gap-4 p-4 border border-white/20 rounded-lg bg-white/5"
                        >
                          <div className="text-3xl">{badge.icon}</div>
                          <div className="flex-1">
                            <p className="font-medium">{badge.name}</p>
                            <p className="text-sm text-muted-foreground">{badge.description}</p>
                          </div>
                          <div className="text-right">
                            <Badge className={`tier-${badge.tier} text-xs`}>
                              {badge.tier.toUpperCase()}
                            </Badge>
                            {badge.unlockedAt && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {badge.unlockedAt.toLocaleDateString()}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </div>
    </div>
  )
}