# Webhook

::: warning 개발 예정
Webhook 기능은 현재 개발 중입니다. 아래 문서는 예정된 기능 명세입니다.
:::

결제 상태 변경 시 실시간으로 알림을 받습니다.

## 개요

Webhook을 설정하면 결제 상태가 변경될 때 지정한 URL로 HTTP POST 요청을 받을 수 있습니다.

::: tip 왜 Webhook을 사용해야 하나요?
- **실시간 알림**: 상태 변경 즉시 알림
- **서버 리소스 절약**: 폴링 불필요
- **신뢰성**: 재시도 메커니즘 내장
:::

## 설정 방법 (예정)

### 1. 대시보드에서 설정

1. MSQPay 대시보드에 로그인
2. Settings > Webhooks 메뉴로 이동
3. "Add Webhook" 클릭
4. Webhook URL 입력 (HTTPS 필수)
5. 수신할 이벤트 타입 선택
6. Secret Key 저장 (서명 검증용)

### 2. 엔드포인트 요구사항

- HTTPS 프로토콜 필수
- 200 응답을 5초 이내에 반환
- 타임아웃 시 재시도됨

## 이벤트 타입

| 이벤트 | 설명 | 발생 시점 |
|--------|------|----------|
| `payment.created` | 결제 생성됨 | 결제 생성 직후 |
| `payment.pending` | 트랜잭션 전송됨 | TX가 블록에 포함됨 |
| `payment.confirmed` | 결제 완료 | 블록 확정 후 |
| `payment.failed` | 결제 실패 | TX 실패 시 |
| `payment.expired` | 결제 만료 | 30분 초과 시 |

## Payload 구조

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

## 헤더

| 헤더 | 설명 |
|------|------|
| `Content-Type` | `application/json` |
| `X-MSQPay-Signature` | HMAC-SHA256 서명 |
| `X-MSQPay-Timestamp` | 요청 생성 시각 (Unix timestamp) |
| `X-MSQPay-Event` | 이벤트 타입 |

## 재시도 정책

Webhook 전송 실패 시 지수 백오프로 재시도합니다.

| 재시도 | 대기 시간 |
|--------|----------|
| 1차 | 1분 |
| 2차 | 5분 |
| 3차 | 30분 |
| 4차 | 2시간 |
| 5차 | 24시간 |

5회 실패 후 해당 이벤트는 폐기됩니다.

## 현재 대안: 폴링

Webhook이 구현되기 전까지는 폴링 방식으로 상태를 확인할 수 있습니다.

```typescript
// 결제 상태 폴링 예시
const pollPaymentStatus = async (paymentId: string) => {
  while (true) {
    const result = await client.getPaymentStatus(paymentId)
    const status = result.data.status

    if (status === 'CONFIRMED' || status === 'FAILED' || status === 'EXPIRED') {
      return status
    }

    // 2초 대기 후 재시도
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
}
```

## 다음 단계

- [결제 상태 조회](/ko/payments/status) - 폴링 방식으로 상태 확인
- [에러 코드](/ko/api/errors) - 에러 처리
