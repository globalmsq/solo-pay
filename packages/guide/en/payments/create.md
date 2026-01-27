# Create Payment

Create a payment and receive a unique ID.

## Overview

Payment creation is the first step in MSQPay integration. Created payments **automatically expire after 30 minutes**.

## Payment Flow

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Merchant   │         │  MSQPay API │         │  Blockchain │
│  Server     │         │             │         │             │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │  POST /payments/create│                       │
       │──────────────────────▶│                       │
       │                       │                       │
       │  { paymentId }        │                       │
       │◀──────────────────────│                       │
       │                       │                       │
       │         (User pays from wallet)               │
       │                       │                       │
       │                       │    TX Submit          │
       │                       │──────────────────────▶│
       │                       │                       │
       │  Webhook: confirmed   │                       │
       │◀──────────────────────│                       │
       │                       │                       │
```

## SDK Usage

```typescript
const payment = await client.createPayment({
  merchantId: 'merchant_demo_001',
  amount: 10.5, // 10.5 USDC (token units)
  chainId: 80002, // Polygon Amoy
  tokenAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
});
```

## REST API Usage

```bash
curl -X POST http://localhost:3001/payments/create \
  -H "x-api-key: sk_test_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "merchant_demo_001",
    "amount": 10.5,
    "chainId": 80002,
    "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "recipientAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  }'
```

## Request Parameters

| Field              | Type      | Required | Description                                   |
| ------------------ | --------- | -------- | --------------------------------------------- |
| `merchantId`       | `string`  | ✓        | Merchant unique identifier (merchant_key)     |
| `amount`           | `number`  | ✓        | Payment amount (token units, e.g., 10.5 USDC) |
| `chainId`          | `number`  | ✓        | Blockchain network ID                         |
| `tokenAddress`     | `address` | ✓        | ERC-20 token contract address                 |
| `recipientAddress` | `address` | ✓        | Payment recipient address                     |

::: tip Amount Input
Enter amounts in token units. The server automatically converts to wei.
Example: 10.5 USDC → 10500000 (6 decimals)
:::

## Response

### Success (201 Created)

```json
{
  "success": true,
  "paymentId": "0xabc123def456...",
  "chainId": 80002,
  "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "tokenSymbol": "USDC",
  "tokenDecimals": 6,
  "gatewayAddress": "0x...",
  "forwarderAddress": "0x...",
  "amount": "10500000",
  "status": "created",
  "expiresAt": "2024-01-26T13:00:00.000Z"
}
```

### Error (400 Bad Request)

```json
{
  "code": "UNSUPPORTED_TOKEN",
  "message": "Unsupported token"
}
```

## Response Field Description

| Field              | Type       | Description                                     |
| ------------------ | ---------- | ----------------------------------------------- |
| `paymentId`        | `string`   | Payment unique identifier (bytes32 hash)        |
| `amount`           | `string`   | Amount converted to wei                         |
| `gatewayAddress`   | `address`  | PaymentGateway contract address                 |
| `forwarderAddress` | `address`  | ERC2771 Forwarder address (for Gasless)         |
| `expiresAt`        | `datetime` | Payment expiration time (30 min after creation) |

## After Payment Creation

Once a payment is created, pass the `paymentId` and contract addresses to the frontend.

The frontend can proceed with payment in two ways:

### 1. Direct Payment

User sends the transaction directly.

```typescript
// Frontend (wagmi example)
await writeContract({
  address: gatewayAddress,
  abi: PaymentGatewayABI,
  functionName: 'pay',
  args: [paymentId, tokenAddress, amount],
});
```

### 2. Gasless Payment

User only signs, and the Relayer submits on their behalf.

See the [Gasless Payment Guide](/en/gasless/)

## Next Steps

- [Payment Status](/en/payments/status) - Check payment progress
- [Webhook Setup](/en/webhook/) - Receive payment completion notifications
