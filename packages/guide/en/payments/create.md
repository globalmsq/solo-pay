# Create Payment

Create a payment and receive a unique ID.

## Overview

Payment creation is the first step in SoloPay integration. Created payments **automatically expire after 30 minutes**.

## Payment Flow

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  Merchant   │         │  SoloPay API │         │  Blockchain │
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

Authentication uses **public key + Origin** (set in client config). Chain and recipient come from merchant config; you must pass `tokenAddress` (whitelisted and enabled for the merchant).

```typescript
const payment = await client.createPayment({
  orderId: 'order-001',
  amount: 10.5, // token units (e.g. 10.5 USDC)
  tokenAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', // must be whitelisted and enabled for merchant
  successUrl: 'https://example.com/success',
  failUrl: 'https://example.com/fail',
});
```

## REST API Usage

Auth: `x-public-key` header (pk_live_xxx or pk_test_xxx) and `Origin` header (must match one of merchant `allowed_domains`).

```bash
curl -X POST http://localhost:3001/payments/create \
  -H "x-public-key: pk_test_demo" \
  -H "Origin: http://localhost:3000" \
  -H "Content-Type: application/json" \
  -d '{
    "orderId": "order-001",
    "amount": 10.5,
    "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "successUrl": "https://example.com/success",
    "failUrl": "https://example.com/fail"
  }'
```

## Request Parameters

| Field          | Type      | Required | Description                                                                  |
| -------------- | --------- | -------- | ---------------------------------------------------------------------------- |
| `orderId`      | `string`  | ✓        | Merchant order identifier                                                    |
| `amount`       | `number`  | ✓        | Payment amount in token units (e.g. 10.5 USDC)                               |
| `tokenAddress` | `address` | ✓        | ERC-20 token contract address (must be whitelisted and enabled for merchant) |
| `successUrl`   | `string`  | ✓        | Redirect URL on success                                                      |
| `failUrl`      | `string`  | ✓        | Redirect URL on failure                                                      |
| `webhookUrl`   | `string`  |          | Optional per-payment webhook URL                                             |

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
  "code": "TOKEN_NOT_ENABLED",
  "message": "Token is not enabled for this merchant. Add and enable it in payment methods first."
}
```

Other possible codes: `TOKEN_NOT_FOUND` (not whitelisted), `VALIDATION_ERROR`, `UNSUPPORTED_TOKEN`.

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
