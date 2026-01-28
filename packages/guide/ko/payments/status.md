# 결제 상태 조회

결제의 현재 상태를 조회합니다.

## SDK 사용

```typescript
// paymentId로 상태 조회
const result = await client.getPaymentStatus('0xabc123...');

console.log(result.data.status); // CREATED | PENDING | CONFIRMED | FAILED | EXPIRED
```

## REST API 사용

```bash
curl -X GET http://localhost:3001/payments/0xabc123.../status \
  -H "x-api-key: sk_test_xxxxx"
```

## 응답

### 성공 (200 OK)

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

## 상태 흐름

```
CREATED ──────────▶ PENDING ──────────▶ CONFIRMED
    │                  │
    │                  │
    ▼                  ▼
 EXPIRED            FAILED
```

## 상태 설명

| 상태        | 설명                            | 다음 액션          |
| ----------- | ------------------------------- | ------------------ |
| `CREATED`   | 결제 생성됨, 사용자 액션 대기   | 사용자가 결제 진행 |
| `PENDING`   | 트랜잭션 전송됨, 블록 확정 대기 | 대기 (보통 수 초)  |
| `CONFIRMED` | 결제 완료, 블록 확정됨          | 완료 처리          |
| `FAILED`    | 트랜잭션 실패                   | 새 결제 생성       |
| `EXPIRED`   | 30분 초과로 만료                | 새 결제 생성       |

## 상태별 응답 필드

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

## 폴링 vs Webhook

### 폴링 방식

상태를 주기적으로 조회합니다.

```typescript
const pollPaymentStatus = async (paymentId: string) => {
  while (true) {
    const result = await client.getPaymentStatus(paymentId);
    const status = result.data.status;

    if (status === 'CONFIRMED' || status === 'FAILED' || status === 'EXPIRED') {
      return status;
    }

    // 2초 대기 후 재시도
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
};
```

::: warning 폴링 주의사항
권장 간격: 2초 이상. 너무 잦은 요청은 서버에 부하를 줄 수 있습니다.
:::

### Webhook 방식 (예정)

::: info 개발 예정
Webhook 기능은 현재 개발 중입니다. 상태 변경 시 서버로 실시간 알림을 받을 수 있게 됩니다.
:::

## 다음 단계

- [결제 내역 조회](/ko/payments/history) - 과거 결제 목록
- [Gasless 결제](/ko/gasless/) - 가스비 없는 결제
