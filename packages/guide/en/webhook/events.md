# Event Details

::: warning Coming Soon
Webhook functionality is currently in development. The documentation below describes planned features.
:::

Detailed information about each Webhook event.

## payment.created

Triggered when a payment is created.

```json
{
  "event": "payment.created",
  "timestamp": "2024-01-26T12:30:00Z",
  "data": {
    "paymentId": "0xabc123...",
    "paymentHash": "0xabc123...",
    "status": "CREATED",
    "amount": "10000000",
    "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "tokenSymbol": "USDC",
    "payerAddress": "0x1234567890abcdef...",
    "recipientAddress": "0xMerchantAddress...",
    "merchantOrderId": "order_001",
    "expiresAt": "2024-01-26T13:00:00Z",
    "createdAt": "2024-01-26T12:30:00Z"
  }
}
```

**Handling Example**

```typescript
case 'payment.created':
  // Update order status to "awaiting payment"
  await updateOrderStatus(data.merchantOrderId, 'PENDING_PAYMENT')
  break
```

## payment.pending

Triggered when a transaction is included in a block.

```json
{
  "event": "payment.pending",
  "timestamp": "2024-01-26T12:34:00Z",
  "data": {
    "paymentId": "0xabc123...",
    "paymentHash": "0xabc123...",
    "status": "PENDING",
    "amount": "10000000",
    "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "tokenSymbol": "USDC",
    "payerAddress": "0x1234567890abcdef...",
    "recipientAddress": "0xMerchantAddress...",
    "txHash": "0xdef789...",
    "merchantOrderId": "order_001"
  }
}
```

**Handling Example**

```typescript
case 'payment.pending':
  // Save transaction hash
  await saveTransactionHash(data.merchantOrderId, data.txHash)
  // Can display "Payment processing" in UI
  break
```

## payment.confirmed

Triggered when payment is complete. (Block confirmed)

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

**Handling Example**

```typescript
case 'payment.confirmed':
  // Complete order
  await completeOrder(data.merchantOrderId)

  // Notify user
  await sendNotification(data.payerAddress, 'Payment completed')

  // Generate receipt
  await generateReceipt({
    orderId: data.merchantOrderId,
    amount: data.amount,
    txHash: data.txHash
  })
  break
```

::: tip Important Event
`payment.confirmed` is the most important event. Complete the order when you receive this event.
:::

## payment.failed

Triggered when a transaction fails.

```json
{
  "event": "payment.failed",
  "timestamp": "2024-01-26T12:35:00Z",
  "data": {
    "paymentId": "0xabc123...",
    "paymentHash": "0xabc123...",
    "status": "FAILED",
    "amount": "10000000",
    "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "tokenSymbol": "USDC",
    "payerAddress": "0x1234567890abcdef...",
    "txHash": "0xdef789...",
    "merchantOrderId": "order_001",
    "failureReason": "Transaction reverted: insufficient balance"
  }
}
```

**Handling Example**

```typescript
case 'payment.failed':
  // Update order status to "payment failed"
  await updateOrderStatus(data.merchantOrderId, 'PAYMENT_FAILED')

  // Notify user
  await sendNotification(
    data.payerAddress,
    `Payment failed: ${data.failureReason}`
  )

  // Provide retry link
  await sendRetryLink(data.merchantOrderId)
  break
```

## payment.expired

Triggered when a payment expires. (After 30 minutes)

```json
{
  "event": "payment.expired",
  "timestamp": "2024-01-26T13:00:00Z",
  "data": {
    "paymentId": "0xabc123...",
    "paymentHash": "0xabc123...",
    "status": "EXPIRED",
    "amount": "10000000",
    "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "tokenSymbol": "USDC",
    "payerAddress": "0x1234567890abcdef...",
    "merchantOrderId": "order_001",
    "expiredAt": "2024-01-26T13:00:00Z"
  }
}
```

**Handling Example**

```typescript
case 'payment.expired':
  // Cancel or expire order
  await cancelOrder(data.merchantOrderId)

  // Restore inventory (if needed)
  await restoreInventory(data.merchantOrderId)

  // Notify user
  await sendNotification(
    data.payerAddress,
    'Payment time has expired. Please try again.'
  )
  break
```

## Complete Event Handler Example

```typescript
import { verifyWebhookSignature, WebhookEvent } from '@globalmsq/solopay';

async function handleWebhook(event: WebhookEvent) {
  const { event: eventType, data } = event;

  switch (eventType) {
    case 'payment.created':
      await updateOrderStatus(data.merchantOrderId, 'PENDING_PAYMENT');
      break;

    case 'payment.pending':
      await saveTransactionHash(data.merchantOrderId, data.txHash);
      break;

    case 'payment.confirmed':
      await completeOrder(data.merchantOrderId);
      await sendNotification(data.payerAddress, 'Payment complete');
      await generateReceipt(data);
      break;

    case 'payment.failed':
      await updateOrderStatus(data.merchantOrderId, 'PAYMENT_FAILED');
      await sendNotification(data.payerAddress, `Payment failed: ${data.failureReason}`);
      break;

    case 'payment.expired':
      await cancelOrder(data.merchantOrderId);
      await sendNotification(data.payerAddress, 'Payment expired');
      break;

    default:
      console.log('Unknown event:', eventType);
  }
}
```

## Next Steps

- [API Reference](/en/api/) - Complete API specification
- [Error Codes](/en/api/errors) - Error handling
