# MSQ Pay Subgraph

[English](README.md) | [한국어](README.ko.md)

MSQ Pay Subgraph indexes PaymentGateway smart contract events using The Graph protocol and provides a queryable GraphQL API.

## Overview

The Subgraph indexes blockchain events in real-time to provide:

- Individual payment records
- Merchant statistics
- Daily transaction volume
- Token statistics
- Global system statistics

## Key Features

- ✅ **Real-time Indexing**: Automatic collection of PaymentCompleted events
- ✅ **Statistics Aggregation**: Automatic calculation of merchant, token, and daily statistics
- ✅ **GraphQL API**: Powerful querying and filtering capabilities
- ✅ **Gas Mode Distinction**: Track Direct vs Gasless payments
- ✅ **Multi-chain Support**: Polygon Amoy, Polygon Mainnet

## Data Schema

### Payment

Individual payment records:

```graphql
type Payment @entity(immutable: true) {
  id: ID! # paymentId (hex string)
  payer: Bytes! # Payer address
  merchant: Bytes! # Merchant address
  token: Bytes! # Token address
  amount: BigInt! # Payment amount
  timestamp: BigInt! # Block timestamp
  transactionHash: Bytes! # Transaction hash
  blockNumber: BigInt! # Block number
  gasMode: GasMode! # Direct | MetaTx
}
```

### MerchantStats

Merchant statistics:

```graphql
type MerchantStats @entity {
  id: ID! # Merchant address (lowercase)
  totalReceived: BigInt! # Total received amount
  paymentCount: Int! # Number of payments
  lastPaymentAt: BigInt # Last payment time
}
```

### DailyVolume

Daily transaction volume:

```graphql
type DailyVolume @entity {
  id: ID! # Date (YYYY-MM-DD)
  date: BigInt! # Unix timestamp
  volume: BigInt! # Total volume
  count: Int! # Transaction count
}
```

### TokenStats

Token statistics:

```graphql
type TokenStats @entity {
  id: ID! # Token address (lowercase)
  symbol: String # Token symbol
  totalVolume: BigInt! # Total volume
  transactionCount: Int! # Transaction count
}
```

### GlobalStats

Global system statistics:

```graphql
type GlobalStats @entity {
  id: ID! # "global"
  totalPayments: Int! # Total payment count
  totalVolume: BigInt! # Total volume
  uniqueMerchants: Int! # Unique merchant count
  uniquePayers: Int! # Unique payer count
}
```

## Getting Started

### Requirements

- Node.js >= 18.0.0
- The Graph CLI
- IPFS (for local deployment)

### Installation

```bash
cd subgraph
pnpm install
```

### Code Generation

Generate TypeScript code from schema and ABI:

```bash
pnpm codegen
```

### Build

```bash
pnpm build
```

## Deployment

### The Graph Studio Deployment (Recommended)

1. Create account at [The Graph Studio](https://thegraph.com/studio/)
2. Create new Subgraph
3. Copy Deploy Key
4. Update network and address in `subgraph.yaml`:

```yaml
dataSources:
  - kind: ethereum
    name: PaymentGateway
    network: polygon-amoy # or polygon
    source:
      address: '0xF3a0661743cD5cF970144a4Ed022E27c05b33BB5'
      abi: PaymentGateway
      startBlock: 12345678 # Deployment block number
```

5. Deploy:

```bash
# Deploy to Studio
pnpm deploy

# Or direct command
graph auth --studio <DEPLOY_KEY>
graph deploy --studio msq-pay-polygon-amoy
```

### Local Graph Node Deployment

Run local Graph Node for development:

```bash
# Start Graph Node (separate terminal)
docker-compose -f docker-compose-graph.yml up

# Create Subgraph
pnpm create:local

# Deploy Subgraph
pnpm deploy:local

# Remove Subgraph
pnpm remove:local
```

## GraphQL Query Examples

### Recent Payments

```graphql
{
  payments(first: 10, orderBy: timestamp, orderDirection: desc) {
    id
    payer
    merchant
    token
    amount
    timestamp
    gasMode
    transactionHash
  }
}
```

### Merchant Statistics

```graphql
{
  merchantStats(id: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8") {
    totalReceived
    paymentCount
    lastPaymentAt
  }
}
```

### Daily Volume

```graphql
{
  dailyVolumes(first: 30, orderBy: date, orderDirection: desc) {
    id
    date
    volume
    count
  }
}
```

### Token Statistics

```graphql
{
  tokenStats {
    id
    symbol
    totalVolume
    transactionCount
  }
}
```

### Global Statistics

```graphql
{
  globalStats(id: "global") {
    totalPayments
    totalVolume
    uniqueMerchants
    uniquePayers
  }
}
```

### Filtering and Pagination

```graphql
{
  payments(
    first: 10
    skip: 0
    where: {
      merchant: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"
      gasMode: MetaTx
      timestamp_gte: 1704067200 # 2024-01-01 00:00:00 UTC
    }
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    payer
    amount
    timestamp
  }
}
```

## Project Structure

```
subgraph/
├── schema.graphql              # GraphQL schema definition
├── subgraph.yaml               # Subgraph configuration
├── src/
│   └── payment-gateway.ts      # Event handlers
├── abis/
│   └── PaymentGateway.json     # Contract ABI
├── generated/                  # Generated code (codegen)
├── build/                      # Build output
├── tests/                      # Tests (matchstick)
└── package.json
```

## Event Handlers

`src/payment-gateway.ts` handles PaymentCompleted events:

```typescript
export function handlePaymentCompleted(event: PaymentCompletedEvent): void {
  // 1. Create Payment entity
  let payment = new Payment(event.params.paymentId.toHexString());
  payment.payer = event.params.payer;
  payment.merchant = event.params.merchant;
  payment.token = event.params.token;
  payment.amount = event.params.amount;
  payment.timestamp = event.params.timestamp;

  // 2. Determine gas mode (Direct vs MetaTx)
  if (event.transaction.from.equals(event.params.payer)) {
    payment.gasMode = 'Direct';
  } else {
    payment.gasMode = 'MetaTx';
  }

  payment.save();

  // 3. Update statistics
  updateMerchantStats(event);
  updateDailyVolume(event);
  updateTokenStats(event);
  updateGlobalStats(event);
}
```

## Supported Networks

| Network         | Chain ID | Status      | Subgraph URL     |
| --------------- | -------- | ----------- | ---------------- |
| Polygon Amoy    | 80002    | Testnet     | TBD              |
| Polygon Mainnet | 137      | Production  | TBD              |
| Hardhat Local   | 31337    | Development | Local Graph Node |

## Deployment Checklist

### Before Testnet Deployment

- [ ] PaymentGateway contract deployed
- [ ] Update contract address in `subgraph.yaml`
- [ ] Update startBlock in `subgraph.yaml`
- [ ] Create Subgraph in The Graph Studio
- [ ] Obtain Deploy Key
- [ ] Update ABI file (`abis/PaymentGateway.json`)

### Before Production Deployment

- [ ] Sufficient testing on Testnet Subgraph
- [ ] Update to production contract address
- [ ] Change to production network (`polygon`)
- [ ] Create production Subgraph in The Graph Studio

## Monitoring

Monitor via The Graph Studio dashboard after deployment:

- Indexing status
- Sync progress
- Query performance
- Error logs

## Use Cases

### Demo App Integration

```typescript
// apps/demo/src/lib/subgraph.ts
import { SUBGRAPH_URLS } from './wagmi';

async function getPaymentHistory(chainId: number, payer: string) {
  const url = SUBGRAPH_URLS[chainId];
  if (!url) throw new Error('Subgraph not available');

  const query = `
    query GetPayments($payer: Bytes!) {
      payments(
        where: { payer: $payer }
        orderBy: timestamp
        orderDirection: desc
      ) {
        id
        amount
        merchant
        timestamp
        gasMode
      }
    }
  `;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { payer } }),
  });

  return response.json();
}
```

### Dashboard Usage

- Real-time transaction volume charts
- Merchant revenue rankings
- Token usage statistics
- Direct vs Gasless ratio

## Current Status

⚠️ **Awaiting Deployment**: Subgraph is implemented but not yet deployed.

**Next Steps**:

1. Deploy to The Graph Studio
2. Configure Subgraph URL in Demo App
3. Integrate payment history query functionality

## Documentation

- [The Graph Documentation](https://thegraph.com/docs/)
- [AssemblyScript API](https://thegraph.com/docs/en/developing/assemblyscript-api/)
- [Architecture Documentation](../docs/reference/architecture.md)

## License

MIT License
