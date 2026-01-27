# Client Methods

This document describes the methods provided by MSQPayClient.

## createPayment()

Creates a new payment.

```typescript
const payment = await client.createPayment({
  merchantId: 'merchant_demo_001',
  amount: 10.5,
  chainId: 80002,
  tokenAddress: '0x...',
  recipientAddress: '0x...'
})
```

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `merchantId` | `string` | ✓ | Merchant unique identifier (merchant_key) |
| `amount` | `number` | ✓ | Payment amount (in token units, e.g., 10.5 USDC) |
| `chainId` | `number` | ✓ | Blockchain network ID |
| `tokenAddress` | `string` | ✓ | ERC-20 token contract address |
| `recipientAddress` | `string` | ✓ | Payment recipient address |

**Return Value**

```typescript
{
  success: boolean
  paymentId: string        // bytes32 hash
  chainId: number
  tokenAddress: string
  tokenSymbol: string
  tokenDecimals: number
  gatewayAddress: string
  forwarderAddress: string
  amount: string           // in wei
  status: string
  expiresAt: string
}
```

## getPaymentStatus()

Retrieves the payment status.

```typescript
const status = await client.getPaymentStatus('0xabc123...')
```

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `paymentId` | `string` | ✓ | Payment ID (bytes32 hash) |

**Return Value**

```typescript
{
  success: true
  data: {
    paymentId: string
    status: 'CREATED' | 'PENDING' | 'CONFIRMED' | 'FAILED' | 'EXPIRED'
    amount: string
    tokenAddress: string
    tokenSymbol: string
    recipientAddress: string
    transactionHash?: string
    payment_hash: string
    network_id: number
    createdAt: string
    updatedAt: string
  }
}
```

## getPaymentHistory()

Retrieves payment history.

```typescript
const history = await client.getPaymentHistory({
  chainId: 80002,
  payer: '0x...',
  limit: 10
})
```

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `chainId` | `number` | ✓ | Blockchain network ID |
| `payer` | `string` | ✓ | Payer wallet address |
| `limit` | `number` | | Number of records to retrieve |

**Return Value**

```typescript
{
  success: true
  data: Array<{
    paymentId: string
    payer: string
    merchant: string
    token: string
    tokenSymbol: string
    decimals: number
    amount: string
    timestamp: string
    transactionHash: string
    status: string
    isGasless: boolean
    relayId?: string
  }>
}
```

## submitGasless()

Submits a gasless payment.

```typescript
const result = await client.submitGasless({
  paymentId: '0xabc123...',
  forwarderAddress: '0x...',
  forwardRequest: {
    from: '0x...',
    to: '0x...',
    value: '0',
    gas: '200000',
    nonce: '1',
    deadline: '1706281200',
    data: '0x...',
    signature: '0x...'
  }
})
```

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `paymentId` | `string` | ✓ | Payment ID (bytes32 hash) |
| `forwarderAddress` | `string` | ✓ | ERC2771 Forwarder contract address |
| `forwardRequest` | `object` | ✓ | EIP-712 signed request data |
| `forwardRequest.signature` | `string` | ✓ | EIP-712 signature |

For more details, see the [Gasless Payments](/en/gasless/) guide.

**Return Value**

```typescript
{
  success: true
  relayRequestId: string
  status: 'submitted' | 'mined' | 'failed'
  message: string
}
```

## getRelayStatus()

Retrieves the relay request status.

```typescript
const status = await client.getRelayStatus('relay_abc123')
```

**Parameters**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `relayRequestId` | `string` | ✓ | Relay request ID |

**Return Value**

```typescript
{
  success: true
  relayRequestId: string
  transactionHash?: string
  status: 'submitted' | 'pending' | 'mined' | 'confirmed' | 'failed'
}
```

## Error Handling

```typescript
import { MSQPayError } from '@globalmsq/msqpay'

try {
  const payment = await client.createPayment({ ... })
} catch (error) {
  if (error instanceof MSQPayError) {
    console.log(error.code)       // 'UNSUPPORTED_TOKEN'
    console.log(error.message)    // 'Unsupported token'
    console.log(error.statusCode) // 400
  }
}
```

## Next Steps

- [Create Payment](/en/payments/create) - Detailed payment flow
- [Error Codes](/en/api/errors) - Complete error code list
