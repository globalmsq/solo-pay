# API Reference

Complete SoloPay REST API specification.

## Base URL

| Environment | URL                               |
| ----------- | --------------------------------- |
| Production  | `https://api.solopay.com`         |
| Staging     | `https://staging-api.solopay.com` |
| Development | `http://localhost:3001`           |

## Authentication

All API requests require the `x-api-key` header.

```bash
curl -H "x-api-key: sk_test_xxxxx" https://api.solopay.com/...
```

## Common Response Format

### Success

```json
{
  "success": true,
  ...
}
```

### Error

```json
{
  "code": "ERROR_CODE",
  "message": "Human readable message"
}
```

---

## Payments

### POST /payments/create

Creates a payment. Auth: `x-public-key` + `Origin` headers.

**Request**

```json
{
  "orderId": "order-001",
  "amount": 10.5,
  "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "successUrl": "https://example.com/success",
  "failUrl": "https://example.com/fail"
}
```

| Field          | Type    | Required | Description                                                         |
| -------------- | ------- | -------- | ------------------------------------------------------------------- |
| `orderId`      | string  | ✓        | Merchant order identifier                                           |
| `amount`       | number  | ✓        | Payment amount (token units, e.g., 10.5 USDC)                       |
| `tokenAddress` | address | ✓        | ERC-20 token address (must be whitelisted and enabled for merchant) |
| `successUrl`   | string  | ✓        | Redirect URL on success                                             |
| `failUrl`      | string  | ✓        | Redirect URL on failure                                             |
| `webhookUrl`   | string  |          | Optional per-payment webhook URL                                    |

**Response (201)**

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

---

### GET /payments/:id/status

Retrieves payment status.

**Response (200)**

```json
{
  "success": true,
  "data": {
    "paymentId": "0xabc123...",
    "status": "CONFIRMED",
    "amount": "10500000",
    "tokenAddress": "0x...",
    "tokenSymbol": "USDC",
    "recipientAddress": "0x...",
    "transactionHash": "0xdef789...",
    "payment_hash": "0xabc123...",
    "network_id": 80002,
    "createdAt": "2024-01-26T12:30:00Z",
    "updatedAt": "2024-01-26T12:35:42Z"
  }
}
```

---

### GET /payments/history

Retrieves payment history.

**Query Parameters**

| Field     | Type    | Required | Description           |
| --------- | ------- | -------- | --------------------- |
| `chainId` | number  | ✓        | Blockchain network ID |
| `payer`   | address | ✓        | Payer wallet address  |
| `limit`   | number  |          | Number of records     |

**Response (200)**

```json
{
  "success": true,
  "data": [
    {
      "paymentId": "0x...",
      "payer": "0x...",
      "merchant": "0x...",
      "token": "0x...",
      "tokenSymbol": "USDC",
      "decimals": 6,
      "amount": "10500000",
      "timestamp": "1706271342",
      "transactionHash": "0x...",
      "status": "CONFIRMED",
      "isGasless": false
    }
  ]
}
```

---

### POST /payments/:id/gasless

Submits a gasless payment.

**Request**

```json
{
  "paymentId": "0xabc123...",
  "forwarderAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "forwardRequest": {
    "from": "0x...",
    "to": "0x...",
    "value": "0",
    "gas": "200000",
    "nonce": "1",
    "deadline": "1706281200",
    "data": "0x...",
    "signature": "0x..."
  }
}
```

| Field                      | Type    | Required | Description                        |
| -------------------------- | ------- | -------- | ---------------------------------- |
| `paymentId`                | string  | ✓        | Payment hash (bytes32)             |
| `forwarderAddress`         | address | ✓        | ERC2771 Forwarder contract address |
| `forwardRequest`           | object  | ✓        | EIP-712 signed request data        |
| `forwardRequest.signature` | string  | ✓        | EIP-712 signature                  |

**Response (202)**

```json
{
  "success": true,
  "relayRequestId": "relay_abc123",
  "status": "submitted",
  "message": "Gasless transaction submitted"
}
```

---

### GET /payments/relay/:id/status

Retrieves relay request status.

**Response (200)**

```json
{
  "success": true,
  "relayRequestId": "relay_abc123",
  "status": "confirmed",
  "transactionHash": "0x..."
}
```

---

## Merchants

### GET /merchants/me

Retrieves current merchant information.

**Response (200)**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "merchant_key": "my-store",
    "name": "My Store",
    "is_enabled": true,
    "chain_id": 1,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

---

### GET /merchants/me/payment-methods

Retrieves payment methods list.

**Response (200)**

```json
{
  "success": true,
  "data": [
    {
      "tokenAddress": "0x...",
      "tokenSymbol": "USDC",
      "tokenDecimals": 6,
      "recipientAddress": "0x...",
      "chainId": 80002,
      "chainName": "Polygon Amoy",
      "enabled": true
    }
  ]
}
```

---

## Tokens

### GET /tokens/:tokenAddress/balance

Retrieves token balance.

**Query Parameters**

| Field     | Type    | Required | Description           |
| --------- | ------- | -------- | --------------------- |
| `chainId` | number  | ✓        | Blockchain network ID |
| `address` | address | ✓        | Wallet address        |

**Response (200)**

```json
{
  "success": true,
  "data": {
    "balance": "100000000"
  }
}
```

---

### GET /tokens/:tokenAddress/allowance

Retrieves token allowance.

**Query Parameters**

| Field     | Type    | Required | Description                       |
| --------- | ------- | -------- | --------------------------------- |
| `chainId` | number  | ✓        | Blockchain network ID             |
| `owner`   | address | ✓        | Owner address                     |
| `spender` | address | ✓        | Approved address (PaymentGateway) |

**Response (200)**

```json
{
  "success": true,
  "data": {
    "allowance": "115792089237316195423570985008687907853269984665640564039457584007913129639935"
  }
}
```

---

## Chains

### GET /chains

Retrieves supported chains list.

**Response (200)**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "networkId": 80002,
      "name": "Polygon Amoy",
      "gatewayAddress": "0x...",
      "forwarderAddress": "0x...",
      "tokens": [
        {
          "address": "0x...",
          "symbol": "USDC",
          "decimals": 6
        }
      ]
    }
  ]
}
```

---

## Health

### GET /health

Checks server status.

**Response (200)**

```json
{
  "status": "ok",
  "timestamp": "2024-01-26T12:00:00.000Z"
}
```

## Next Steps

- [Error Codes](/en/api/errors) - Error handling
- [SDK Usage](/en/sdk/) - Easy usage with SDK
