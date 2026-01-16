[English](integrate-payment.md) | [한국어](integrate-payment.ko.md)

# Integrate Payment

A guide to integrating blockchain payments into your store using the MSQPay SDK.

## SDK Installation

```bash
pnpm add @globalmsq/msqpay
```

**Requirements**:
- Node.js >= 18.0.0
- TypeScript >= 5.0 (optional)

## SDK Initialization

```typescript
import { MSQPayClient } from '@globalmsq/msqpay';

const client = new MSQPayClient({
  environment: 'development',  // or 'staging', 'production', 'custom'
  apiKey: 'your-api-key'
});
```

### Environment Configuration

| Environment | API URL |
|-------------|---------|
| development | http://localhost:3001 |
| staging | https://pay-api.staging.msq.com |
| production | https://pay-api.msq.com |
| custom | Requires `apiUrl` parameter |

## Direct Payment Implementation

Users pay gas fees directly.

### 1. Create Payment

```typescript
const payment = await client.createPayment({
  merchantId: 'merchant_001',
  amount: 100,
  chainId: 31337,
  recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2'
});

console.log(payment.paymentId); // "0x..."
```

### 2. Frontend Payment Execution

```typescript
// Using wagmi/viem
import { useWriteContract } from 'wagmi';

const { writeContract } = useWriteContract();

await writeContract({
  address: payment.gatewayAddress,
  abi: PaymentGatewayABI,
  functionName: 'pay',
  args: [paymentId, token, amount, merchant]
});
```

### 3. Check Payment Status

```typescript
// Polling (2 second interval)
const checkStatus = async () => {
  const status = await client.getPaymentStatus(payment.paymentId);

  if (status.data.status === 'completed') {
    console.log('Payment completed!');
    return true;
  }
  return false;
};

// Check every 2 seconds
const interval = setInterval(async () => {
  const completed = await checkStatus();
  if (completed) clearInterval(interval);
}, 2000);
```

## Gasless Payment Implementation

Service subsidizes gas fees.

### 1. Create Payment

Same as Direct Payment:

```typescript
const payment = await client.createPayment({
  merchantId: 'merchant_001',
  amount: 100,
  chainId: 31337,
  recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2'
});
```

### 2. Submit Gasless Request

```typescript
const gaslessResult = await client.submitGasless({
  paymentId: payment.paymentId,
  forwarderAddress: '0x...',  // ERC2771Forwarder address
  forwardRequest: {           // ForwardRequest object
    from: userAddress,
    to: gatewayAddress,
    value: '0',
    gas: '200000',
    deadline: Math.floor(Date.now() / 1000) + 3600,
    data: '0x...',
    signature: '0x...'        // EIP-712 signature
  }
});

console.log(gaslessResult.relayRequestId); // "relay-123"
```

### 3. Generate EIP-712 Signature (Frontend)

```typescript
import { useSignTypedData } from 'wagmi';

const { signTypedData } = useSignTypedData();

// typedData received from store server
const signature = await signTypedData({
  domain: typedData.domain,
  types: typedData.types,
  primaryType: typedData.primaryType,
  message: typedData.message
});

// Send signature to store server
await fetch('/api/payments/relay', {
  method: 'POST',
  body: JSON.stringify({ paymentId, signature, forwardRequest })
});
```

### 4. Check Payment Status

Same polling as Direct Payment:

```typescript
const status = await client.getPaymentStatus(payment.paymentId);
console.log(status.data.status); // "pending" | "confirmed" | "completed"
```

## Query Payment History

```typescript
const history = await client.getPaymentHistory({
  chainId: 31337,
  payer: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  limit: 100
});

history.data.forEach(payment => {
  console.log(`${payment.paymentId}: ${payment.amount}`);
  console.log(`Gasless: ${payment.isGasless}`);
});
```

## Error Handling

### Top 10 Error Codes

| Error Code | HTTP Status | Description | Solution |
|----------|----------|------|----------|
| `VALIDATION_ERROR` | 400 | Input validation failed | Check input data |
| `INVALID_REQUEST` | 400 | Invalid request | Verify API format |
| `INVALID_SIGNATURE` | 400 | Signature verification failed | Regenerate EIP-712 signature |
| `INVALID_TRANSACTION_DATA` | 400 | Invalid TX data | Verify transaction data |
| `INVALID_GAS_ESTIMATE` | 400 | Invalid gas estimate | Recalculate gas value |
| `NOT_FOUND` | 404 | Payment not found | Check paymentId |
| `PAYMENT_ALREADY_PROCESSED` | 400 | Already processed payment | Prevent duplicate submission |
| `INSUFFICIENT_BALANCE` | 400 | Insufficient token balance | Check user balance |
| `INSUFFICIENT_ALLOWANCE` | 400 | Insufficient approval | Token approval needed |
| `INTERNAL_ERROR` | 500 | Server error | Retry or contact support |

### Error Handling Example

```typescript
import { MSQPayError } from '@globalmsq/msqpay';

try {
  await client.createPayment(params);
} catch (error) {
  if (error instanceof MSQPayError) {
    console.error(`Error [${error.code}]: ${error.message}`);
    console.error(`HTTP Status: ${error.statusCode}`);
    console.error(`Details:`, error.details);

    // Handle by error type
    if (error.code === 'VALIDATION_ERROR') {
      // Fix input data and retry
    } else if (error.code === 'NOT_FOUND') {
      // Check payment information
    } else {
      // Handle other errors
    }
  }
}
```

## Security Considerations

### Prevent Amount Manipulation (Critical)

**Absolutely Prohibited**: Receiving `amount` directly from frontend

```typescript
// ❌ Wrong approach (amount manipulation possible)
app.post('/api/checkout', async (req, res) => {
  const { amount } = req.body;  // Received from frontend → Dangerous!
  await client.createPayment({ amount });
});
```

**Correct Approach**: Server queries product price

```typescript
// ✅ Correct approach
app.post('/api/checkout', async (req, res) => {
  const { productId } = req.body;  // Only receive productId

  // Query actual price from DB
  const product = await db.products.findById(productId);
  const amount = product.price;  // Server determines price

  await client.createPayment({ amount });
});
```

### Check Token Approval

```typescript
// Query token allowance
const allowanceResponse = await fetch(
  `/tokens/${token}/allowance?chainId=${chainId}&owner=${user}&spender=${gateway}`
);

const { allowance } = await allowanceResponse.json();

if (BigInt(allowance) < BigInt(amount)) {
  // Approval needed
  console.log('Token approval required');
}
```

## Complete Example

### Store Server (Backend)

```typescript
import { MSQPayClient } from '@globalmsq/msqpay';

const client = new MSQPayClient({
  environment: 'production',
  apiKey: process.env.MSQPAY_API_KEY!
});

app.post('/api/checkout', async (req, res) => {
  try {
    // 1. Only receive productId (query amount from server)
    const { productId } = req.body;

    // 2. Query actual price from DB
    const product = await db.products.findById(productId);

    // 3. Create payment
    const payment = await client.createPayment({
      merchantId: 'merchant_001',
      amount: product.price,  // Price determined by server
      chainId: 31337,
      recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2'
    });

    // 4. Return paymentId
    res.json({ paymentId: payment.paymentId });

  } catch (error) {
    if (error instanceof MSQPayError) {
      res.status(error.statusCode).json({ error: error.message });
    }
  }
});

// Query payment status
app.get('/api/payments/:id/status', async (req, res) => {
  const status = await client.getPaymentStatus(req.params.id);
  res.json(status);
});
```

### Frontend

```typescript
// 1. Request payment (send only productId)
const response = await fetch('/api/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ productId: 'prod_001' })
});

const { paymentId } = await response.json();

// 2. Direct Payment: Send transaction via Metamask
await writeContract({
  address: gatewayAddress,
  abi: PaymentGatewayABI,
  functionName: 'pay',
  args: [paymentId, tokenAddress, amount, merchantAddress]
});

// 3. Check payment status (2 second interval)
const checkPayment = setInterval(async () => {
  const status = await fetch(`/api/payments/${paymentId}/status`);
  const { data } = await status.json();

  if (data.status === 'completed') {
    console.log('Payment completed!');
    clearInterval(checkPayment);
  }
}, 2000);
```

## Next Steps

- [API Reference](../reference/api.md) - All API endpoints in detail
- [SDK Reference](../reference/sdk.md) - Complete MSQPayClient methods
- [Error Codes](../reference/errors.md) - Full error code list
- [Deploy Server](deploy-server.md) - Payment server deployment guide
