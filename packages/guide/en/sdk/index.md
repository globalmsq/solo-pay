# SDK Installation

SoloPay SDK is available for JavaScript/TypeScript environments.

## Installation

::: code-group

```bash [npm]
npm install @globalmsq/solopay
```

```bash [pnpm]
pnpm add @globalmsq/solopay
```

```bash [yarn]
yarn add @globalmsq/solopay
```

:::

## Requirements

- Node.js 18.0.0 or higher
- TypeScript 5.0 or higher (when using TypeScript)

## Initialization

```typescript
import { SoloPayClient } from '@globalmsq/solopay';

const client = new SoloPayClient({
  apiKey: process.env.SOLO_PAY_API_KEY!,
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
const client = new SoloPayClient({
  apiKey: 'sk_test_...',
  environment: 'development',
});
// Endpoint: http://localhost:3001
```

### Staging (Testnet)

```typescript
const client = new SoloPayClient({
  apiKey: 'sk_test_...',
  environment: 'staging',
});
// Endpoint: https://staging-api.solopay.com
```

### Production (Mainnet)

```typescript
const client = new SoloPayClient({
  apiKey: 'sk_live_...',
  environment: 'production',
});
// Endpoint: https://api.solopay.com
```

### Custom Environment

```typescript
const client = new SoloPayClient({
  apiKey: 'sk_test_...',
  environment: 'custom',
  apiUrl: 'https://my-custom-server.com',
});
```

## Basic Usage

```typescript
import { SoloPayClient, SoloPayError } from '@globalmsq/solopay';

const client = new SoloPayClient({
  apiKey: process.env.SOLO_PAY_API_KEY!,
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
  SoloPayConfig,
  CreatePaymentParams,
  CreatePaymentResponse,
  GaslessParams,
  GaslessResponse,
} from '@globalmsq/solopay';

const config: SoloPayConfig = {
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
