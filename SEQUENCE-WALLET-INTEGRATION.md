# Sequence Wallet Integration for AI Hedge Fund

This document explains how to set up and use the Sequence wallet integration in your AI Hedge Fund application.

## Overview

[Sequence](https://sequence.xyz/) is a smart contract wallet platform that enables seamless interactions with blockchain applications. Our AI Hedge Fund application can use Sequence wallets to perform transactions securely and efficiently.

## Installation

The necessary packages are already included in the project dependencies:

```bash
# These are already in package.json
@0xsequence/auth
@0xsequence/network
ethers
```

## Configuration

1. Create a `.env` file in your project root (or edit the existing one) and add the following variables:

```
# Wallet Configuration
WALLET_TYPE=sequence       # Options: 'soneium' or 'sequence'
MOCK_WALLET=true           # Set to false for real blockchain transactions

# Sequence Configuration
SEQUENCE_RPC_URL=https://your-sequence-rpc-endpoint
PROJECT_ACCESS_KEY=your_sequence_project_access_key
EVM_PRIVATE_KEY=your_private_key_here
CHAIN_ID=1                 # Ethereum=1, Polygon=137, etc.
```

## Usage

The application is designed to work with both Soneium and Sequence wallets through a common interface.

### Basic Usage

```typescript
import {
  WalletServiceFactory,
  WalletType,
} from "./services/WalletServiceFactory";

// Create wallet service
const walletService = WalletServiceFactory.createWalletService(
  WalletType.SEQUENCE
);
await walletService.initialize();

// Get wallet info
const walletInfo = await walletService.getWalletInfo();
console.log("Wallet Address:", walletInfo.address);
console.log("ETH Balance:", walletInfo.balances["ETH"]?.amount);

// Send a transaction
const tx = await walletService.sendTransaction(
  "0xRecipientAddress",
  "0.01", // ETH amount
  "0x" // data
);

// Execute a trade
const trade = await walletService.executeTrade(
  "0xTokenAddress",
  1000, // amount
  true // buy = true, sell = false
);
```

## Advanced Configuration

### Using Google Cloud KMS

For enhanced security, you can use Google Cloud KMS instead of raw private keys.

1. Install the additional package:

```bash
npm install @0xsequence/google-kms-signer
```

2. Set up GCP KMS and add the following environment variables:

```
PROJECT=your-gcp-project
LOCATION=us-central1
KEY_RING=sequence-keys
CRYPTO_KEY=wallet-key
CRYPTO_KEY_VERSION=1
```

3. Create a custom implementation of the signer using Google KMS:

```typescript
// See documentation at https://docs.sequence.xyz/sdk/typescript/guides/backend/integration
```

### Using AWS KMS

Similarly, you can use AWS KMS for key management.

1. Install the additional package:

```bash
npm install @0xsequence/aws-kms-signer
```

2. Set up AWS KMS and add the following environment variables:

```
AWS_REGION=us-east-1
AWS_KMS_KEY_ID=your-aws-kms-key-id
```

## Testing

You can test the Sequence wallet integration using the provided test script:

```bash
npm run test:sequence
```

This will initialize the wallet in mock mode and simulate transactions without using real funds.

## Benefits of Sequence Integration

- **Enhanced Security**: Smart contract wallets with authentication and recovery options
- **Multi-Chain Support**: Ability to operate across multiple blockchains
- **Batched Transactions**: Combine multiple operations into a single transaction
- **Gas Abstraction**: Abstract gas fees from users for a better UX
- **Enterprise Key Management**: Integration with cloud key management systems (AWS KMS, Google Cloud KMS)

## More Information

For more information about Sequence SDK:

- [Sequence Documentation](https://docs.sequence.xyz/)
- [Sequence Backend Integration Guide](https://docs.sequence.xyz/sdk/typescript/guides/backend/integration)
