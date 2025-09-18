'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { AttestationCard } from '@/components/ccr/attestation-card'
import { PoolCard } from '@/components/ccr/pool-card'
import { XPProgress } from '@/components/ccr/xp-progress'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PCSAttestation, Pool, UserXP, CreditTier } from '@/lib/types'
import { PlayCircle, Wallet, Shield, TrendingUp, Zap } from 'lucide-react'
import { PCSRequestFlow } from '@/components/pcs/request-flow'
import { SwapSimulatorComponent } from '@/components/swap/swap-simulator'
import { WalletTest } from '@/components/wallet/wallet-test'
import { RealWalletData } from '@/components/wallet/real-wallet-data'
import { RealPCSRequest } from '@/components/pcs/real-pcs-request'
import { AddressLookup } from '@/components/address-lookup/address-lookup'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'

// Mock data for demonstration
const mockAttestation: PCSAttestation = {
  id: 'att-001',
  score: 750,
  tier: 'gold',
  issuer: 'CCR-AVS',
  issuedAt: new Date('2024-01-15'),
  expiresAt: new Date('2024-04-15'),
  operator: '0x1234...5678',
  signature: 'sig-hash-123',
  published: true
}

const mockPools: Pool[] = [
  {
    id: 'pool-001',
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
    id: 'pool-002',
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

const mockUserXP: UserXP = {
  level: 7,
  currentXP: 1650,
  xpToNextLevel: 2000,
  totalXP: 15650,
  badges: [
    {
      id: 'badge-001',
      name: 'First Steps',
      description: 'Completed your first PCS request',
      icon: '🚀',
      tier: 'bronze',
      unlockedAt: new Date('2024-01-10')
    },
    {
      id: 'badge-002',
      name: 'Pool Explorer',
      description: 'Explored 10+ different pools',
      icon: '🔍',
      tier: 'silver',
      unlockedAt: new Date('2024-01-20')
    },
    {
      id: 'badge-003',
      name: 'Gold Achiever',
      description: 'Reached Gold credit tier',
      icon: '🏆',
      tier: 'gold',
      unlockedAt: new Date('2024-02-01')
    }
  ]
}

export default function DemoPage() {
  const [selectedTier, setSelectedTier] = useState<CreditTier>('gold')
  const { address, isConnected } = useAccount()

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
            <PlayCircle className="h-3 w-3 mr-2" />
            Interactive Demo
          </Badge>
          <h1 className="text-4xl md:text-6xl font-bold font-display mb-6">
            Experience{' '}
            <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              CCR Hook
            </span>{' '}
            Live
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto text-balance">
            Explore our privacy-preserving credit scoring system with real components
            and interactions. See how your credit tier affects pool access and benefits.
          </p>
        </motion.div>

        {/* Demo Sections */}
        <Tabs defaultValue="lookup" className="space-y-8">
          <TabsList className="grid grid-cols-9 glass-card border border-white/20 p-1 rounded-xl">
            <TabsTrigger value="lookup" className="data-[state=active]:bg-primary/20">
              <Shield className="h-4 w-4 mr-2" />
              Address Lookup
            </TabsTrigger>
            <TabsTrigger value="wallet" className="data-[state=active]:bg-primary/20">
              <Wallet className="h-4 w-4 mr-2" />
              Wallet Test
            </TabsTrigger>
            <TabsTrigger value="realdata" className="data-[state=active]:bg-primary/20">
              <TrendingUp className="h-4 w-4 mr-2" />
              Real Data
            </TabsTrigger>
            <TabsTrigger value="realpcs" className="data-[state=active]:bg-primary/20">
              <Shield className="h-4 w-4 mr-2" />
              Real PCS
            </TabsTrigger>
            <TabsTrigger value="request" className="data-[state=active]:bg-primary/20">
              <Zap className="h-4 w-4 mr-2" />
              Mock PCS
            </TabsTrigger>
            <TabsTrigger value="attestation" className="data-[state=active]:bg-primary/20">
              <Shield className="h-4 w-4 mr-2" />
              Attestation
            </TabsTrigger>
            <TabsTrigger value="pools" className="data-[state=active]:bg-primary/20">
              <TrendingUp className="h-4 w-4 mr-2" />
              Pools
            </TabsTrigger>
            <TabsTrigger value="gamification" className="data-[state=active]:bg-primary/20">
              <TrendingUp className="h-4 w-4 mr-2" />
              Gamification
            </TabsTrigger>
            <TabsTrigger value="simulation" className="data-[state=active]:bg-primary/20">
              <Wallet className="h-4 w-4 mr-2" />
              Simulation
            </TabsTrigger>
          </TabsList>

          {/* Address Lookup - NEW FEATURE */}
          <TabsContent value="lookup" className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <AddressLookup />
            </motion.div>
          </TabsContent>

          {/* Wallet Test */}
          <TabsContent value="wallet" className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Card className="glass-card border border-white/20 p-6">
                <CardHeader>
                  <CardTitle>Wallet Connection & Network Testing</CardTitle>
                  <p className="text-muted-foreground">
                    Test wallet connection and network switching functionality. This will validate if your wallet
                    is connected to the correct network and provide options to switch if needed.
                  </p>
                </CardHeader>
                <CardContent>
                  <WalletTest />
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Real Wallet Data */}
          <TabsContent value="realdata" className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Card className="glass-card border border-white/20 p-6">
                <CardHeader>
                  <CardTitle>Real Wallet Data Integration</CardTitle>
                  <p className="text-muted-foreground">
                    Connect your wallet to see real-time data from the blockchain.
                    This shows how your actual wallet data would be used for credit scoring.
                  </p>
                </CardHeader>
                <CardContent>
                  <RealWalletData />
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Real PCS Request */}
          <TabsContent value="realpcs" className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Card className="glass-card border border-white/20 p-6">
                <CardHeader>
                  <CardTitle>Real PCS Request Flow</CardTitle>
                  <p className="text-muted-foreground">
                    Request a real Personal Credit Score using the full backend pipeline:
                    FHE encryption, AVS computation, operator signing, and on-chain attestation.
                  </p>
                </CardHeader>
                <CardContent>
                  <RealPCSRequest />
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Mock PCS Request Flow */}
          <TabsContent value="request" className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <PCSRequestFlow />
            </motion.div>
          </TabsContent>

          {/* Attestation Demo */}
          <TabsContent value="attestation" className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Card className="glass-card border border-white/20 p-6">
                <CardHeader>
                  <CardTitle>Your Credit Attestation</CardTitle>
                  <p className="text-muted-foreground">
                    This is your privacy-preserving credit score attestation, signed by the AVS network.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="max-w-md mx-auto">
                    <AttestationCard
                      attestation={mockAttestation}
                      onPublish={() => alert('Publishing to on-chain registry...')}
                      onDownload={() => alert('Downloading attestation file...')}
                      onRefresh={() => alert('Requesting new attestation...')}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Pools Demo */}
          <TabsContent value="pools" className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Card className="glass-card border border-white/20 p-6">
                <CardHeader>
                  <CardTitle>Pool Explorer</CardTitle>
                  <p className="text-muted-foreground">
                    View available pools and see how your credit tier affects access and benefits.
                  </p>
                </CardHeader>
                <CardContent>
                  {/* Tier Selector */}
                  <div className="mb-6">
                    <p className="text-sm font-medium mb-3">Select your credit tier to see different access levels:</p>
                    <div className="flex gap-2 flex-wrap">
                      {(['bronze', 'silver', 'gold', 'platinum', 'diamond'] as CreditTier[]).map((tier) => (
                        <Button
                          key={tier}
                          variant={selectedTier === tier ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setSelectedTier(tier)}
                          className="capitalize"
                        >
                          {tier}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Pool Cards */}
                  <div className="grid md:grid-cols-2 gap-6">
                    {mockPools.map((pool) => (
                      <PoolCard
                        key={pool.id}
                        pool={pool}
                        userTier={selectedTier}
                        onSimulateSwap={(pool) => alert(`Simulating swap for ${pool.token0}/${pool.token1}...`)}
                        onViewDetails={(pool) => alert(`Viewing details for ${pool.token0}/${pool.token1}...`)}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Gamification Demo */}
          <TabsContent value="gamification" className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Card className="glass-card border border-white/20 p-6">
                <CardHeader>
                  <CardTitle>XP & Achievements</CardTitle>
                  <p className="text-muted-foreground">
                    Track your progress and unlock achievements as you use the platform.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="max-w-md mx-auto">
                    <XPProgress userXP={mockUserXP} />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* Simulation Demo */}
          <TabsContent value="simulation" className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <Card className="glass-card border border-white/20 p-6">
                <CardHeader>
                  <CardTitle>Swap Simulator</CardTitle>
                  <p className="text-muted-foreground">
                    Test how credit tier requirements affect your swap access and benefits.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    {mockPools.slice(0, 2).map((pool) => (
                      <SwapSimulatorComponent
                        key={pool.id}
                        pool={pool}
                        userTier={selectedTier}
                        onSwapSimulated={(simulation) => {
                          console.log('Swap simulated:', simulation)
                        }}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>
        </Tabs>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="text-center mt-16"
        >
          <Card className="glass-card border border-white/20 p-8 max-w-2xl mx-auto">
            <h3 className="text-2xl font-semibold mb-4">
              Ready to Get Started?
            </h3>
            <p className="text-muted-foreground mb-6">
              Connect your wallet to experience the full CCR Hook flow with real data.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {isConnected ? (
                <div className="text-center">
                  <div className="mb-4">
                    <Badge variant="default" className="text-sm px-4 py-2">
                      ✅ Wallet Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground">
                    You're all set! Use the wallet test above to verify network settings.
                  </p>
                </div>
              ) : (
                <>
                  <ConnectButton.Custom>
                    {({ openConnectModal }) => (
                      <Button
                        onClick={openConnectModal}
                        size="lg"
                        className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white"
                      >
                        Connect Wallet
                      </Button>
                    )}
                  </ConnectButton.Custom>
                  <Button variant="outline" size="lg" className="glass-card">
                    Learn More
                  </Button>
                </>
              )}
            </div>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}