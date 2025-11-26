# MSQ Pay Onchain

Multi-Service Blockchain Payment Gateway - ERC-20 토큰 결제 게이트웨이

## Overview

여러 서비스가 직접 통합할 수 있는 블록체인 결제 시스템입니다.

### Features

- **Direct Payment**: 사용자가 가스비를 직접 지불
- **Gasless Payment**: Meta-transaction을 통한 가스비 대납
- **TypeScript SDK**: 쉬운 통합을 위한 SDK 제공
- **Subgraph**: 결제 이벤트 인덱싱 및 조회
- **Demo App**: 테스트용 웹앱

## Project Structure

```
msq-pay-onchain/
├── contracts/          # Smart Contracts (Hardhat)
├── packages/
│   └── sdk/           # TypeScript SDK
├── subgraph/          # The Graph Subgraph
├── apps/
│   └── demo/          # Demo Web App (Next.js)
└── docs/              # Documentation
```

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 8

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### Development

```bash
# Contracts
cd contracts
pnpm compile
pnpm test

# Demo app
cd apps/demo
pnpm dev
```

## Configuration

### Network

- **Chain**: Polygon Amoy Testnet (Chain ID: 80002)
- **RPC**: https://rpc-amoy.polygon.technology

### Token

- **SUT Token**: `0xE4C687167705Abf55d709395f92e254bdF5825a2`

### Contracts (TBD after deployment)

```
PaymentGateway: 0x...
ERC2771Forwarder: 0x...
```

## SDK Usage

### Direct Payment

```typescript
import { MSQPayClient } from '@msq/pay-sdk';

const client = new MSQPayClient({
  chainId: 80002,
  rpcUrl: 'https://rpc-amoy.polygon.technology',
  gatewayAddress: '0x...',
  forwarderAddress: '0x...',
});

// Get transaction data
const txData = client.getPaymentTxData({
  paymentId: 'ORDER_123',
  token: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
  amount: parseUnits('100', 18),
  merchant: '0x...',
});

// Send via wallet
await signer.sendTransaction(txData);
```

### Meta-Transaction (Gasless)

```typescript
// Get signature request
const signRequest = await client.getMetaTxSignRequest(params, userAddress);

// User signs
const signature = await signer.signTypedData(
  signRequest.domain,
  signRequest.types,
  signRequest.message
);

// Submit to relay
const txHash = await client.submitMetaTx({ request: signRequest.message, signature });
```

## Deployment

### Contracts

```bash
cd contracts

# Deploy to Polygon Amoy
pnpm deploy:amoy

# Verify on Polygonscan
pnpm verify --network polygonAmoy <CONTRACT_ADDRESS>
```

### Subgraph

```bash
cd subgraph

# Generate types
pnpm codegen

# Build
pnpm build

# Deploy to Subgraph Studio
pnpm deploy
```

### Demo App

```bash
cd apps/demo
pnpm build

# Deploy to Vercel or any static hosting
```

## Documentation

- [PRD (요구사항)](./docs/prd.md)
- [Technical Specification](./docs/technical-spec.md)

## Tech Stack

| Component | Technology |
|-----------|------------|
| Smart Contract | Solidity 0.8.24, OpenZeppelin 5.x |
| Contract Framework | Hardhat |
| SDK | TypeScript, viem |
| Subgraph | The Graph |
| Demo App | Next.js 14, wagmi, RainbowKit |
| Package Manager | pnpm |

## License

MIT
