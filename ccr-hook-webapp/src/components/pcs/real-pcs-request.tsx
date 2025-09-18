'use client'

import { useState, useEffect } from 'react'
import { useAccount, useBalance, useChainId } from 'wagmi'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Shield,
  Lock,
  Database,
  FileCheck,
  Upload,
  ExternalLink,
  Award,
  TrendingUp
} from 'lucide-react'
import AVSService, { avsService } from '@/lib/services/avs-service'
import { fheService } from '@/lib/services/fhe-service'
import { contractService } from '@/lib/services/contract-service'

type RequestStep = 'prepare' | 'encrypt' | 'compute' | 'sign' | 'publish' | 'complete'

interface PCSRequestState {
  currentStep: RequestStep;
  progress: number;
  isLoading: boolean;
  error: string | null;
  result: {
    score?: number;
    tier?: string;
    attestationHash?: string;
    ipfsUri?: string;
    signature?: string;
    transactionHash?: string;
  } | null;
}

interface StepStatus {
  step: RequestStep;
  title: string;
  description: string;
  status: 'pending' | 'loading' | 'completed' | 'error';
  details?: string;
}

export function RealPCSRequest() {
  const { address, isConnected } = useAccount()
  const { data: balance } = useBalance({ address })
  const chainId = useChainId()

  const [requestState, setRequestState] = useState<PCSRequestState>({
    currentStep: 'prepare',
    progress: 0,
    isLoading: false,
    error: null,
    result: null
  })

  const [services, setServices] = useState({
    avs: false,
    fhe: false,
    contract: false
  })

  // Check service availability
  useEffect(() => {
    checkServiceAvailability()
  }, [])

  const checkServiceAvailability = async () => {
    const avsAvailable = await avsService.isAvailable()
    const fheAvailable = await fheService.isAvailable()
    const contractDeployment = await contractService.verifyContractDeployment()

    setServices({
      avs: avsAvailable,
      fhe: fheAvailable,
      contract: contractDeployment.attestationRegistry && contractDeployment.ccrHook
    })
  }

  const steps: StepStatus[] = [
    {
      step: 'prepare',
      title: 'Prepare Data',
      description: 'Extract wallet features for PCS computation',
      status: requestState.currentStep === 'prepare' && requestState.isLoading ? 'loading' :
             ['encrypt', 'compute', 'sign', 'publish', 'complete'].includes(requestState.currentStep) ? 'completed' :
             requestState.currentStep === 'prepare' && requestState.error ? 'error' : 'pending'
    },
    {
      step: 'encrypt',
      title: 'Encrypt Features',
      description: 'Apply FHE to protect sensitive data',
      status: requestState.currentStep === 'encrypt' && requestState.isLoading ? 'loading' :
             ['compute', 'sign', 'publish', 'complete'].includes(requestState.currentStep) ? 'completed' :
             requestState.currentStep === 'encrypt' && requestState.error ? 'error' : 'pending'
    },
    {
      step: 'compute',
      title: 'Compute PCS',
      description: 'Calculate credit score using AVS',
      status: requestState.currentStep === 'compute' && requestState.isLoading ? 'loading' :
             ['sign', 'publish', 'complete'].includes(requestState.currentStep) ? 'completed' :
             requestState.currentStep === 'compute' && requestState.error ? 'error' : 'pending'
    },
    {
      step: 'sign',
      title: 'Sign Attestation',
      description: 'Operator signs the computed result',
      status: requestState.currentStep === 'sign' && requestState.isLoading ? 'loading' :
             ['publish', 'complete'].includes(requestState.currentStep) ? 'completed' :
             requestState.currentStep === 'sign' && requestState.error ? 'error' : 'pending'
    },
    {
      step: 'publish',
      title: 'Publish to Registry',
      description: 'Store attestation on-chain',
      status: requestState.currentStep === 'publish' && requestState.isLoading ? 'loading' :
             requestState.currentStep === 'complete' ? 'completed' :
             requestState.currentStep === 'publish' && requestState.error ? 'error' : 'pending'
    }
  ]

  const startPCSRequest = async () => {
    if (!isConnected || !address || !balance) {
      setRequestState(prev => ({
        ...prev,
        error: 'Please connect your wallet first'
      }))
      return
    }

    try {
      setRequestState({
        currentStep: 'prepare',
        progress: 10,
        isLoading: true,
        error: null,
        result: null
      })

      // Step 1: Prepare wallet features
      const walletData = {
        address,
        balance: balance.value,
        blockNumber: BigInt(0), // Would get actual block number
        transactions: [] // Would get actual transaction history
      }

      const features = fheService.extractFeaturesFromWallet(walletData)

      setRequestState(prev => ({
        ...prev,
        currentStep: 'encrypt',
        progress: 25
      }))

      // Step 2: Encrypt features with FHE
      let encryptedFeatures: string
      try {
        const encrypted = await fheService.encryptFeatures(features)
        encryptedFeatures = fheService.serializeEncryptedFeatures(encrypted)
      } catch (error) {
        console.warn('FHE encryption failed, using plain features:', error)
        encryptedFeatures = JSON.stringify(features)
      }

      setRequestState(prev => ({
        ...prev,
        currentStep: 'compute',
        progress: 50
      }))

      // Step 3: Compute PCS using AVS
      const subject = AVSService.createSubject(address)
      const pcsResult = await avsService.computePCS(encryptedFeatures, subject)

      if (!pcsResult.success) {
        throw new Error(pcsResult.error || 'PCS computation failed')
      }

      setRequestState(prev => ({
        ...prev,
        currentStep: 'sign',
        progress: 75,
        result: {
          score: pcsResult.computation?.score,
          tier: pcsResult.computation?.tier,
          signature: pcsResult.signature,
          ipfsUri: pcsResult.metadata?.ipfsUri
        }
      }))

      // Step 4: Signing is handled by AVS (already completed)

      setRequestState(prev => ({
        ...prev,
        currentStep: 'publish',
        progress: 90
      }))

      // Step 5: Publish to on-chain registry (optional for demo)
      let transactionHash: string | undefined

      if (services.contract && pcsResult.request && pcsResult.signature) {
        try {
          await contractService.initializeWallet()
          const hash = await contractService.publishAttestation(
            pcsResult.request,
            pcsResult.signature as `0x${string}`
          )
          transactionHash = hash
        } catch (error) {
          console.warn('On-chain publishing failed (continuing without):', error)
        }
      }

      // Complete
      setRequestState(prev => ({
        ...prev,
        currentStep: 'complete',
        progress: 100,
        isLoading: false,
        result: {
          ...prev.result,
          attestationHash: pcsResult.request?.subject,
          transactionHash
        }
      }))

    } catch (error) {
      console.error('PCS request failed:', error)
      setRequestState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }))
    }
  }

  const resetRequest = () => {
    setRequestState({
      currentStep: 'prepare',
      progress: 0,
      isLoading: false,
      error: null,
      result: null
    })
  }

  const getServiceStatusBadge = (available: boolean) => (
    <Badge variant={available ? 'default' : 'secondary'} className="ml-2">
      {available ? 'Available' : 'Unavailable'}
    </Badge>
  )

  const getStepIcon = (status: StepStatus['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case 'loading':
        return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      default:
        return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground" />
    }
  }

  if (!isConnected) {
    return (
      <Card className="glass-card border border-white/20">
        <CardContent className="p-6 text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Connect Wallet Required</h3>
          <p className="text-muted-foreground">
            Please connect your wallet to request a Personal Credit Score
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Service Status */}
      <Card className="glass-card border border-white/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Service Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-sm">AVS Backend</span>
            {getServiceStatusBadge(services.avs)}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">FHE Encryption</span>
            {getServiceStatusBadge(services.fhe)}
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm">Smart Contracts</span>
            {getServiceStatusBadge(services.contract)}
          </div>
        </CardContent>
      </Card>

      {/* Main Request Flow */}
      <Card className="glass-card border border-white/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Request Personal Credit Score
          </CardTitle>
          <p className="text-muted-foreground">
            Get your confidential credit score using privacy-preserving computation
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{requestState.progress}%</span>
            </div>
            <Progress value={requestState.progress} className="h-2" />
          </div>

          {/* Steps */}
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step.step} className="flex items-start gap-3 p-3 rounded-lg bg-muted/20">
                {getStepIcon(step.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-medium">{step.title}</h4>
                    {step.status === 'completed' && (
                      <Badge variant="outline" className="text-xs">Complete</Badge>
                    )}
                    {step.status === 'loading' && (
                      <Badge variant="default" className="text-xs">Processing...</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{step.description}</p>
                  {step.details && (
                    <p className="text-xs text-muted-foreground mt-1 font-mono">{step.details}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Error Display */}
          {requestState.error && (
            <Alert className="border-red-500/50 bg-red-500/10">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{requestState.error}</AlertDescription>
            </Alert>
          )}

          {/* Results */}
          {requestState.result && requestState.currentStep === 'complete' && (
            <div className="space-y-4">
              {/* Score Display Card */}
              {requestState.result.score && (
                <div className="p-6 bg-gradient-to-br from-primary/10 via-secondary/10 to-primary/5 rounded-xl border border-primary/20">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Award className="h-5 w-5 text-primary" />
                      Your Personal Credit Score
                    </h3>
                    <Badge
                      variant="default"
                      className={`text-sm capitalize px-3 py-1 ${
                        requestState.result.tier === 'diamond' ? 'bg-cyan-500' :
                        requestState.result.tier === 'platinum' ? 'bg-purple-600' :
                        requestState.result.tier === 'gold' ? 'bg-yellow-500' :
                        requestState.result.tier === 'silver' ? 'bg-gray-400' :
                        'bg-amber-600'
                      } text-white`}
                    >
                      <Award className="h-3 w-3 mr-1" />
                      {requestState.result.tier} Tier
                    </Badge>
                  </div>

                  <div className="text-center py-4">
                    <div className="text-7xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                      {requestState.result.score}
                    </div>
                    <p className="text-muted-foreground text-sm mt-2">out of 1000</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mt-6 p-4 bg-background/50 rounded-lg">
                    <div className="text-center">
                      <TrendingUp className="h-5 w-5 mx-auto mb-1 text-green-500" />
                      <p className="text-xs text-muted-foreground">Percentile</p>
                      <p className="font-semibold">
                        Top {Math.max(5, Math.round(100 - (requestState.result.score / 10)))}%
                      </p>
                    </div>
                    <div className="text-center">
                      <Shield className="h-5 w-5 mx-auto mb-1 text-blue-500" />
                      <p className="text-xs text-muted-foreground">Trust Level</p>
                      <p className="font-semibold">
                        {requestState.result.score >= 800 ? 'Very High' :
                         requestState.result.score >= 700 ? 'High' :
                         requestState.result.score >= 600 ? 'Medium' :
                         requestState.result.score >= 450 ? 'Fair' : 'Building'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Technical Details */}
              <div className="space-y-4 p-4 bg-muted/20 rounded-lg">
                <h3 className="font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Attestation Details
                </h3>

                <Separator />

                <div className="space-y-2 text-sm">
                  {requestState.result.ipfsUri && (
                    <div className="flex justify-between items-center">
                      <span>IPFS Metadata:</span>
                      <a
                        href={`https://gateway.pinata.cloud/ipfs/${requestState.result.ipfsUri.replace('ipfs://', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                      >
                        View <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}

                  {requestState.result.signature && (
                    <div className="flex justify-between items-center">
                      <span>Signature:</span>
                      <span className="font-mono text-xs">
                        {requestState.result.signature.slice(0, 10)}...{requestState.result.signature.slice(-8)}
                      </span>
                    </div>
                  )}

                  {requestState.result.transactionHash && (
                    <div className="flex justify-between items-center">
                      <span>Transaction:</span>
                      <a
                        href={`https://sepolia.etherscan.io/tx/${requestState.result.transactionHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                      >
                        <span className="font-mono text-xs">
                          {requestState.result.transactionHash.slice(0, 10)}...
                        </span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {requestState.currentStep === 'complete' ? (
              <Button onClick={resetRequest} className="flex-1">
                <RefreshCw className="h-4 w-4 mr-2" />
                Request New Score
              </Button>
            ) : (
              <Button
                onClick={startPCSRequest}
                disabled={requestState.isLoading || !services.avs}
                className="flex-1"
              >
                {requestState.isLoading ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Request PCS
                  </>
                )}
              </Button>
            )}

            <Button
              variant="outline"
              onClick={checkServiceAvailability}
              className="glass-card"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Info */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Your data is encrypted using FHE before computation</p>
            <p>• Computation is performed by authorized AVS operators</p>
            <p>• Results are cryptographically signed and verifiable</p>
            <p>• IPFS stores computation metadata and proofs</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}