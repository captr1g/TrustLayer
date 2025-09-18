import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mainnet, sepolia, hardhat } from 'wagmi/chains'

export const wagmiConfig = getDefaultConfig({
  appName: 'CCR Hook - Confidential Credit Risk',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '0ac7df7e3eb7b9c6a8c4d5e7f9b3e2d4',
  chains: [mainnet, sepolia, hardhat],
  ssr: true,
})