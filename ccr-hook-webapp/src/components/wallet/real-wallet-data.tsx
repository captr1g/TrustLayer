'use client'

import { useState, useEffect } from 'react'
import { useAccount, useBalance, useChainId, useBlockNumber } from 'wagmi'
import { formatEther } from 'viem'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { RefreshCw, Wallet, TrendingUp, Clock, Network } from 'lucide-react'

export function RealWalletData() {
  const { address, isConnected, connector } = useAccount()
  const chainId = useChainId()
  const { data: blockNumber } = useBlockNumber()
  const { data: balance, isLoading: balanceLoading, refetch: refetchBalance } = useBalance({
    address,
  })

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  const networkNames: Record<number, string> = {
    1: 'Ethereum Mainnet',
    11155111: 'Sepolia Testnet',
    31337: 'Hardhat Local'
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refetchBalance()
      setLastUpdated(new Date())
    } catch (error) {
      console.error('Failed to refresh data:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    setLastUpdated(new Date())
  }, [address, chainId, blockNumber])

  if (!isConnected || !address) {
    return (
      <Card className="glass-card border border-white/20">
        <CardContent className="p-6 text-center">
          <Wallet className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No Wallet Connected</h3>
          <p className="text-muted-foreground">
            Connect your wallet to see real-time data
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Real-time Wallet Info */}
      <Card className="glass-card border border-white/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Live Wallet Data
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="glass-card"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Wallet Address */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Address:</span>
            <Badge variant="outline" className="font-mono text-xs">
              {address.slice(0, 8)}...{address.slice(-6)}
            </Badge>
          </div>

          {/* Network */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Network:</span>
            <Badge variant="default" className="flex items-center gap-1">
              <Network className="h-3 w-3" />
              {networkNames[chainId] || `Chain ${chainId}`}
            </Badge>
          </div>

          {/* Connector */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Connected via:</span>
            <Badge variant="secondary" className="capitalize">
              {connector?.name || 'Unknown'}
            </Badge>
          </div>

          <Separator />

          {/* Balance */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">ETH Balance:</span>
            <div className="text-right">
              {balanceLoading ? (
                <Badge variant="outline">Loading...</Badge>
              ) : balance ? (
                <div className="space-y-1">
                  <div className="font-mono text-sm">
                    {parseFloat(formatEther(balance.value)).toFixed(6)} ETH
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {balance.symbol}
                  </div>
                </div>
              ) : (
                <Badge variant="outline">N/A</Badge>
              )}
            </div>
          </div>

          {/* Block Number */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Latest Block:</span>
            <Badge variant="outline" className="font-mono">
              #{blockNumber?.toString() || 'Loading...'}
            </Badge>
          </div>

          {/* Last Updated */}
          <div className="flex justify-between items-center text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last updated:
            </span>
            <span>{lastUpdated.toLocaleTimeString()}</span>
          </div>
        </CardContent>
      </Card>

      {/* Credit Score Simulation */}
      <Card className="glass-card border border-white/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Simulated Credit Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground mb-4">
            Based on your connected wallet data:
          </div>

          {/* Simulated Credit Score */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Credit Score:</span>
            <Badge variant="default" className="text-lg px-3 py-1">
              {balance ? Math.floor(650 + (parseFloat(formatEther(balance.value)) * 100)) : 650}
            </Badge>
          </div>

          {/* Simulated Tier */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Credit Tier:</span>
            <Badge
              variant={balance && parseFloat(formatEther(balance.value)) > 1 ? "default" : "secondary"}
              className="capitalize"
            >
              {balance && parseFloat(formatEther(balance.value)) > 10 ? 'Platinum' :
               balance && parseFloat(formatEther(balance.value)) > 5 ? 'Gold' :
               balance && parseFloat(formatEther(balance.value)) > 1 ? 'Silver' : 'Bronze'}
            </Badge>
          </div>

          {/* Max Swap Amount */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Max Swap:</span>
            <Badge variant="outline" className="font-mono">
              ${balance ? (parseFloat(formatEther(balance.value)) * 50000).toLocaleString() : '10,000'}
            </Badge>
          </div>

          {/* Fee Discount */}
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">Fee Discount:</span>
            <Badge variant="outline">
              {balance && parseFloat(formatEther(balance.value)) > 10 ? '20%' :
               balance && parseFloat(formatEther(balance.value)) > 5 ? '15%' :
               balance && parseFloat(formatEther(balance.value)) > 1 ? '10%' : '5%'}
            </Badge>
          </div>

          <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted/50 rounded-lg">
            💡 <strong>Note:</strong> This is simulated data based on your wallet balance.
            In production, your actual credit score would be computed privately using
            confidential computing and multiple data sources.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}