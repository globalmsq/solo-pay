[English](api.md) | [한국어](api.ko.md)

# API Reference

Complete reference for all MSQPay REST API endpoints.

## Overview

| Item | Value |
|------|-----|
| Base URL | `http://localhost:3001` (dev), `https://pay-api.msq.com` (prod) |
| Protocol | REST API (HTTP/HTTPS) |
| Content-Type | `application/json` |
| Authentication | X-API-Key (payment API only) |

## Endpoint List

### Payment API

| Endpoint | Method | Description |
|-----------|--------|------|
| `/payments/create` | POST | Create payment, issue paymentId |
| `/api/checkout` | POST | Product-based payment (Demo App) |
| `/payments/:id/status` | GET | Query payment status |
| `/payments/:id/gasless` | POST | Submit gasless transaction |
| `/payments/:id/relay` | POST | Execute relay transaction |
| `/payments/history` | GET | Query payment history |

### Token API

| Endpoint | Method | Description |
|-----------|--------|------|
| `/tokens/:tokenAddress/balance` | GET | Query token balance |
| `/tokens/:tokenAddress/allowance` | GET | Query token approval |

### Transaction API

| Endpoint | Method | Description |
|-----------|--------|------|
| `/transactions/:id/status` | GET | Query transaction status |

---

## Payment API

### POST /payments/create

Create a new payment.

**Important**: This API is for Store Server → Payment Server calls only. Do not call directly from frontend!

#### Request

```http
POST /payments/create
Content-Type: application/json
X-API-Key: sk_test_abc123
```

```json
{
  "amount": 100,
  "currency": "SUT",
  "chainId": 80002,
  "recipientAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
}
```

#### Response (201 Created)

```json
{
  "success": true,
  "paymentId": "pay_1732960000000",
  "tokenAddress": "0xE4C687167705Abf55d709395f92e254bdF5825a2",
  "gatewayAddress": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  "forwarderAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "amount": "100",
  "decimals": 18,
  "status": "pending"
}
```

### POST /api/checkout

Create payment based on product array (internal store server API route only).

#### Request

```json
{
  "products": [
    { "productId": "prod_001", "quantity": 2 },
    { "productId": "prod_002", "quantity": 1 }
  ]
}
```

#### Response (201 Created)

```json
{
  "success": true,
  "paymentId": "0x5aed4bae...",
  "products": [
    {
      "productId": "prod_001",
      "productName": "Premium Widget",
      "quantity": 2,
      "unitPrice": "50",
      "subtotal": "100"
    }
  ],
  "totalAmount": "125",
  "tokenAddress": "0x...",
  "gatewayAddress": "0x...",
  "forwarderAddress": "0x...",
  "recipientAddress": "0x..."
}
```

### GET /payments/:id/status

Query payment status.

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "paymentId": "0x5aed4bae...",
    "status": "completed",
    "payer": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "merchant": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "amount": "100000000000000000000",
    "timestamp": 1733235200
  }
}
```

**Status Values**:
- `pending`: Payment pending
- `confirmed`: Confirmed on blockchain
- `completed`: Completed
- `failed`: Failed

### POST /payments/:id/gasless

Submit gasless transaction.

#### Request

```json
{
  "forwardRequest": {
    "from": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "to": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    "value": "0",
    "gas": "200000",
    "nonce": "0",
    "deadline": "1735689600",
    "data": "0x..."
  },
  "signature": "0x..."
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "transactionHash": "0xbbbbbbbb...",
  "status": "submitted",
  "message": "Gasless transaction executed"
}
```

### POST /payments/:id/relay

Execute relay transaction. (Same request/response format as Gasless API)

### GET /payments/history

Query user's payment history.

#### Query Parameters

| Parameter | Type | Required | Description |
|---------|------|------|------|
| chainId | number | ✅ | Blockchain network ID |
| payer | string | ✅ | Payer wallet address |
| limit | number | ❌ | Query limit (default: 1000) |

#### Response (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "paymentId": "0x5aed4bae...",
      "payer": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      "merchant": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      "token": "0xE4C687167705Abf55d709395f92e254bdF5825a2",
      "tokenSymbol": "TEST",
      "decimals": 18,
      "amount": "100000000000000000000",
      "timestamp": "1733235200",
      "transactionHash": "0xaaaa...",
      "status": "completed",
      "isGasless": true,
      "relayId": "relay_abc123"
    }
  ]
}
```

---

## Token API

### GET /tokens/:tokenAddress/balance

Query ERC-20 token balance.

#### URL Parameters

| Parameter | Type | Required | Description |
|---------|------|------|------|
| tokenAddress | string | ✅ | ERC-20 token address |

#### Query Parameters

| Parameter | Type | Required | Description |
|---------|------|------|------|
| chainId | number | ✅ | Blockchain network ID |
| address | string | ✅ | Wallet address to query |

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "tokenAddress": "0x2791Bca1f2de4661ED88A30C99a7a9449Aa84174",
    "address": "0x1234...",
    "balance": "1000000000000000000",
    "decimals": 6,
    "symbol": "USDC"
  }
}
```

### GET /tokens/:tokenAddress/allowance

Query token approval amount.

#### URL Parameters

| Parameter | Type | Required | Description |
|---------|------|------|------|
| tokenAddress | string | ✅ | ERC-20 token address |

#### Query Parameters

| Parameter | Type | Required | Description |
|---------|------|------|------|
| chainId | number | ✅ | Blockchain network ID |
| owner | string | ✅ | Owner address |
| spender | string | ✅ | Approved address (Gateway) |

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "tokenAddress": "0x2791Bca1f2de4661ED88A30C99a7a9449Aa84174",
    "owner": "0x1234...",
    "spender": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    "allowance": "5000000000000000000",
    "decimals": 6,
    "symbol": "USDC"
  }
}
```

---

## Transaction API

### GET /transactions/:id/status

Query transaction status.

#### URL Parameters

| Parameter | Type | Required | Description |
|---------|------|------|------|
| id | string | ✅ | Transaction hash |

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "transactionHash": "0xabcd1234...",
    "status": "confirmed",
    "blockNumber": 42000000,
    "confirmations": 10,
    "from": "0x1234...",
    "to": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    "gasUsed": 150000,
    "gasPrice": "25000000000",
    "timestamp": "2024-11-29T10:01:00.000Z"
  }
}
```

**Status Values**:
- `pending`: Awaiting mining
- `confirmed`: Confirmed (1+ blocks)
- `failed`: Execution failed

---

## Error Responses

All errors follow this format:

```json
{
  "code": "ERROR_CODE",
  "message": "Error message"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|----------|------|
| VALIDATION_ERROR | 400 | Input validation failed |
| INVALID_REQUEST | 400 | Invalid request |
| INVALID_SIGNATURE | 400 | Signature verification failed |
| NOT_FOUND | 404 | Resource not found |
| INTERNAL_ERROR | 500 | Server error |

See [Error Code Reference](errors.md) for complete error code list.

---

## Usage Examples

### cURL

```bash
# Create payment
curl -X POST http://localhost:3001/payments/create \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk_test_abc123" \
  -d '{
    "amount": 100,
    "currency": "SUT",
    "chainId": 80002,
    "recipientAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  }'

# Query payment status
curl http://localhost:3001/payments/pay_123/status

# Query token balance
curl "http://localhost:3001/tokens/0xE4C687167705Abf55d709395f92e254bdF5825a2/balance?chainId=80002&address=0x..."
```

### JavaScript/TypeScript (SDK)

```typescript
import { MSQPayClient } from '@globalmsq/msqpay';

const client = new MSQPayClient({
  environment: 'development',
  apiKey: 'sk_test_abc123'
});

// Create payment
const payment = await client.createPayment({
  merchantId: 'merchant_001',
  amount: 100,
  chainId: 31337,
  recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2'
});

// Query payment status
const status = await client.getPaymentStatus(payment.paymentId);
```

---

## Related Documentation

- [Integrate Payment](../guides/integrate-payment.md) - SDK usage guide
- [SDK Reference](sdk.md) - Complete MSQPayClient methods
- [Error Codes](errors.md) - Complete error code list
- [System Architecture](architecture.md) - Architecture diagrams
