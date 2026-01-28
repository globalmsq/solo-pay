# 이벤트 상세

::: warning 개발 예정
Webhook 기능은 현재 개발 중입니다. 아래 문서는 예정된 기능 명세입니다.
:::

각 Webhook 이벤트의 상세 정보입니다.

## payment.created

결제가 생성되었을 때 발생합니다.

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

**처리 예시**

```typescript
case 'payment.created':
  // 주문 상태를 "결제 대기 중"으로 업데이트
  await updateOrderStatus(data.merchantOrderId, 'PENDING_PAYMENT')
  break
```

## payment.pending

트랜잭션이 블록에 포함되었을 때 발생합니다.

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

**처리 예시**

```typescript
case 'payment.pending':
  // 트랜잭션 해시 저장
  await saveTransactionHash(data.merchantOrderId, data.txHash)
  // UI에서 "결제 처리 중" 표시 가능
  break
```

## payment.confirmed

결제가 완료되었을 때 발생합니다. (블록 확정)

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

**처리 예시**

```typescript
case 'payment.confirmed':
  // 주문 완료 처리
  await completeOrder(data.merchantOrderId)

  // 사용자에게 알림
  await sendNotification(data.payerAddress, '결제가 완료되었습니다')

  // 영수증 발행
  await generateReceipt({
    orderId: data.merchantOrderId,
    amount: data.amount,
    txHash: data.txHash
  })
  break
```

::: tip 중요한 이벤트
`payment.confirmed`가 가장 중요한 이벤트입니다. 이 이벤트를 받으면 주문을 완료 처리하세요.
:::

## payment.failed

트랜잭션이 실패했을 때 발생합니다.

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

**처리 예시**

```typescript
case 'payment.failed':
  // 주문 상태를 "결제 실패"로 업데이트
  await updateOrderStatus(data.merchantOrderId, 'PAYMENT_FAILED')

  // 사용자에게 알림
  await sendNotification(
    data.payerAddress,
    `결제에 실패했습니다: ${data.failureReason}`
  )

  // 재결제 링크 제공
  await sendRetryLink(data.merchantOrderId)
  break
```

## payment.expired

결제가 만료되었을 때 발생합니다. (30분 초과)

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

**처리 예시**

```typescript
case 'payment.expired':
  // 주문 취소 또는 만료 처리
  await cancelOrder(data.merchantOrderId)

  // 재고 복구 (필요한 경우)
  await restoreInventory(data.merchantOrderId)

  // 사용자에게 알림
  await sendNotification(
    data.payerAddress,
    '결제 시간이 초과되었습니다. 다시 시도해주세요.'
  )
  break
```

## 전체 이벤트 핸들러 예시

```typescript
import { verifyWebhookSignature, WebhookEvent } from '@globalmsq/msqpay';

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
      await sendNotification(data.payerAddress, '결제 완료');
      await generateReceipt(data);
      break;

    case 'payment.failed':
      await updateOrderStatus(data.merchantOrderId, 'PAYMENT_FAILED');
      await sendNotification(data.payerAddress, `결제 실패: ${data.failureReason}`);
      break;

    case 'payment.expired':
      await cancelOrder(data.merchantOrderId);
      await sendNotification(data.payerAddress, '결제 만료');
      break;

    default:
      console.log('Unknown event:', eventType);
  }
}
```

## 다음 단계

- [API Reference](/ko/api/) - 전체 API 명세
- [에러 코드](/ko/api/errors) - 에러 처리
