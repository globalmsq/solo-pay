# SDK Installation

MSQPay SDK is available for JavaScript/TypeScript environments.

## Installation

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

## Requirements

- Node.js 18.0.0 or higher
- TypeScript 5.0 or higher (when using TypeScript)

## Initialization

```typescript
import { MSQPayClient } from '@globalmsq/msqpay';

const client = new MSQPayClient({
  apiKey: process.env.MSQPAY_API_KEY!,
  environment: 'staging',
});
```

## Configuration Options

| Option        | Type     | Required | Description                                            |
| ------------- | -------- | -------- | ------------------------------------------------------ |
| `apiKey`      | `string` | ✓        | API Key                                                |
| `environment` | `string` | ✓        | `development` \| `staging` \| `production` \| `custom` |
| `apiUrl`      | `string` |          | Custom API URL (required for `custom` environment)     |

## Environment Configuration

### Development

```typescript
const client = new MSQPayClient({
  apiKey: 'sk_test_...',
  environment: 'development',
});
// Endpoint: http://localhost:3001
```

### Staging (Testnet)

```typescript
const client = new MSQPayClient({
  apiKey: 'sk_test_...',
  environment: 'staging',
});
// Endpoint: https://staging-api.msqpay.com
```

### Production (Mainnet)

```typescript
const client = new MSQPayClient({
  apiKey: 'sk_live_...',
  environment: 'production',
});
// Endpoint: https://api.msqpay.com
```

### Custom Environment

```typescript
const client = new MSQPayClient({
  apiKey: 'sk_test_...',
  environment: 'custom',
  apiUrl: 'https://my-custom-server.com',
});
```

## Basic Usage

```typescript
import { MSQPayClient, MSQPayError } from '@globalmsq/msqpay';

const client = new MSQPayClient({
  apiKey: process.env.MSQPAY_API_KEY!,
  environment: 'staging',
});

// Create payment
const payment = await client.createPayment({
  merchantId: 'merchant_demo_001',
  amount: 10.5,
  chainId: 80002,
  tokenAddress: '0x...',
  recipientAddress: '0x...',
});

// Check payment status
const status = await client.getPaymentStatus(payment.paymentId);

// Submit gasless payment
const result = await client.submitGasless({
  paymentId: payment.paymentId,
  forwarderAddress: payment.forwarderAddress,
  forwardRequest: {
    /* signature data */
  },
});
```

## TypeScript Support

The SDK provides complete TypeScript types.

```typescript
import type {
  MSQPayConfig,
  CreatePaymentParams,
  CreatePaymentResponse,
  GaslessParams,
  GaslessResponse,
} from '@globalmsq/msqpay';

const config: MSQPayConfig = {
  apiKey: 'sk_test_...',
  environment: 'staging',
};

const params: CreatePaymentParams = {
  merchantId: 'merchant_demo_001',
  amount: 10.5,
  chainId: 80002,
  tokenAddress: '0x...',
  recipientAddress: '0x...',
};
```

## Next Steps

- [Client Methods](/en/sdk/client) - Detailed API usage
- [Create Payment](/en/payments/create) - Payment integration guide
