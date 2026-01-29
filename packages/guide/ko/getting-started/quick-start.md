# 빠른 시작

5분 안에 MSQPay를 연동하는 방법을 알아봅니다.

## 사전 준비

- API Key (테스트용은 대시보드에서 발급)
- Node.js 18 이상

## Step 1: SDK 설치

::: code-group

```bash [npm]
npm install @globalmsq/msqpay
```

```bash [pnpm]
pnpm add @globalmsq/msqpay
```

```bash [yarn]
yarn add @globalmsq/msqpay
```

:::

## Step 2: 클라이언트 초기화

```typescript
import { MSQPayClient } from '@globalmsq/msqpay';

const client = new MSQPayClient({
  apiKey: 'sk_test_...',
  environment: 'development', // 'development' | 'staging' | 'production'
});
```

::: tip 환경 설정

- `development`: 로컬 개발 환경 (`http://localhost:3001`)
- `staging`: 테스트넷 (Polygon Amoy 등)
- `production`: 메인넷
  :::

## Step 3: 첫 결제 생성

```typescript
const payment = await client.createPayment({
  merchantId: 'merchant_demo_001', // 가맹점 ID
  amount: 10.5, // 10.5 USDC
  chainId: 80002, // Polygon Amoy
  tokenAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
});

console.log(payment.paymentId); // 0xabc123... (bytes32 해시)
console.log(payment.status); // created
console.log(payment.amount); // 10500000 (wei 단위)
console.log(payment.expiresAt); // 2024-01-26T13:00:00.000Z
```

## Step 4: 결제 상태 조회

```typescript
const status = await client.getPaymentStatus(payment.paymentId);

console.log(status.data.status); // CREATED | PENDING | CONFIRMED | FAILED | EXPIRED
```

## 결제 상태 흐름

```
CREATED ──────▶ PENDING ──────▶ CONFIRMED
    │              │
    │              ▼
    │           FAILED
    ▼
 EXPIRED
```

| 상태        | 설명                            |
| ----------- | ------------------------------- |
| `CREATED`   | 결제 생성됨, 사용자 액션 대기   |
| `PENDING`   | 트랜잭션 전송됨, 블록 확정 대기 |
| `CONFIRMED` | 결제 완료                       |
| `FAILED`    | 트랜잭션 실패                   |
| `EXPIRED`   | 30분 초과로 만료                |

## 전체 예시

```typescript
import { MSQPayClient, MSQPayError } from '@globalmsq/msqpay';

const client = new MSQPayClient({
  apiKey: process.env.MSQPAY_API_KEY!,
  environment: 'staging',
});

async function createPayment() {
  try {
    // 1. 결제 생성
    const payment = await client.createPayment({
      merchantId: 'merchant_demo_001',
      amount: 10.5,
      chainId: 80002,
      tokenAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    });

    console.log('결제 생성됨:', payment.paymentId);

    // 2. 결제 정보를 프론트엔드로 전달
    // - paymentId: 결제 식별자
    // - gatewayAddress: PaymentGateway 컨트랙트
    // - forwarderAddress: Gasless용 Forwarder 컨트랙트
    // - amount: wei 단위 금액

    return payment;
  } catch (error) {
    if (error instanceof MSQPayError) {
      console.error('결제 생성 실패:', error.code, error.message);
    }
    throw error;
  }
}
```

## 다음 단계

- [인증](/ko/getting-started/authentication) - API Key 상세 사용법
- [결제 생성](/ko/payments/create) - 결제 API 상세 가이드
- [Gasless 결제](/ko/gasless/) - 가스비 없이 결제하기
- [Webhook 설정](/ko/webhook/) - 결제 완료 알림 받기
