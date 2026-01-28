# Payment Status

Check the current status of a payment.

## SDK Usage

```typescript
// Check status by paymentId
const result = await client.getPaymentStatus('0xabc123...');

console.log(result.data.status); // CREATED | PENDING | CONFIRMED | FAILED | EXPIRED
```

## REST API Usage

```bash
curl -X GET http://localhost:3001/payments/0xabc123.../status \
  -H "x-api-key: sk_test_xxxxx"
```

## Response

### Success (200 OK)

```json
{
  "success": true,
  "data": {
    "paymentId": "0xabc123...",
    "status": "CONFIRMED",
    "amount": "10000000",
    "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "tokenSymbol": "USDC",
    "recipientAddress": "0xMerchantAddress...",
    "transactionHash": "0xdef789...",
    "payment_hash": "0xabc123...",
    "network_id": 80002,
    "createdAt": "2024-01-26T12:30:00Z",
    "updatedAt": "2024-01-26T12:35:42Z"
  }
}
```

## Status Flow

```
CREATED ──────────▶ PENDING ──────────▶ CONFIRMED
    │                  │
    │                  │
    ▼                  ▼
 EXPIRED            FAILED
```

## Status Description

| Status      | Description                                      | Next Action                  |
| ----------- | ------------------------------------------------ | ---------------------------- |
| `CREATED`   | Payment created, waiting for user action         | User proceeds with payment   |
| `PENDING`   | Transaction sent, waiting for block confirmation | Wait (usually a few seconds) |
| `CONFIRMED` | Payment complete, block confirmed                | Process completion           |
| `FAILED`    | Transaction failed                               | Create new payment           |
| `EXPIRED`   | Expired after 30 minutes                         | Create new payment           |

## Response Fields by Status

### CREATED

```json
{
  "success": true,
  "data": {
    "paymentId": "0xabc123...",
    "status": "CREATED",
    "amount": "10000000",
    "tokenAddress": "0x...",
    "tokenSymbol": "USDC",
    "createdAt": "2024-01-26T12:30:00Z"
  }
}
```

### PENDING

```json
{
  "success": true,
  "data": {
    "paymentId": "0xabc123...",
    "status": "PENDING",
    "amount": "10000000",
    "transactionHash": "0xdef789..."
  }
}
```

### CONFIRMED

```json
{
  "success": true,
  "data": {
    "paymentId": "0xabc123...",
    "status": "CONFIRMED",
    "amount": "10000000",
    "transactionHash": "0xdef789...",
    "createdAt": "2024-01-26T12:30:00Z",
    "updatedAt": "2024-01-26T12:35:42Z"
  }
}
```

### FAILED

```json
{
  "success": true,
  "data": {
    "paymentId": "0xabc123...",
    "status": "FAILED",
    "transactionHash": "0xdef789..."
  }
}
```

### EXPIRED

```json
{
  "success": true,
  "data": {
    "paymentId": "0xabc123...",
    "status": "EXPIRED"
  }
}
```

## Polling vs Webhook

### Polling Method

Query the status periodically.

```typescript
const pollPaymentStatus = async (paymentId: string) => {
  while (true) {
    const result = await client.getPaymentStatus(paymentId);
    const status = result.data.status;

    if (status === 'CONFIRMED' || status === 'FAILED' || status === 'EXPIRED') {
      return status;
    }

    // Wait 2 seconds before retry
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
};
```

::: warning Polling Guidelines
Recommended interval: 2 seconds or more. Too frequent requests may overload the server.
:::

### Webhook Method (Coming Soon)

::: info Coming Soon
Webhook functionality is currently in development. You'll be able to receive real-time notifications when status changes.
:::

## Next Steps

- [Payment History](/en/payments/history) - Past payment records
- [Gasless Payments](/en/gasless/) - Pay without gas fees
