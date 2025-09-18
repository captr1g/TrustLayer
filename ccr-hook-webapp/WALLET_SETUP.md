# 🔐 Wallet Setup Guide

## Current Status
✅ **Wallet connection is working!** The app uses a demo WalletConnect project ID for testing.

## For Production Use

To set up your own WalletConnect project ID:

### 1. Get Your Project ID
1. Go to [WalletConnect Cloud](https://cloud.walletconnect.com)
2. Create a free account
3. Create a new project
4. Copy your Project ID

### 2. Update Environment
Replace the project ID in `.env.local`:
```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_actual_project_id_here
```

### 3. Supported Features
- ✅ MetaMask connection
- ✅ WalletConnect protocol
- ✅ Network switching (Mainnet, Sepolia, Hardhat)
- ✅ Real-time balance fetching
- ✅ Transaction signing capability
- ✅ Multi-wallet support

### 4. Testing Networks
The app supports these networks:
- **Ethereum Mainnet** (Chain ID: 1)
- **Sepolia Testnet** (Chain ID: 11155111)
- **Hardhat Local** (Chain ID: 31337)

### 5. Troubleshooting
If you see "403 Forbidden" errors:
- The WalletConnect project ID may be invalid
- Check your `.env.local` file exists and has the correct variable name
- Restart the development server after changing environment variables

## Current Demo Features
- Real wallet connection with MetaMask/WalletConnect
- Live ETH balance display
- Network detection and switching
- Simulated credit scoring based on wallet balance
- Real-time blockchain data (block numbers, etc.)