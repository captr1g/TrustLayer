'use client'

import { useState, useEffect } from 'react'
import { useAccount, useChainId, useSwitchChain, useConnect, useDisconnect } from 'wagmi'
import { mainnet, sepolia, hardhat } from 'wagmi/chains'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Wallet, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'

const SUPPORTED_NETWORKS = [
  { ...mainnet, name: 'Ethereum Mainnet' },
  { ...sepolia, name: 'Sepolia Testnet' },
  { ...hardhat, name: 'Hardhat Local' }
]

const REQUIRED_NETWORK_ID = sepolia.id // Default to sepolia for testing

export function WalletTest() {
  const { address, isConnected, connector } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending: isSwitching, error: switchError } = useSwitchChain()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()

  const [isWrongNetwork, setIsWrongNetwork] = useState(false)
  const [selectedRequiredNetwork, setSelectedRequiredNetwork] = useState(REQUIRED_NETWORK_ID)

  const currentNetwork = SUPPORTED_NETWORKS.find(network => network.id === chainId)
  const requiredNetwork = SUPPORTED_NETWORKS.find(network => network.id === selectedRequiredNetwork)

  useEffect(() => {
    if (isConnected) {
      setIsWrongNetwork(chainId !== selectedRequiredNetwork)
    }
  }, [chainId, selectedRequiredNetwork, isConnected])

  const handleConnect = () => {
    const injectedConnector = connectors.find(c => c.type === 'injected')
    if (injectedConnector) {
      connect({ connector: injectedConnector })
    }
  }

  const handleSwitchNetwork = async () => {
    try {
      await switchChain({ chainId: selectedRequiredNetwork })
    } catch (error) {
      console.error('Failed to switch network:', error)
    }
  }

  const getNetworkStatus = () => {
    if (!isConnected) return { status: 'disconnected', color: 'secondary' }
    if (isWrongNetwork) return { status: 'wrong-network', color: 'destructive' }
    return { status: 'correct-network', color: 'default' }
  }

  const networkStatus = getNetworkStatus()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="glass-card border border-white/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Wallet Connection Test
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Wallet Connection Status */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Connection Status</h3>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                {isConnected ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-sm">
                  {isConnected ? 'Wallet Connected' : 'Wallet Disconnected'}
                </span>
              </div>
              <Badge variant={isConnected ? 'default' : 'secondary'}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>

            {isConnected && address && (
              <div className="text-xs text-muted-foreground">
                Address: {address.slice(0, 6)}...{address.slice(-4)}
              </div>
            )}
          </div>

          {/* Network Selection for Testing */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Required Network (Test Setting)</h3>
            <div className="grid grid-cols-3 gap-2">
              {SUPPORTED_NETWORKS.map((network) => (
                <Button
                  key={network.id}
                  variant={selectedRequiredNetwork === network.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedRequiredNetwork(network.id)}
                  className="text-xs"
                >
                  {network.name}
                </Button>
              ))}
            </div>
          </div>

          {/* Current Network Status */}
          {isConnected && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium">Current Network</h3>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  {isWrongNetwork ? (
                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                  ) : (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  )}
                  <span className="text-sm">
                    {currentNetwork?.name || `Unknown Network (${chainId})`}
                  </span>
                </div>
                <Badge variant={networkStatus.color}>
                  {isWrongNetwork ? 'Wrong Network' : 'Correct Network'}
                </Badge>
              </div>
            </div>
          )}

          {/* Network Mismatch Alert */}
          {isConnected && isWrongNetwork && (
            <Alert className="border-orange-500/50 bg-orange-500/10">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your wallet is connected to <strong>{currentNetwork?.name || 'an unsupported network'}</strong>,
                but this application requires <strong>{requiredNetwork?.name}</strong>.
                Please switch networks to continue.
              </AlertDescription>
            </Alert>
          )}

          {/* Switch Network Error */}
          {switchError && (
            <Alert className="border-red-500/50 bg-red-500/10">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Failed to switch network: {switchError.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {!isConnected ? (
              <Button
                onClick={handleConnect}
                disabled={isConnecting}
                className="flex-1"
              >
                {isConnecting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Connecting...
                  </>
                ) : (
                  <>
                    <Wallet className="h-4 w-4 mr-2" />
                    Connect Wallet
                  </>
                )}
              </Button>
            ) : (
              <>
                {isWrongNetwork && (
                  <Button
                    onClick={handleSwitchNetwork}
                    disabled={isSwitching}
                    variant="default"
                    className="flex-1"
                  >
                    {isSwitching ? (
                      <>
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                        Switching...
                      </>
                    ) : (
                      <>
                        Switch to {requiredNetwork?.name}
                      </>
                    )}
                  </Button>
                )}
                <Button
                  onClick={() => disconnect()}
                  variant="outline"
                  className={isWrongNetwork ? "flex-none" : "flex-1"}
                >
                  Disconnect
                </Button>
              </>
            )}
          </div>

          {/* Test Results */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Test Results</h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span>Wallet Connection:</span>
                <Badge variant={isConnected ? 'default' : 'secondary'} className="text-xs">
                  {isConnected ? 'PASS' : 'FAIL'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Network Validation:</span>
                <Badge
                  variant={isConnected && !isWrongNetwork ? 'default' : isConnected ? 'destructive' : 'secondary'}
                  className="text-xs"
                >
                  {!isConnected ? 'N/A' : isWrongNetwork ? 'FAIL' : 'PASS'}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Ready for DApp:</span>
                <Badge
                  variant={isConnected && !isWrongNetwork ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {isConnected && !isWrongNetwork ? 'READY' : 'NOT READY'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Card className="glass-card border border-white/20">
        <CardHeader>
          <CardTitle className="text-sm">How to Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <div>1. Select a required network above to test different scenarios</div>
          <div>2. Connect your wallet (MetaMask, etc.)</div>
          <div>3. If on wrong network, you'll see a warning and switch button</div>
          <div>4. Test the network switching functionality</div>
          <div>5. Verify all test results show "PASS" and "READY"</div>
        </CardContent>
      </Card>
    </div>
  )
}