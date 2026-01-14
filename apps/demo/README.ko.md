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

> **참고**: 체인 설정(RPC URL, 컨트랙트 주소)은 결제 서버의 데이터베이스에서 관리됩니다. 지갑 연결은 RainbowKit을 통해 처리됩니다.

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

### 2. 결제 내역 조회

```typescript
// app/api/payments/history/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const payer = request.nextUrl.searchParams.get('payer');
    const chainId = request.nextUrl.searchParams.get('chainId');

    if (!payer) {
      return NextResponse.json(
        { success: false, message: 'payer parameter required' },
        { status: 400 }
      );
    }

    if (!chainId) {
      return NextResponse.json(
        { success: false, message: 'chainId parameter required' },
        { status: 400 }
      );
    }

    const apiUrl = process.env.MSQPAY_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/payments/history?chainId=${chainId}&payer=${payer}`);
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
      forwardRequest: body.forwardRequest
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

### 5. Relay 상태 조회

```typescript
// app/api/payments/relay/[relayRequestId]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getMSQPayClient } from '@/lib/msqpay-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { relayRequestId: string } }
) {
  try {
    const client = getMSQPayClient();

    const result = await client.getRelayStatus(params.relayRequestId);

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.statusCode || 500 }
    );
  }
}
```

### 6. 체크아웃 결제 생성

```typescript
// app/api/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MSQPayClient } from '@globalmsq/msqpay';
import { getProductById } from '@/lib/products';
import { getMerchantConfig } from '@/lib/merchant';

const client = new MSQPayClient({
  environment: 'custom',
  apiKey: process.env.MSQPAY_API_KEY || 'demo-key',
  apiUrl: process.env.MSQPAY_API_URL || 'http://127.0.0.1:3001',
});

interface CheckoutItem {
  productId: string;
  quantity?: number;
}

interface CheckoutRequest {
  products: CheckoutItem[];
}

interface ProductInfo {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckoutRequest = await request.json();
    const { products } = body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        {
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Missing or invalid required field: products (array)',
        },
        { status: 400 }
      );
    }

    const merchantConfig = getMerchantConfig();

    const productInfos: ProductInfo[] = [];
    let totalAmount = 0;

    for (const item of products) {
      const { productId, quantity = 1 } = item;

      if (!productId) {
        return NextResponse.json(
          {
            success: false,
            code: 'VALIDATION_ERROR',
            message: 'Product ID is required for each item',
          },
          { status: 400 }
        );
      }

      const product = getProductById(productId);
      if (!product) {
        return NextResponse.json(
          {
            success: false,
            code: 'PRODUCT_NOT_FOUND',
            message: `Product not found: ${productId}`,
          },
          { status: 404 }
        );
      }

      const unitPrice = parseFloat(product.price);
      const subtotal = unitPrice * quantity;
      totalAmount += subtotal;

      productInfos.push({
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice: product.price,
        subtotal: subtotal.toString(),
      });
    }

    const payment = await client.createPayment({
      merchantId: merchantConfig.merchantId,
      amount: totalAmount,
      currency: merchantConfig.tokenSymbol,
      chainId: merchantConfig.chainId,
      recipientAddress: merchantConfig.recipientAddress,
      tokenAddress: merchantConfig.tokenAddress,
      tokenDecimals: merchantConfig.tokenDecimals,
    });

    return NextResponse.json(
      {
        success: true,
        // 결제 서버에서 생성된 paymentId
        // 상점은 이 paymentId를 저장하여 내부 주문과 매핑할 수 있음
        paymentId: payment.paymentId,
        products: productInfos,
        totalAmount: totalAmount.toString(),
        chainId: merchantConfig.chainId,
        tokenSymbol: merchantConfig.tokenSymbol,
        tokenAddress: merchantConfig.tokenAddress,
        decimals: merchantConfig.tokenDecimals,
        gatewayAddress: payment.gatewayAddress,
        forwarderAddress: payment.forwarderAddress,
        recipientAddress: merchantConfig.recipientAddress,
      },
      { status: 201 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = (error as Record<string, unknown>)?.code || 'INTERNAL_ERROR';

    if (errorCode === 'UNSUPPORTED_CHAIN' || errorCode === 'UNSUPPORTED_TOKEN') {
      return NextResponse.json(
        {
          success: false,
          code: errorCode,
          message: errorMessage,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        code: 'INTERNAL_ERROR',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
```

### 7. 체인 설정 조회

```typescript
// app/api/config/route.ts
import { NextResponse } from 'next/server';

export interface ChainConfig {
  chainId: number;
  rpcUrl: string;
  chainName: string;
}

export async function GET() {
  const config: ChainConfig = {
    chainId: Number(process.env.CHAIN_ID) || 31337,
    rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
    chainName: process.env.CHAIN_NAME || 'Hardhat',
  };

  return NextResponse.json(config);
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
  forwardRequest: any
) {
  const response = await fetch(`/api/payments/${paymentId}/gasless`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      forwarderAddress,
      forwardRequest
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

- [MSQPay SDK 문서](../../packages/sdk/README.ko.md)
- [API 명세서](../../docs/reference/api.ko.md)
- [아키텍처 문서](../../docs/reference/architecture.ko.md)
- [스마트 컨트랙트 문서](../../contracts/README.ko.md)

---

## 지원

문제가 발생하면 이슈를 등록해 주세요.
