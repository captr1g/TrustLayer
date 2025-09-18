import { NextRequest, NextResponse } from 'next/server'
import { EncryptedData, computePCS } from '@/lib/cofhe-mock'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.encrypted) {
      return NextResponse.json(
        { error: 'Missing encrypted data' },
        { status: 400 }
      )
    }

    const encryptedData = body.encrypted as EncryptedData

    // Simulate AVS computation
    const result = await computePCS(encryptedData)

    // Add request metadata
    const response = {
      success: true,
      result,
      metadata: {
        processedAt: new Date().toISOString(),
        avsVersion: '1.0.0',
        operator: result.attestation.operator
      }
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('PCS computation error:', error)
    return NextResponse.json(
      { error: 'Failed to compute PCS' },
      { status: 500 }
    )
  }
}