# Quick Start

Learn how to integrate MSQPay in 5 minutes.

## Prerequisites

- API Key (get test key from dashboard)
- Node.js 18 or higher

## Step 1: Install SDK

::: code-group

```bash [npm]
npm install @globalmsq/msqpay
```

```bash [pnpm]
pnpm add @globalmsq/msqpay
```

```bash [yarn]
yarn add @globalmsq/msqpay
```

:::

## Step 2: Initialize Client

```typescript
import { MSQPayClient } from '@globalmsq/msqpay'

const client = new MSQPayClient({
  apiKey: 'sk_test_...',
  environment: 'development'  // 'development' | 'staging' | 'production'
})
```

::: tip Environment Configuration
- `development`: Local development (`http://localhost:3001`)
- `staging`: Testnet (Polygon Amoy, etc.)
- `production`: Mainnet
:::

## Step 3: Create Your First Payment

```typescript
const payment = await client.createPayment({
  merchantId: 'merchant_demo_001',      // Merchant ID
  amount: 10.5,                         // 10.5 USDC
  chainId: 80002,                       // Polygon Amoy
  tokenAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
})

console.log(payment.paymentId)    // 0xabc123... (bytes32 hash)
console.log(payment.status)       // created
console.log(payment.amount)       // 10500000 (in wei)
console.log(payment.expiresAt)    // 2024-01-26T13:00:00.000Z
```

## Step 4: Check Payment Status

```typescript
const status = await client.getPaymentStatus(payment.paymentId)

console.log(status.data.status)  // CREATED | PENDING | CONFIRMED | FAILED | EXPIRED
```

## Payment Status Flow

```
CREATED ──────▶ PENDING ──────▶ CONFIRMED
    │              │
    │              ▼
    │           FAILED
    ▼
 EXPIRED
```

| Status | Description |
|--------|-------------|
| `CREATED` | Payment created, waiting for user action |
| `PENDING` | Transaction sent, waiting for block confirmation |
| `CONFIRMED` | Payment completed |
| `FAILED` | Transaction failed |
| `EXPIRED` | Expired after 30 minutes |

## Full Example

```typescript
import { MSQPayClient, MSQPayError } from '@globalmsq/msqpay'

const client = new MSQPayClient({
  apiKey: process.env.MSQPAY_API_KEY!,
  environment: 'staging'
})

async function createPayment() {
  try {
    // 1. Create payment
    const payment = await client.createPayment({
      merchantId: 'merchant_demo_001',
      amount: 10.5,
      chainId: 80002,
      tokenAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
    })

    console.log('Payment created:', payment.paymentId)

    // 2. Pass payment info to frontend
    // - paymentId: Payment identifier
    // - gatewayAddress: PaymentGateway contract
    // - forwarderAddress: Forwarder contract for Gasless
    // - amount: Amount in wei

    return payment

  } catch (error) {
    if (error instanceof MSQPayError) {
      console.error('Payment creation failed:', error.code, error.message)
    }
    throw error
  }
}
```

## Next Steps

- [Authentication](/en/getting-started/authentication) - Detailed API Key usage
- [Create Payment](/en/payments/create) - Payment API detailed guide
- [Gasless Payments](/en/gasless/) - Pay without gas fees
- [Webhook Setup](/en/webhook/) - Receive payment completion notifications
