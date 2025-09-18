'use client'

import { useState } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  Shield,
  Lock,
  Zap,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Download,
  Upload,
  ArrowRight
} from 'lucide-react'
import {
  collectWalletFeatures,
  encrypt,
  computePCS,
  storeAttestation,
  WalletFeatures,
  PCSComputeResult
} from '@/lib/cofhe-mock'
import { AttestationCard } from '@/components/ccr/attestation-card'
import { PCSAttestation, CreditTier } from '@/lib/types'

type FlowStep = 'idle' | 'collecting' | 'encrypting' | 'computing' | 'complete' | 'error'

interface StepProgress {
  step: number
  title: string
  description: string
  status: 'pending' | 'active' | 'complete' | 'error'
  icon: React.ElementType
}

export function PCSRequestFlow() {
  const { address, isConnected } = useAccount()
  const { signMessage } = useSignMessage()

  const [currentStep, setCurrentStep] = useState<FlowStep>('idle')
  const [progress, setProgress] = useState(0)
  const [features, setFeatures] = useState<WalletFeatures | null>(null)
  const [showFeatures, setShowFeatures] = useState(false)
  const [result, setResult] = useState<PCSComputeResult | null>(null)
  const [attestation, setAttestation] = useState<PCSAttestation | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showResultDialog, setShowResultDialog] = useState(false)

  const steps: StepProgress[] = [
    {
      step: 1,
      title: 'Collect On-Chain Data',
      description: 'Analyzing your wallet activity',
      status: currentStep === 'idle' ? 'pending' :
              currentStep === 'collecting' ? 'active' :
              ['encrypting', 'computing', 'complete'].includes(currentStep) ? 'complete' :
              'error',
      icon: Eye
    },
    {
      step: 2,
      title: 'Encrypt Locally',
      description: 'Protecting your data with FHE',
      status: ['idle', 'collecting'].includes(currentStep) ? 'pending' :
              currentStep === 'encrypting' ? 'active' :
              ['computing', 'complete'].includes(currentStep) ? 'complete' :
              'error',
      icon: Lock
    },
    {
      step: 3,
      title: 'AVS Processing',
      description: 'Computing your credit score',
      status: ['idle', 'collecting', 'encrypting'].includes(currentStep) ? 'pending' :
              currentStep === 'computing' ? 'active' :
              currentStep === 'complete' ? 'complete' :
              'error',
      icon: Zap
    },
    {
      step: 4,
      title: 'Receive Attestation',
      description: 'Your credit tier is ready',
      status: currentStep === 'complete' ? 'complete' : 'pending',
      icon: CheckCircle
    }
  ]

  const handleRequestPCS = async () => {
    if (!address) return

    try {
      setError(null)
      setCurrentStep('collecting')
      setProgress(10)

      // Step 1: Collect wallet features
      const walletFeatures = await collectWalletFeatures(address)
      setFeatures(walletFeatures)
      setProgress(30)

      // Step 2: Encrypt data
      setCurrentStep('encrypting')
      setProgress(40)
      const encryptedData = await encrypt(walletFeatures)
      setProgress(60)

      // Step 3: Compute PCS via API
      setCurrentStep('computing')
      setProgress(70)

      const response = await fetch('/api/compute/pcs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ encrypted: encryptedData })
      })

      if (!response.ok) {
        throw new Error('Failed to compute PCS')
      }

      const data = await response.json()
      setProgress(90)

      // Step 4: Process result
      setResult(data.result)

      // Convert to PCSAttestation format
      const pcsAttestation: PCSAttestation = {
        id: `att-${Date.now()}`,
        score: data.result.score,
        tier: data.result.tier,
        issuer: 'CCR-AVS',
        issuedAt: new Date(data.result.attestation.issuedAt),
        expiresAt: new Date(data.result.attestation.expiresAt),
        operator: data.result.attestation.operator,
        signature: data.result.attestation.signature,
        published: false
      }

      setAttestation(pcsAttestation)
      storeAttestation(address, data.result)

      setProgress(100)
      setCurrentStep('complete')
      setShowResultDialog(true)

    } catch (err) {
      console.error('PCS request error:', err)
      setError(err instanceof Error ? err.message : 'Failed to request PCS')
      setCurrentStep('error')
    }
  }

  const handlePublishOnChain = async () => {
    if (!attestation) return

    try {
      // In production, this would publish to blockchain
      // For now, just update local state
      const updatedAttestation = { ...attestation, published: true }
      setAttestation(updatedAttestation)
      alert('Attestation published on-chain successfully!')
    } catch (err) {
      console.error('Publish error:', err)
      alert('Failed to publish attestation')
    }
  }

  const handleDownloadAttestation = () => {
    if (!attestation) return

    const dataStr = JSON.stringify(attestation, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)

    const exportFileDefaultName = `ccr-attestation-${attestation.id}.json`

    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()
  }

  const resetFlow = () => {
    setCurrentStep('idle')
    setProgress(0)
    setFeatures(null)
    setResult(null)
    setAttestation(null)
    setError(null)
    setShowResultDialog(false)
  }

  if (!isConnected) {
    return (
      <Card className="glass-card border border-white/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            Request Credit Attestation
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            Connect your wallet to request a privacy-preserving credit attestation
          </p>
          <Button disabled>
            Connect Wallet First
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      <Card className="glass-card border border-white/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Request Credit Attestation
            </CardTitle>
            {currentStep !== 'idle' && (
              <Badge variant={currentStep === 'complete' ? 'default' : 'secondary'}>
                {currentStep === 'complete' ? 'Complete' : 'Processing'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Steps */}
          <div className="space-y-4">
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`flex items-center gap-4 p-4 rounded-xl transition-all duration-300 ${
                    step.status === 'active' ? 'glass-card border border-primary/50' :
                    step.status === 'complete' ? 'bg-green-500/10 border border-green-500/30' :
                    step.status === 'error' ? 'bg-red-500/10 border border-red-500/30' :
                    'bg-muted/20'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${
                    step.status === 'active' ? 'bg-primary text-white animate-pulse' :
                    step.status === 'complete' ? 'bg-green-500 text-white' :
                    step.status === 'error' ? 'bg-red-500 text-white' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {step.status === 'active' ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : step.status === 'complete' ? (
                      <CheckCircle className="h-5 w-5" />
                    ) : step.status === 'error' ? (
                      <AlertCircle className="h-5 w-5" />
                    ) : (
                      <Icon className="h-5 w-5" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{step.title}</div>
                    <div className="text-sm text-muted-foreground">{step.description}</div>
                  </div>
                  {step.status === 'active' && (
                    <div className="text-xs text-primary">Processing...</div>
                  )}
                </motion.div>
              )
            })}
          </div>

          {/* Progress Bar */}
          {currentStep !== 'idle' && currentStep !== 'error' && (
            <Progress value={progress} className="h-2" />
          )}

          {/* Features Preview (Step 1) */}
          {features && currentStep === 'collecting' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="glass-card p-4 rounded-xl border border-white/20"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium">Data to be Encrypted</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFeatures(!showFeatures)}
                >
                  {showFeatures ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              {showFeatures && (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Transactions:</span>
                    <span>{features.transactionCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Wallet Age:</span>
                    <span>{features.walletAge} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Volume:</span>
                    <span>${features.totalVolume.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">LP Positions:</span>
                    <span>{features.lpPositions}</span>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="bg-red-500/10 border border-red-500/30 rounded-lg p-4"
            >
              <div className="flex items-center gap-2 text-red-500">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">Error</span>
              </div>
              <p className="text-sm text-red-400 mt-1">{error}</p>
            </motion.div>
          )}

          {/* Action Button */}
          <div className="flex gap-4">
            {currentStep === 'idle' || currentStep === 'error' ? (
              <Button
                onClick={handleRequestPCS}
                size="lg"
                className="flex-1 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90"
              >
                <Shield className="h-4 w-4 mr-2" />
                Request PCS Attestation
              </Button>
            ) : currentStep === 'complete' ? (
              <>
                <Button
                  onClick={() => setShowResultDialog(true)}
                  size="lg"
                  variant="outline"
                  className="flex-1"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  View Attestation
                </Button>
                <Button
                  onClick={resetFlow}
                  size="lg"
                  variant="ghost"
                >
                  Request New
                </Button>
              </>
            ) : (
              <Button size="lg" disabled className="flex-1">
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processing...
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Result Dialog */}
      <Dialog open={showResultDialog} onOpenChange={setShowResultDialog}>
        <DialogContent className="glass-card border border-white/20 max-w-2xl">
          <DialogHeader>
            <DialogTitle>Your Credit Attestation</DialogTitle>
          </DialogHeader>

          {attestation && (
            <div className="space-y-6">
              <AttestationCard
                attestation={attestation}
                showActions={true}
                onPublish={handlePublishOnChain}
                onDownload={handleDownloadAttestation}
                onRefresh={resetFlow}
              />

              {result && (
                <div className="glass-card p-4 rounded-xl border border-white/20 space-y-3">
                  <h4 className="font-medium text-sm">Score Breakdown</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Activity:</span>
                        <span className="font-medium">{result.factors.activity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Volume:</span>
                        <span className="font-medium">{result.factors.volume}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Diversity:</span>
                        <span className="font-medium">{result.factors.diversity}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">History:</span>
                        <span className="font-medium">{result.factors.history}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-sm font-medium">Confidence Score:</span>
                    <span className="text-sm font-medium text-primary">{result.confidence}%</span>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  onClick={() => setShowResultDialog(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    setShowResultDialog(false)
                    // Navigate to pools page
                    window.location.href = '/pools'
                  }}
                  className="flex-1 bg-gradient-to-r from-primary to-secondary"
                >
                  Explore Pools
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}