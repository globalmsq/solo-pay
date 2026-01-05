# MSQPay SDK (`@globalmsq/msqpay`)

[English](README.md) | [한국어](README.ko.md)

상점 서버에서 MSQPay 결제 API와 상호작용하기 위한 경량 TypeScript SDK입니다. Node.js 18+ 네이티브 `fetch`로 구축되었으며 외부 의존성이 없습니다.

## 설치

```bash
pnpm add @globalmsq/msqpay
```

## 빠른 시작

### 기본 사용법

```typescript
import { MSQPayClient } from '@globalmsq/msqpay';

// 클라이언트 초기화
const client = new MSQPayClient({
  environment: 'production',
  apiKey: 'your-api-key'
});

// 결제 생성
const payment = await client.createPayment({
  userId: 'user-123',
  amount: 1000,
  currency: 'USD',
  tokenAddress: '0x1234567890123456789012345678901234567890',
  recipientAddress: '0x0987654321098765432109876543210987654321',
  description: 'Purchase order #12345'
});

console.log(`결제 생성됨: ${payment.paymentId}`);
```

## 환경 설정

### 지원 환경

- **development**: `http://localhost:3001`
- **staging**: `https://pay-api.staging.msq.com`
- **production**: `https://pay-api.msq.com`
- **custom**: 설정에서 커스텀 `apiUrl` 제공

### 설정 예제

```typescript
// 개발 환경
const devClient = new MSQPayClient({
  environment: 'development',
  apiKey: 'dev-api-key'
});

// 커스텀 환경
const customClient = new MSQPayClient({
  environment: 'custom',
  apiKey: 'custom-api-key',
  apiUrl: 'https://my-api.example.com'
});
```

## API 메서드

### createPayment(params)

새로운 결제를 생성합니다.

```typescript
const response = await client.createPayment({
  userId: string;
  amount: number;
  currency?: 'USD' | 'EUR' | 'KRW';
  tokenAddress: string;
  recipientAddress: string;
  description?: string;
});

// 응답
{
  success: true;
  paymentId: string;
  transactionHash: string;
  status: 'pending';
}
```

### getPaymentStatus(paymentId)

결제 상태를 조회합니다.

```typescript
const status = await client.getPaymentStatus('pay-123');

// 응답
{
  success: true;
  data: {
    id: string;
    userId: string;
    amount: number;
    currency: 'USD' | 'EUR' | 'KRW';
    tokenAddress: string;
    recipientAddress: string;
    status: 'pending' | 'confirmed' | 'failed' | 'completed';
    transactionHash?: string;
    blockNumber?: number;
    createdAt: string;
    updatedAt: string;
  };
}
```

### submitGasless(params)

Gasless(메타 트랜잭션) 요청을 제출합니다.

```typescript
const response = await client.submitGasless({
  paymentId: string;
  forwarderAddress: string;
  signature: string;
});

// 응답
{
  success: true;
  relayRequestId: string;
  status: 'submitted' | 'mined' | 'failed';
  message: string;
}
```

### executeRelay(params)

릴레이 트랜잭션을 실행합니다.

```typescript
const response = await client.executeRelay({
  paymentId: string;
  transactionData: string;
  gasEstimate: number;
});

// 응답
{
  success: true;
  relayRequestId: string;
  transactionHash?: string;
  status: 'submitted' | 'mined' | 'failed';
  message: string;
}
```

### getPaymentHistory(params)

특정 결제자 주소의 결제 이력을 조회합니다.

```typescript
const response = await client.getPaymentHistory({
  chainId: number;      // 블록체인 체인 ID (예: 31337, 80002)
  payer: string;        // 결제자 지갑 주소
  limit?: number;       // 선택사항: 반환할 레코드 수
});

// 응답
{
  success: true;
  data: [
    {
      paymentId: string;        // 결제 ID (bytes32 해시)
      payer: string;            // 결제자 주소
      merchant: string;         // 상점 주소
      token: string;            // 토큰 컨트랙트 주소
      tokenSymbol: string;      // 토큰 심볼 (예: "USDC")
      decimals: number;         // 토큰 decimals
      amount: string;           // wei 단위 금액
      timestamp: string;        // Unix 타임스탬프
      transactionHash: string;  // 트랜잭션 해시
      status: string;           // 결제 상태
      isGasless: boolean;       // Gasless 결제 여부
      relayId?: string;         // 릴레이 요청 ID (gasless인 경우)
    }
  ];
}
```

### setApiUrl(url)

API URL을 동적으로 변경합니다.

```typescript
client.setApiUrl('https://new-api.example.com');
```

### getApiUrl()

현재 API URL을 가져옵니다.

```typescript
const url = client.getApiUrl();
console.log(url); // https://pay-api.msq.com
```

## 에러 처리

모든 API 에러는 다음 구조의 `MSQPayError`로 발생합니다:

```typescript
try {
  await client.createPayment(params);
} catch (error) {
  if (error instanceof MSQPayError) {
    console.error(`에러 [${error.code}]: ${error.message}`);
    console.error(`HTTP 상태: ${error.statusCode}`);
    console.error(`상세:`, error.details);
  }
}
```

### 에러 코드

| 코드 | HTTP 상태 | 설명 |
|------|-----------|------|
| `VALIDATION_ERROR` | 400 | 입력 검증 실패 |
| `INVALID_REQUEST` | 400 | 잘못된 요청 형식 |
| `INVALID_SIGNATURE` | 400 | 잘못된 서명 형식 |
| `INVALID_TRANSACTION_DATA` | 400 | 잘못된 트랜잭션 데이터 |
| `INVALID_GAS_ESTIMATE` | 400 | 잘못된 가스 추정치 |
| `NOT_FOUND` | 404 | 결제를 찾을 수 없음 |
| `INTERNAL_ERROR` | 500 | 서버 에러 |

## TypeScript 타입

SDK는 완전한 타입 안전성을 위해 모든 타입을 내보냅니다:

```typescript
import {
  MSQPayClient,
  MSQPayError,
  Environment,
  MSQPayConfig,
  CreatePaymentParams,
  CreatePaymentResponse,
  PaymentStatusResponse,
  GaslessParams,
  GaslessResponse,
  RelayParams,
  RelayResponse,
  GetPaymentHistoryParams,
  PaymentHistoryItem,
  PaymentHistoryResponse,
  ErrorResponse
} from '@globalmsq/msqpay';
```

### 타입 정의

```typescript
type Environment = 'development' | 'staging' | 'production' | 'custom';

interface MSQPayConfig {
  environment: Environment;
  apiKey: string;
  apiUrl?: string; // environment가 'custom'일 때 필수
}

interface CreatePaymentParams {
  userId: string;
  amount: number;
  currency?: 'USD' | 'EUR' | 'KRW';
  tokenAddress: string;      // 0x + 40 hex 문자
  recipientAddress: string;  // 0x + 40 hex 문자
  description?: string;
}

interface GaslessParams {
  paymentId: string;
  forwarderAddress: string;  // 0x + 40 hex 문자
  signature: string;         // 0x hex 문자열
}

interface RelayParams {
  paymentId: string;
  transactionData: string;   // 0x hex 문자열
  gasEstimate: number;
}

interface GetPaymentHistoryParams {
  chainId: number;           // 블록체인 체인 ID
  payer: string;             // 결제자 지갑 주소 (0x + 40 hex)
  limit?: number;            // 선택사항: 레코드 수
}

interface PaymentHistoryItem {
  paymentId: string;
  payer: string;
  merchant: string;
  token: string;
  tokenSymbol: string;
  decimals: number;
  amount: string;
  timestamp: string;
  transactionHash: string;
  status: string;
  isGasless: boolean;
  relayId?: string;
}
```

## 전체 예제

```typescript
import { MSQPayClient, MSQPayError } from '@globalmsq/msqpay';

async function processPayment() {
  const client = new MSQPayClient({
    environment: 'production',
    apiKey: process.env.MSQPAY_API_KEY!
  });

  try {
    // 1단계: 결제 생성
    console.log('결제 생성 중...');
    const payment = await client.createPayment({
      userId: 'user-456',
      amount: 5000,
      currency: 'USD',
      tokenAddress: '0x6b175474e89094c44da98b954eedeac495271d0f',
      recipientAddress: '0x9e5b65f2d0ca4541925d7c4cc5367cbeca076f82'
    });
    console.log(`결제 생성됨: ${payment.paymentId}`);

    // 2단계: 결제 상태 확인
    console.log('결제 상태 확인 중...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    const status = await client.getPaymentStatus(payment.paymentId);
    console.log(`결제 상태: ${status.data.status}`);

    // 3단계: Gasless 트랜잭션 제출
    if (status.data.status === 'pending') {
      console.log('Gasless 트랜잭션 제출 중...');
      const gaslessResult = await client.submitGasless({
        paymentId: payment.paymentId,
        forwarderAddress: '0x9e5b65f2d0ca4541925d7c4cc5367cbeca076f82',
        signature: '0x' + 'a'.repeat(130)
      });
      console.log(`릴레이 요청: ${gaslessResult.relayRequestId}`);
    }
  } catch (error) {
    if (error instanceof MSQPayError) {
      console.error(`결제 에러: [${error.code}] ${error.message}`);
    } else {
      console.error('예상치 못한 에러:', error);
    }
  }
}

processPayment();
```

## 요구사항

- Node.js >= 18.0.0 (네이티브 `fetch` 지원)
- TypeScript >= 5.0 (선택사항, 개발용)

## 기능

- ✅ **의존성 제로**: Node.js 네이티브 `fetch` API 사용
- ✅ **완전한 TypeScript 지원**: 전체 타입 정의 제공
- ✅ **타입 안전 에러 처리**: 에러 코드가 포함된 `MSQPayError` 클래스
- ✅ **환경 관리**: 다중 환경 기본 지원
- ✅ **API 키 인증**: 안전한 헤더 기반 인증
- ✅ **포괄적인 테스트 커버리지**: 100% 커버리지

## 테스트

```bash
# 테스트 실행
pnpm test

# 커버리지와 함께 테스트 실행
pnpm test:coverage

# TypeScript 빌드
pnpm build
```

## 라이선스

MIT

## 지원

문제나 질문이 있는 경우:
1. 발생한 `MSQPayError`의 에러 코드와 상세 정보 확인
2. API 키 및 환경 설정 확인
3. Node.js 버전 >= 18.0.0 확인
4. [API 문서](https://docs.msq.com/api) 검토
