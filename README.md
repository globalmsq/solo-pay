# MSQPay Monorepo

[English](README.md) | [한국어](README.ko.md)

Multi-Service Blockchain Payment Gateway - ERC-20 Token Payment Gateway

## Overview

A blockchain payment system that multiple services can integrate with.

### Core Principles

| Principle | Description |
|-----------|-------------|
| **Contract = Source of Truth** | Payment completion is determined solely by smart contracts |
| **Integrated DB Architecture** | MySQL + Redis caching integration, maintaining Contract = Source of Truth |
| **Consistent API Interface** | Same API interface for both MVP and Production |
| **Server-Issued paymentId** | Payment server is the sole creator of paymentId |
| **Merchant Server ↔ Blockchain Separation** | Merchant servers only call payment server API, no direct blockchain access |

### Features

- **Direct Payment**: Users pay gas fees directly
- **Gasless Payment**: Gas fee delegation via Meta-transaction (Relayer Service)
- **TypeScript SDK**: API client for merchant servers (`@globalmsq/msqpay`)
- **Payment Server**: paymentId issuance, contract state queries, gasless relay
- **Demo App**: Test web application

## System Architecture

```
Frontend → Merchant Server → Payment Server → Contract
              (SDK)              (API)        (Source of Truth)
```

## Project Structure

```
msqpay-monorepo/
├── contracts/             # Smart Contracts (Hardhat)
├── packages/
│   ├── sdk/              # TypeScript SDK (@globalmsq/msqpay)
│   ├── pay-server/       # Payment Server (Fastify)
│   └── simple-relayer/   # Local Development Relayer Service
├── apps/
│   └── demo/             # Demo Web App (Next.js)
├── subgraph/             # The Graph Subgraph (Event Indexing)
└── docs/                 # Documentation
```

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- Docker & Docker Compose (recommended)

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

## Docker Development (Recommended)

One-click development environment with Docker Compose:

### Quick Start

```bash
# Start full stack
cd docker && docker-compose up -d

# View logs
docker-compose logs -f server

# Access
# Demo: http://localhost:3000
# API:  http://localhost:3001/health
# Hardhat: http://localhost:8545
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| mysql | 3306 | Payment data (root/pass) |
| redis | 6379 | Caching |
| hardhat | 8545 | Local blockchain |
| server | 3001 | Payment API |
| demo | 3000 | Frontend |

### Commands

```bash
# Restart service
docker-compose restart server

# Rebuild
docker-compose up -d --build server

# MySQL access
docker-compose exec mysql mysql -u root -ppass msqpay

# Full reset
docker-compose down -v
```

## Manual Development

For manual development without Docker:

```bash
# Terminal 1: Start Hardhat node
cd contracts
npx hardhat node

# Terminal 2: Deploy contracts
cd contracts
pnpm deploy:local

# Terminal 3: Start Payment Server
cd packages/pay-server
pnpm dev

# Terminal 4: Start Demo App
cd apps/demo
pnpm dev
```

## Configuration

### Network

- **Chain**: Polygon Amoy Testnet (Chain ID: 80002)
- **RPC**: https://rpc-amoy.polygon.technology

### Token

- **SUT Token**: `0xE4C687167705Abf55d709395f92e254bdF5825a2`

### Contracts (Polygon Amoy Testnet)

| Contract | Address |
|----------|---------|
| PaymentGateway (Proxy) | `0x2256bedB57869AF4fadF16e1ebD534A7d47513d7` |
| PaymentGatewayV1 (Impl) | `0xDc40C3735163fEd63c198c3920B65B66DB54b1Bf` |
| ERC2771Forwarder | `0x0d9A0fAf9a8101368aa01B88442B38f82180520E` |

Block Explorer: [amoy.polygonscan.com](https://amoy.polygonscan.com/address/0x2256bedB57869AF4fadF16e1ebD534A7d47513d7)

## SDK Usage (@globalmsq/msqpay)

```typescript
import { MSQPayClient } from '@globalmsq/msqpay';

// Initialize
const client = new MSQPayClient({
  environment: 'development', // or 'custom' + apiUrl
  apiKey: 'sk_test_abc123'
});

// Create payment (called from merchant server)
const payment = await client.createPayment({
  merchantId: 'merchant_001',
  orderId: 'ORD-12345',
  amount: 100,
  currency: 'TEST',
  chainId: 31337,
  recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2'
});

// Check status (chainId not required - auto-determined by server)
const status = await client.getPaymentStatus(payment.paymentId);
console.log(status.data.status); // "pending" | "completed"

// Submit gasless transaction (EIP-712 signature required)
const gaslessResult = await client.submitGasless({
  paymentId: payment.paymentId,
  forwardRequest: { from, to, value, gas, nonce, deadline, data },
  signature: '0x...'
});

// Execute relay transaction
const relayResult = await client.executeRelay({
  paymentId: payment.paymentId,
  forwardRequest: { from, to, value, gas, nonce, deadline, data },
  signature: '0x...'
});
```

**Detailed documentation**: [SDK README](./packages/sdk/README.md)

## Payment Server API

### Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/payments/create` | POST | Create payment, issue paymentId |
| `/api/checkout` | POST | Product-based payment (Demo App API Route) |
| `/payments/:id/status` | GET | Check payment status (chainId auto-determined) |
| `/payments/:id/gasless` | POST | Submit gasless transaction |
| `/payments/:id/relay` | POST | Execute relay transaction |
| `/payments/history` | GET | Query payment history (payer-based) |
| `/tokens/balance` | GET | Query token balance |
| `/tokens/allowance` | GET | Query token approval amount |
| `/transactions/:id/status` | GET | Query transaction status |

### Recently Added Features

#### Payment History API
Query user payment history from blockchain events and DB:
- **Endpoint**: `GET /payments/history?chainId={}&payer={}&limit={}`
- **Function**: Query history based on payer address
- **Response**: Payment list (includes gasless status, relay ID, token decimals/symbol)

#### Token Balance/Allowance API
Query ERC-20 token wallet status:
- **Endpoint**: `GET /tokens/balance?tokenAddress={addr}&address={wallet}`
- **Function**: Query user wallet token balance
- **Endpoint**: `GET /tokens/allowance?tokenAddress={addr}&owner={addr}&spender={addr}`
- **Function**: Query token approval amount

#### Transaction Status API
Query transaction status and confirmation info:
- **Endpoint**: `GET /transactions/:id/status`
- **Function**: Query status, block number, confirmation count by transaction hash
- **Status values**: `pending` (waiting), `confirmed` (confirmed), `failed` (failed)

### Environment Variables

Key environment variables for the payment server:

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | MySQL connection string | `mysql://user:pass@localhost:3306/msqpay` |
| `REDIS_URL` | Redis connection string (optional) | `redis://localhost:6379` |
| `RELAYER_API_URL` | Relayer service endpoint | `http://simple-relayer:3001` |
| `RELAYER_API_KEY` | Relayer API key (production only) | `sk_...` |
| `RELAYER_API_SECRET` | Relayer API secret (production only) | `secret_...` |
| `RELAYER_ADDRESS` | Relayer wallet address | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` |

> **Note**: Chain configuration (RPC URLs, contract addresses) is managed in the database `chains` table, not environment variables. See [Pay Server README](./packages/pay-server/README.md#multi-chain-configuration) for details.

### Detailed Documentation

- **[Getting Started](./docs/getting-started.md)** - Quick start with Docker, 5-minute setup
- **[API Reference](./docs/reference/api.md)** - All API endpoints, request/response formats
- **[SDK Reference](./docs/reference/sdk.md)** - MSQPayClient methods, full TypeScript types
- **[Architecture Guide](./docs/reference/architecture.md)** - System design, security, payment flows
- **[Integration Guide](./docs/guides/integrate-payment.md)** - SDK usage, Direct/Gasless payments
- **[Deployment Guide](./docs/guides/deploy-server.md)** - Production deployment, environment setup
- **[Error Codes](./docs/reference/errors.md)** - All error codes and solutions

## Documentation

- [Getting Started](./docs/getting-started.md) - Quick setup guide
- [Integration Guide](./docs/guides/integrate-payment.md) - Integrate payments into your store
- [Deployment Guide](./docs/guides/deploy-server.md) - Deploy payment server
- [Contributing Guide](./docs/guides/contribute.md) - Contribute to the project
- [API Reference](./docs/reference/api.md) - Complete API documentation
- [SDK Reference](./docs/reference/sdk.md) - SDK usage and types
- [Error Codes](./docs/reference/errors.md) - All error codes and solutions
- [Architecture](./docs/reference/architecture.md) - System architecture

## Tech Stack

| Component | Technology |
|-----------|------------|
| Smart Contract | Solidity 0.8.24, OpenZeppelin 5.x |
| Contract Framework | Hardhat |
| Payment Server | Node.js, Fastify v5, viem v2.21 |
| Payment Server Tests | Vitest, Pino structured logging |
| SDK | TypeScript, Node 18+ native fetch (no dependencies) |
| SDK Tests | Vitest, 100% coverage |
| Relay | Relayer Service (dev: Simple Relayer / prod: OpenZeppelin Defender) |
| Demo App | Next.js 14, wagmi, RainbowKit |
| Package Manager | pnpm |

## License

MIT
