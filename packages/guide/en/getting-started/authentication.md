# Authentication

MSQPay API uses API Keys for authentication.

## Getting an API Key

1. Log in to MSQPay Dashboard
2. Navigate to Settings > API Keys
3. Click "Create API Key"
4. Store the issued key securely

::: warning Security Notice
API Key is only displayed once. If lost, you'll need to issue a new one.
:::

## API Key Types

| Type | Prefix | Purpose |
|------|--------|---------|
| Test Key | `sk_test_` | Testnet environment |
| Live Key | `sk_live_` | Mainnet environment |

## Usage

### With SDK

```typescript
import { MSQPayClient } from '@globalmsq/msqpay'

// Default configuration (staging environment)
const client = new MSQPayClient({
  apiKey: process.env.MSQPAY_API_KEY,
  environment: 'staging'  // 'production' | 'staging' | 'custom'
})

// With custom URL
const customClient = new MSQPayClient({
  apiKey: process.env.MSQPAY_API_KEY,
  environment: 'custom',
  baseUrl: 'https://your-custom-api.com'
})
```

### Direct REST API Calls

```bash
# Create payment example
curl -X POST http://localhost:3001/payments/create \
  -H "x-api-key: sk_test_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "merchant_demo_001",
    "amount": 10.5,
    "chainId": 80002,
    "tokenAddress": "0x...",
    "recipientAddress": "0x..."
  }'
```

## Environment Variables

::: code-group

```bash [.env]
MSQPAY_API_KEY=sk_test_xxxxx
```

```typescript [Usage]
const client = new MSQPayClient({
  apiKey: process.env.MSQPAY_API_KEY!,
  environment: 'staging'
})
```

:::

## Security Best Practices

### Do

- Manage API Keys as environment variables
- Use API Keys only on server-side
- Rotate keys regularly

### Don't

- Expose API Keys in client code
- Commit keys to version control
- Print API Keys in logs

::: danger Prohibited
Never include API Keys in frontend code. If a key is exposed, revoke it immediately and issue a new one.
:::

## Revoking API Keys

1. Select the key in the dashboard
2. Click "Revoke"
3. Issue a new key and update your application

## Next Steps

- [SDK Installation](/en/sdk/) - Detailed SDK usage
- [Create Payment](/en/payments/create) - Create your first payment
