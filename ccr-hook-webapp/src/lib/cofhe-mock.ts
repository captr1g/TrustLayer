/**
 * Mock implementation of cofhejs for demonstration purposes
 * In production, this would use actual FHE encryption
 */

import { CreditTier } from './types'

export interface WalletFeatures {
  transactionCount: number
  walletAge: number // days
  totalVolume: number // USD
  lpPositions: number
  uniqueProtocols: number
  defiInteractions: number
  nftActivity: boolean
  ensName: boolean
}

export interface EncryptedData {
  ciphertext: string
  publicKey: string
  timestamp: number
  version: string
}

export interface PCSComputeResult {
  score: number
  tier: CreditTier
  confidence: number
  factors: {
    activity: number
    volume: number
    diversity: number
    history: number
  }
  attestation: {
    signature: string
    operator: string
    issuedAt: Date
    expiresAt: Date
  }
}

/**
 * Mock encryption function
 * Simulates FHE encryption by creating a base64 encoded representation
 */
export async function encrypt(features: WalletFeatures): Promise<EncryptedData> {
  // Simulate encryption delay
  await new Promise(resolve => setTimeout(resolve, 500))

  // Create deterministic "encrypted" data based on features
  const dataString = JSON.stringify(features)
  const ciphertext = btoa(dataString) // Base64 encode for mock

  return {
    ciphertext: `FHE_MOCK_${ciphertext}`,
    publicKey: `0x${Math.random().toString(16).substring(2, 42)}`,
    timestamp: Date.now(),
    version: '1.0.0-mock'
  }
}

/**
 * Mock decryption function (for testing only)
 * In production, only the AVS can decrypt
 */
export async function decrypt(encryptedData: EncryptedData): Promise<WalletFeatures> {
  // Simulate decryption delay
  await new Promise(resolve => setTimeout(resolve, 300))

  const ciphertext = encryptedData.ciphertext.replace('FHE_MOCK_', '')
  const dataString = atob(ciphertext)
  return JSON.parse(dataString)
}

/**
 * Calculate credit score from wallet features
 * This is a simplified scoring algorithm for demonstration
 */
export function calculateCreditScore(features: WalletFeatures): PCSComputeResult {
  // Base score calculation
  let baseScore = 300 // Starting score

  // Activity factor (0-250 points)
  const activityScore = Math.min(250,
    (features.transactionCount * 0.5) +
    (features.defiInteractions * 2) +
    (features.uniqueProtocols * 10)
  )

  // Volume factor (0-200 points)
  const volumeScore = Math.min(200,
    Math.log10(features.totalVolume + 1) * 20
  )

  // History factor (0-150 points)
  const historyScore = Math.min(150,
    (features.walletAge / 30) * 10 + // months active
    (features.ensName ? 20 : 0)
  )

  // Diversity factor (0-100 points)
  const diversityScore = Math.min(100,
    (features.lpPositions * 15) +
    (features.nftActivity ? 20 : 0) +
    (features.uniqueProtocols * 5)
  )

  const totalScore = Math.round(
    baseScore + activityScore + volumeScore + historyScore + diversityScore
  )

  // Determine tier
  let tier: CreditTier
  if (totalScore >= 900) tier = 'diamond'
  else if (totalScore >= 800) tier = 'platinum'
  else if (totalScore >= 600) tier = 'gold'
  else if (totalScore >= 400) tier = 'silver'
  else tier = 'bronze'

  // Calculate confidence based on data completeness
  const dataPoints = Object.values(features).filter(v => v !== null && v !== undefined).length
  const confidence = (dataPoints / Object.keys(features).length) * 100

  // Generate mock attestation
  const issuedAt = new Date()
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 90) // 90 days validity

  return {
    score: totalScore,
    tier,
    confidence: Math.round(confidence),
    factors: {
      activity: Math.round(activityScore),
      volume: Math.round(volumeScore),
      diversity: Math.round(diversityScore),
      history: Math.round(historyScore)
    },
    attestation: {
      signature: `0xmock_sig_${Math.random().toString(16).substring(2, 66)}`,
      operator: `0x${Math.random().toString(16).substring(2, 42)}`,
      issuedAt,
      expiresAt
    }
  }
}

/**
 * Simulate AVS computation on encrypted data
 * In production, this happens on the AVS network
 */
export async function computePCS(encryptedData: EncryptedData): Promise<PCSComputeResult> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 1500))

  // In production, the AVS would decrypt and compute
  // For mock, we decrypt locally and compute
  const features = await decrypt(encryptedData)
  const result = calculateCreditScore(features)

  return result
}

/**
 * Generate mock wallet features based on wallet address
 * In production, this would fetch real on-chain data
 */
export async function collectWalletFeatures(address: string): Promise<WalletFeatures> {
  // Simulate RPC calls delay
  await new Promise(resolve => setTimeout(resolve, 800))

  // Generate deterministic mock data based on address
  const seed = parseInt(address.slice(2, 10), 16)
  const random = (min: number, max: number) => {
    const rand = (seed * 9301 + 49297) % 233280
    return min + (rand / 233280) * (max - min)
  }

  return {
    transactionCount: Math.round(random(10, 500)),
    walletAge: Math.round(random(30, 1000)),
    totalVolume: Math.round(random(1000, 1000000)),
    lpPositions: Math.round(random(0, 10)),
    uniqueProtocols: Math.round(random(1, 20)),
    defiInteractions: Math.round(random(5, 200)),
    nftActivity: random(0, 1) > 0.5,
    ensName: random(0, 1) > 0.3
  }
}

/**
 * Store attestation locally (mock storage)
 */
export function storeAttestation(
  address: string,
  result: PCSComputeResult
): void {
  const key = `ccr_attestation_${address.toLowerCase()}`
  const data = {
    ...result,
    storedAt: Date.now()
  }
  localStorage.setItem(key, JSON.stringify(data))
}

/**
 * Retrieve stored attestation
 */
export function getStoredAttestation(address: string): PCSComputeResult | null {
  const key = `ccr_attestation_${address.toLowerCase()}`
  const stored = localStorage.getItem(key)

  if (!stored) return null

  try {
    const data = JSON.parse(stored)
    // Check if attestation is expired
    const expiresAt = new Date(data.attestation.expiresAt)
    if (expiresAt < new Date()) {
      localStorage.removeItem(key)
      return null
    }
    return data
  } catch {
    return null
  }
}