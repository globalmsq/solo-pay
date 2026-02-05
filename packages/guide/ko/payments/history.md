# 결제 내역 조회

특정 주소의 결제 내역을 조회합니다.

## SDK 사용

```typescript
// 결제 내역 조회
const result = await client.getPaymentHistory({
  chainId: 80002, // 필수: 체인 ID
  payer: '0x1234...', // 필수: 결제자 지갑 주소
  limit: 10, // 선택: 조회 개수
});

console.log(result.data); // 결제 목록 배열
```

## REST API 사용

```bash
curl -X GET "http://localhost:3001/payments/history?chainId=80002&payer=0x...&limit=10" \
  -H "x-api-key: sk_test_xxxxx"
```

## 요청 파라미터

| 필드      | 타입      | 필수 | 설명                 |
| --------- | --------- | ---- | -------------------- |
| `chainId` | `number`  | ✓    | 블록체인 네트워크 ID |
| `payer`   | `address` | ✓    | 결제자 지갑 주소     |
| `limit`   | `number`  |      | 조회 개수            |

## 응답

### 성공 (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "paymentId": "0xabc123...",
      "payer": "0x1234...",
      "merchant": "0xMerchant...",
      "token": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      "tokenSymbol": "USDC",
      "decimals": 6,
      "amount": "10000000",
      "timestamp": "2024-01-26T12:35:42Z",
      "transactionHash": "0xdef789...",
      "status": "CONFIRMED",
      "isGasless": false,
      "relayId": null
    },
    {
      "paymentId": "0xdef456...",
      "payer": "0x1234...",
      "merchant": "0xMerchant...",
      "token": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      "tokenSymbol": "USDC",
      "decimals": 6,
      "amount": "5000000",
      "timestamp": "2024-01-25T10:20:30Z",
      "transactionHash": "0xabc123...",
      "status": "CONFIRMED",
      "isGasless": true,
      "relayId": "relay_abc123"
    }
  ]
}
```

## 사용 예시

```typescript
import { SoloPayClient } from '@globalmsq/solopay';

const client = new SoloPayClient({
  apiKey: process.env.SOLO_PAY_API_KEY!,
  environment: 'staging',
});

// 결제 내역 조회
async function fetchPaymentHistory() {
  const result = await client.getPaymentHistory({
    chainId: 80002,
    payer: '0x1234567890abcdef...',
    limit: 10,
  });

  if (result.success) {
    for (const payment of result.data) {
      console.log(`결제 ID: ${payment.paymentId}`);
      console.log(`금액: ${payment.amount} ${payment.tokenSymbol}`);
      console.log(`상태: ${payment.status}`);
      console.log(`Gasless: ${payment.isGasless ? '예' : '아니오'}`);
      console.log('---');
    }
  }
}
```

## 온체인 데이터 조회

Subgraph를 통해 온체인 결제 이벤트를 직접 조회할 수도 있습니다.

```graphql
query PaymentHistory($payer: Bytes!) {
  paymentReceivedEvents(
    where: { payer: $payer }
    orderBy: blockTimestamp
    orderDirection: desc
    first: 10
  ) {
    id
    paymentId
    payer
    token
    amount
    transactionHash
    blockTimestamp
  }
}
```

::: tip Subgraph 사용
대량의 히스토리 조회나 복잡한 필터링이 필요한 경우 Subgraph를 사용하세요.
:::

## 다음 단계

- [Gasless 결제](/ko/gasless/) - 가스비 없는 결제
- [에러 코드](/ko/api/errors) - 에러 처리
