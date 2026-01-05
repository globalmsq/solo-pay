# MSQPay Demo App - 상점 통합 가이드

[English](README.md) | [한국어](README.ko.md)

이 문서는 MSQPay 결제 시스템을 상점에 통합하는 방법을 설명합니다.

## 목차

- [아키텍처 개요](#아키텍처-개요)
- [시작하기](#시작하기)
- [SDK 설치 및 설정](#sdk-설치-및-설정)
- [API 엔드포인트 구현](#api-엔드포인트-구현)
- [프론트엔드 통합](#프론트엔드-통합)
- [결제 플로우](#결제-플로우)
- [에러 처리](#에러-처리)

---

## 아키텍처 개요

MSQPay는 3계층 아키텍처를 사용합니다:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   프론트엔드     │────▶│   상점 서버      │────▶│  MSQPay 서버    │────▶│   블록체인       │
│   (브라우저)     │     │   (Next.js)     │     │   (결제 서버)    │     │   (Ethereum)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
     fetch API            MSQPay SDK           REST API              스마트 컨트랙트
```

**핵심 원칙:**
- 프론트엔드는 직접 MSQPay 서버와 통신하지 않습니다
- 모든 API 호출은 상점 서버를 통해 프록시됩니다
- API 키는 서버 사이드에서만 사용됩니다 (보안)

---

## 시작하기

### 1. 환경변수 설정

```bash
# .env.example을 .env.local로 복사
cp .env.example .env.local
```

`.env.local` 파일을 열고 값을 설정합니다:

```bash
# 서버 사이드 (프론트엔드 노출 안됨)
MSQPAY_API_KEY=your-api-key-here
MSQPAY_API_URL=http://localhost:3001

# 클라이언트 사이드
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id
```

| 변수 | 필수 | 위치 | 설명 |
|------|------|------|------|
| `MSQPAY_API_KEY` | ✅ | Server | MSQPay 결제서버 인증 키 |
| `MSQPAY_API_URL` | ❌ | Server | 결제서버 URL (기본: localhost:3001) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | ✅ | Client | [WalletConnect](https://cloud.walletconnect.com/)에서 발급 |

> **참고**: 지원 체인과 컨트랙트 주소는 `src/lib/wagmi.ts`에 설정되어 있습니다. RPC는 MetaMask 지갑을 통해 연결됩니다.

### 2. 의존성 설치

```bash
pnpm install
```

### 3. 개발 서버 실행

```bash
# 로컬 개발
pnpm dev

# Docker 환경 (전체 스택)
cd docker && docker-compose up
```

---

## SDK 설치 및 설정

### 설치

```bash
pnpm add @globalmsq/msqpay
```

### 클라이언트 초기화

상점 서버에서 MSQPay SDK를 싱글톤으로 초기화합니다:

```typescript
// lib/msqpay-server.ts
import { MSQPayClient } from '@globalmsq/msqpay';

let msqpayClient: MSQPayClient | null = null;

export function getMSQPayClient(): MSQPayClient {
  if (!msqpayClient) {
    const apiUrl = process.env.MSQPAY_API_URL || 'http://localhost:3001';

    msqpayClient = new MSQPayClient({
      environment: 'custom',
      apiUrl: apiUrl,
      apiKey: process.env.MSQPAY_API_KEY || ''
    });
  }
  return msqpayClient;
}
```

**환경 옵션:**
- `development`: 개발 서버 (기본 URL 사용)
- `staging`: 스테이징 서버
- `production`: 프로덕션 서버
- `custom`: 커스텀 URL 직접 지정 (Docker 환경 등)

---

## API 엔드포인트 구현

상점 서버에서 구현해야 할 API 엔드포인트입니다.

### 1. 결제 상태 조회

```typescript
// app/api/payments/[paymentId]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getMSQPayClient } from '@/lib/msqpay-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  try {
    const client = getMSQPayClient();
    const result = await client.getPaymentStatus(params.paymentId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.statusCode || 500 }
    );
  }
}
```

**응답 예시:**
```json
{
  "success": true,
  "data": {
    "id": "pay_abc123",
    "userId": "user_001",
    "amount": 100,
    "currency": "USD",
    "tokenAddress": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
    "recipientAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "status": "confirmed",
    "transactionHash": "0x...",
    "blockNumber": 12345,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:31:00Z"
  }
}
```

### 2. 결제 내역 조회

```typescript
// app/api/payments/history/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const payer = request.nextUrl.searchParams.get('payer');

    if (!payer) {
      return NextResponse.json(
        { success: false, message: 'payer parameter required' },
        { status: 400 }
      );
    }

    const apiUrl = process.env.MSQPAY_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/payments/history?payer=${payer}`);
    const data = await response.json();

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
```

### 3. Gasless 결제 제출

```typescript
// app/api/payments/[paymentId]/gasless/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getMSQPayClient } from '@/lib/msqpay-server';

export async function POST(
  request: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  try {
    const client = getMSQPayClient();
    const body = await request.json();

    const result = await client.submitGasless({
      paymentId: params.paymentId,
      forwarderAddress: body.forwarderAddress,
      signature: body.signature
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.statusCode || 500 }
    );
  }
}
```

### 4. Relay 트랜잭션 실행

```typescript
// app/api/payments/[paymentId]/relay/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getMSQPayClient } from '@/lib/msqpay-server';

export async function POST(
  request: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  try {
    const client = getMSQPayClient();
    const body = await request.json();

    const result = await client.executeRelay({
      paymentId: params.paymentId,
      transactionData: body.transactionData,
      gasEstimate: body.gasEstimate
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.statusCode || 500 }
    );
  }
}
```

---

## 프론트엔드 통합

프론트엔드에서 상점 서버 API를 호출하는 방법입니다.

### 결제 상태 조회

```typescript
// 프론트엔드 코드
async function checkPaymentStatus(paymentId: string) {
  const response = await fetch(`/api/payments/${paymentId}/status`);
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message);
  }

  return result.data;
}

// 사용 예시
const payment = await checkPaymentStatus('pay_abc123');
console.log('결제 상태:', payment.status);
// 'pending' | 'confirmed' | 'failed' | 'completed'
```

### 결제 내역 조회

```typescript
async function getPaymentHistory(walletAddress: string) {
  const response = await fetch(`/api/payments/history?payer=${walletAddress}`);
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message);
  }

  return result.data;
}
```

### Gasless 결제 제출

```typescript
async function submitGaslessPayment(
  paymentId: string,
  forwarderAddress: string,
  signature: string
) {
  const response = await fetch(`/api/payments/${paymentId}/gasless`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      forwarderAddress,
      signature
    })
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message);
  }

  return result;
}
```

### 상태 폴링

결제 완료를 기다리는 폴링 패턴:

```typescript
async function waitForPaymentConfirmation(
  paymentId: string,
  maxAttempts = 30,
  intervalMs = 2000
): Promise<PaymentStatus> {
  for (let i = 0; i < maxAttempts; i++) {
    const payment = await checkPaymentStatus(paymentId);

    if (payment.status === 'confirmed' || payment.status === 'completed') {
      return payment;
    }

    if (payment.status === 'failed') {
      throw new Error('결제가 실패했습니다');
    }

    // pending 상태면 대기 후 재시도
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('결제 확인 시간이 초과되었습니다');
}

// 사용 예시
try {
  const confirmedPayment = await waitForPaymentConfirmation('pay_abc123');
  console.log('결제 확인됨:', confirmedPayment.transactionHash);
} catch (error) {
  console.error('결제 확인 실패:', error.message);
}
```

---

## 결제 플로우

### 1. 직접 결제 (Direct Payment)

사용자가 직접 가스비를 지불하는 일반적인 결제 방식입니다.

```
1. 사용자가 지갑 연결
2. 프론트엔드에서 결제 트랜잭션 생성
3. 사용자가 지갑에서 트랜잭션 승인 (가스비 지불)
4. 트랜잭션 해시로 결제 상태 조회
5. 결제 확인 완료
```

### 2. Gasless 결제 (Meta Transaction)

MSQPay가 가스비를 대납하는 방식입니다.

```
1. 사용자가 지갑 연결
2. 프론트엔드에서 메타 트랜잭션 데이터 생성
3. 사용자가 서명만 진행 (가스비 없음)
4. 상점 서버 → MSQPay 서버로 서명 제출
5. MSQPay가 트랜잭션 실행 및 가스비 대납
6. 결제 상태 폴링으로 완료 확인
```

```typescript
// Gasless 결제 전체 플로우 예시
import { getContractsForChain } from '@/lib/wagmi';

async function processGaslessPayment(paymentId: string, chainId: number) {
  const contracts = getContractsForChain(chainId);
  if (!contracts) throw new Error('지원하지 않는 체인입니다');

  // 1. 메타 트랜잭션 서명 생성 (지갑에서)
  const signature = await signMetaTransaction(/* ... */);

  // 2. 상점 서버로 서명 제출
  const submitResult = await submitGaslessPayment(
    paymentId,
    contracts.forwarder,
    signature
  );

  // 3. 결제 완료 대기
  const confirmedPayment = await waitForPaymentConfirmation(paymentId);

  return confirmedPayment;
}
```

---

## 에러 처리

### SDK 에러 코드

| 코드 | 설명 | 해결 방법 |
|------|------|----------|
| `INVALID_API_KEY` | API 키가 유효하지 않음 | API 키 확인 |
| `PAYMENT_NOT_FOUND` | 결제를 찾을 수 없음 | paymentId 확인 |
| `INSUFFICIENT_BALANCE` | 잔액 부족 | 토큰 잔액 확인 |
| `NETWORK_ERROR` | 네트워크 오류 | 연결 상태 확인 |
| `TRANSACTION_FAILED` | 트랜잭션 실패 | 트랜잭션 로그 확인 |

### 에러 처리 패턴

```typescript
import { MSQPayError } from '@globalmsq/msqpay';

try {
  const result = await client.getPaymentStatus(paymentId);
} catch (error) {
  if (error instanceof MSQPayError) {
    console.error('MSQPay 에러:', error.code, error.message);

    switch (error.code) {
      case 'PAYMENT_NOT_FOUND':
        // 결제 ID 확인 필요
        break;
      case 'INVALID_API_KEY':
        // API 키 설정 확인
        break;
      default:
        // 일반 에러 처리
    }
  } else {
    console.error('알 수 없는 에러:', error);
  }
}
```

---

## 추가 리소스

- [MSQPay SDK 문서](/packages/sdk/README.md)
- [API 명세서](/docs/api/payments.md)
- [아키텍처 문서](/docs/architecture.md)
- [스마트 컨트랙트 문서](/contracts/README.md)

---

## 지원

문제가 발생하면 이슈를 등록해 주세요.
