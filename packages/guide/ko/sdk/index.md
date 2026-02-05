# SDK 설치

SoloPay SDK는 JavaScript/TypeScript 환경에서 사용할 수 있습니다.

## 설치

::: code-group

```bash [npm]
npm install @globalmsq/solopay
```

```bash [pnpm]
pnpm add @globalmsq/solopay
```

```bash [yarn]
yarn add @globalmsq/solopay
```

:::

## 요구사항

- Node.js 18.0.0 이상
- TypeScript 5.0 이상 (TypeScript 사용 시)

## 초기화

```typescript
import { SoloPayClient } from '@globalmsq/solopay';

const client = new SoloPayClient({
  apiKey: process.env.SOLO_PAY_API_KEY!,
  environment: 'staging',
});
```

## 설정 옵션

| 옵션          | 타입     | 필수 | 설명                                                   |
| ------------- | -------- | ---- | ------------------------------------------------------ |
| `apiKey`      | `string` | ✓    | API Key                                                |
| `environment` | `string` | ✓    | `development` \| `staging` \| `production` \| `custom` |
| `apiUrl`      | `string` |      | 커스텀 API URL (`custom` 환경에서 필수)                |

## 환경별 설정

### 개발 환경

```typescript
const client = new SoloPayClient({
  apiKey: 'sk_test_...',
  environment: 'development',
});
// 연결 주소: http://localhost:3001
```

### 스테이징 환경 (테스트넷)

```typescript
const client = new SoloPayClient({
  apiKey: 'sk_test_...',
  environment: 'staging',
});
// 연결 주소: https://staging-api.solopay.com
```

### 프로덕션 환경 (메인넷)

```typescript
const client = new SoloPayClient({
  apiKey: 'sk_live_...',
  environment: 'production',
});
// 연결 주소: https://api.solopay.com
```

### 커스텀 환경

```typescript
const client = new SoloPayClient({
  apiKey: 'sk_test_...',
  environment: 'custom',
  apiUrl: 'https://my-custom-server.com',
});
```

## 기본 사용법

```typescript
import { SoloPayClient, SoloPayError } from '@globalmsq/solopay';

const client = new SoloPayClient({
  apiKey: process.env.SOLO_PAY_API_KEY!,
  environment: 'staging',
});

// 결제 생성
const payment = await client.createPayment({
  merchantId: 'merchant_demo_001',
  amount: 10.5,
  chainId: 80002,
  tokenAddress: '0x...',
  recipientAddress: '0x...',
});

// 결제 상태 조회
const status = await client.getPaymentStatus(payment.paymentId);

// Gasless 결제 제출
const result = await client.submitGasless({
  paymentId: payment.paymentId,
  forwarderAddress: payment.forwarderAddress,
  forwardRequest: {
    /* 서명 데이터 */
  },
});
```

## TypeScript 지원

SDK는 완전한 TypeScript 타입을 제공합니다.

```typescript
import type {
  SoloPayConfig,
  CreatePaymentParams,
  CreatePaymentResponse,
  GaslessParams,
  GaslessResponse,
} from '@globalmsq/solopay';

const config: SoloPayConfig = {
  apiKey: 'sk_test_...',
  environment: 'staging',
};

const params: CreatePaymentParams = {
  merchantId: 'merchant_demo_001',
  amount: 10.5,
  chainId: 80002,
  tokenAddress: '0x...',
  recipientAddress: '0x...',
};
```

## 다음 단계

- [클라이언트 메서드](/ko/sdk/client) - 상세 API 사용법
- [결제 생성](/ko/payments/create) - 결제 연동 가이드
