# Webhook

::: warning Coming Soon
Webhook functionality is currently in development. The documentation below describes planned features.
:::

Receive real-time notifications when payment status changes.

## Overview

When you set up a Webhook, you can receive HTTP POST requests to your specified URL whenever payment status changes.

::: tip Why Use Webhooks?
- **Real-time notifications**: Immediate notification on status change
- **Server resource savings**: No polling needed
- **Reliability**: Built-in retry mechanism
:::

## Setup (Coming Soon)

### 1. Dashboard Configuration

1. Log in to MSQPay Dashboard
2. Navigate to Settings > Webhooks
3. Click "Add Webhook"
4. Enter Webhook URL (HTTPS required)
5. Select event types to receive
6. Save Secret Key (for signature verification)

### 2. Endpoint Requirements

- HTTPS protocol required
- Return 200 response within 5 seconds
- Retries on timeout

## Event Types

| Event | Description | When Triggered |
|-------|-------------|----------------|
| `payment.created` | Payment created | Right after payment creation |
| `payment.pending` | Transaction sent | TX included in block |
| `payment.confirmed` | Payment complete | After block confirmation |
| `payment.failed` | Payment failed | When TX fails |
| `payment.expired` | Payment expired | After 30 minutes |

## Payload Structure

```json
{
  "event": "payment.confirmed",
  "timestamp": "2024-01-26T12:35:42Z",
  "data": {
    "paymentId": "0xabc123...",
    "paymentHash": "0xabc123...",
    "status": "CONFIRMED",
    "amount": "10000000",
    "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "tokenSymbol": "USDC",
    "payerAddress": "0x1234567890abcdef...",
    "recipientAddress": "0xMerchantAddress...",
    "txHash": "0xdef789...",
    "blockNumber": 12345678,
    "merchantOrderId": "order_001",
    "confirmedAt": "2024-01-26T12:35:42Z"
  }
}
```

## Headers

| Header | Description |
|--------|-------------|
| `Content-Type` | `application/json` |
| `X-MSQPay-Signature` | HMAC-SHA256 signature |
| `X-MSQPay-Timestamp` | Request creation time (Unix timestamp) |
| `X-MSQPay-Event` | Event type |

## Retry Policy

Webhook delivery failures are retried with exponential backoff.

| Retry | Wait Time |
|-------|-----------|
| 1st | 1 minute |
| 2nd | 5 minutes |
| 3rd | 30 minutes |
| 4th | 2 hours |
| 5th | 24 hours |

After 5 failures, the event is discarded.

## Current Alternative: Polling

Until Webhook is implemented, you can check status using polling.

```typescript
// Payment status polling example
const pollPaymentStatus = async (paymentId: string) => {
  while (true) {
    const result = await client.getPaymentStatus(paymentId)
    const status = result.data.status

    if (status === 'CONFIRMED' || status === 'FAILED' || status === 'EXPIRED') {
      return status
    }

    // Wait 2 seconds before retry
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
}
```

## Next Steps

- [Payment Status](/en/payments/status) - Check status via polling
- [Error Codes](/en/api/errors) - Error handling
