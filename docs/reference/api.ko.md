[English](api.md) | [한국어](api.ko.md)

# API 레퍼런스

MSQPay REST API 전체 엔드포인트 레퍼런스입니다.

## 개요

| 항목 | 값 |
|------|-----|
| Base URL | `http://localhost:3001` (dev), `https://pay-api.msq.com` (prod) |
| Protocol | REST API (HTTP/HTTPS) |
| Content-Type | `application/json` |
| Authentication | x-api-key (결제 API만) |

## 엔드포인트 목록

### 결제 API

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/payments/create` | POST | 결제 생성, paymentId 발급 |
| `/api/checkout` | POST | 상품 기반 결제 (Demo App) |
| `/payments/:id/status` | GET | 결제 상태 조회 |
| `/payments/:id/gasless` | POST | Gasless 거래 제출 |
| `/payments/:id/relay` | POST | Relay 거래 실행 |
| `/payments/history` | GET | 결제 이력 조회 |

### 토큰 API

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/tokens/:tokenAddress/balance` | GET | 토큰 잔액 조회 |
| `/tokens/:tokenAddress/allowance` | GET | 토큰 Approval 조회 |

### 거래 API

| 엔드포인트 | 메서드 | 설명 |
|-----------|--------|------|
| `/transactions/:id/status` | GET | 거래 상태 조회 |

---

## 결제 API

### POST /payments/create

새로운 결제를 생성합니다.

**중요**: 이 API는 상점서버 → 결제서버 호출 전용입니다. 프론트엔드에서 직접 호출하면 안됩니다!

#### 요청

```http
POST /payments/create
Content-Type: application/json
x-api-key: sk_test_abc123
```

```json
{
  "amount": 100,
  "currency": "SUT",
  "chainId": 80002,
  "recipientAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
}
```

#### 응답 (201 Created)

```json
{
  "success": true,
  "paymentId": "pay_1732960000000",
  "tokenAddress": "0xE4C687167705Abf55d709395f92e254bdF5825a2",
  "gatewayAddress": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  "forwarderAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "amount": "100",
  "decimals": 18,
  "status": "pending"
}
```

### POST /api/checkout

상품 배열 기반 결제 생성 (상점서버 내부 API Route 전용).

#### 요청

```json
{
  "products": [
    { "productId": "prod_001", "quantity": 2 },
    { "productId": "prod_002", "quantity": 1 }
  ]
}
```

#### 응답 (201 Created)

```json
{
  "success": true,
  "paymentId": "0x5aed4bae...",
  "products": [
    {
      "productId": "prod_001",
      "productName": "Premium Widget",
      "quantity": 2,
      "unitPrice": "50",
      "subtotal": "100"
    }
  ],
  "totalAmount": "125",
  "tokenAddress": "0x...",
  "gatewayAddress": "0x...",
  "forwarderAddress": "0x...",
  "recipientAddress": "0x..."
}
```

### GET /payments/:id/status

결제 상태를 조회합니다.

#### 응답 (200 OK)

```json
{
  "success": true,
  "data": {
    "paymentId": "0x5aed4bae...",
    "status": "completed",
    "payer": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "merchant": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    "amount": "100000000000000000000",
    "timestamp": 1733235200
  }
}
```

**Status 값**:
- `pending`: 결제 대기 중
- `confirmed`: 블록체인 확인됨
- `completed`: 완료됨
- `failed`: 실패함

### POST /payments/:id/gasless

Gasless 거래를 제출합니다.

#### 요청

```json
{
  "forwardRequest": {
    "from": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    "to": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    "value": "0",
    "gas": "200000",
    "nonce": "0",
    "deadline": "1735689600",
    "data": "0x..."
  },
  "signature": "0x..."
}
```

#### 응답 (200 OK)

```json
{
  "success": true,
  "transactionHash": "0xbbbbbbbb...",
  "status": "submitted",
  "message": "Gasless 거래가 실행되었습니다"
}
```

### POST /payments/:id/relay

Relay 거래를 실행합니다. (Gasless API와 동일한 요청/응답 형식)

### GET /payments/history

사용자의 결제 이력을 조회합니다.

#### 쿼리 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| chainId | number | ✅ | 블록체인 네트워크 ID |
| payer | string | ✅ | 결제자 지갑 주소 |
| limit | number | ❌ | 조회 범위 (기본: 1000) |

#### 응답 (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "paymentId": "0x5aed4bae...",
      "payer": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      "merchant": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
      "token": "0xE4C687167705Abf55d709395f92e254bdF5825a2",
      "tokenSymbol": "TEST",
      "decimals": 18,
      "amount": "100000000000000000000",
      "timestamp": "1733235200",
      "transactionHash": "0xaaaa...",
      "status": "completed",
      "isGasless": true,
      "relayId": "relay_abc123"
    }
  ]
}
```

---

## 토큰 API

### GET /tokens/:tokenAddress/balance

ERC-20 토큰 잔액을 조회합니다.

#### URL 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| tokenAddress | string | ✅ | ERC-20 토큰 주소 |

#### 쿼리 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| chainId | number | ✅ | 블록체인 네트워크 ID |
| address | string | ✅ | 조회할 지갑 주소 |

#### 응답 (200 OK)

```json
{
  "success": true,
  "data": {
    "tokenAddress": "0x2791Bca1f2de4661ED88A30C99a7a9449Aa84174",
    "address": "0x1234...",
    "balance": "1000000000000000000",
    "decimals": 6,
    "symbol": "USDC"
  }
}
```

### GET /tokens/:tokenAddress/allowance

토큰 Approval 금액을 조회합니다.

#### URL 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| tokenAddress | string | ✅ | ERC-20 토큰 주소 |

#### 쿼리 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| chainId | number | ✅ | 블록체인 네트워크 ID |
| owner | string | ✅ | 소유자 주소 |
| spender | string | ✅ | 승인받은 주소 (Gateway) |

#### 응답 (200 OK)

```json
{
  "success": true,
  "data": {
    "tokenAddress": "0x2791Bca1f2de4661ED88A30C99a7a9449Aa84174",
    "owner": "0x1234...",
    "spender": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    "allowance": "5000000000000000000",
    "decimals": 6,
    "symbol": "USDC"
  }
}
```

---

## 거래 API

### GET /transactions/:id/status

트랜잭션 상태를 조회합니다.

#### URL 파라미터

| 파라미터 | 타입 | 필수 | 설명 |
|---------|------|------|------|
| id | string | ✅ | 트랜잭션 해시 |

#### 응답 (200 OK)

```json
{
  "success": true,
  "data": {
    "transactionHash": "0xabcd1234...",
    "status": "confirmed",
    "blockNumber": 42000000,
    "confirmations": 10,
    "from": "0x1234...",
    "to": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    "gasUsed": 150000,
    "gasPrice": "25000000000",
    "timestamp": "2024-11-29T10:01:00.000Z"
  }
}
```

**Status 값**:
- `pending`: 채굴 대기 중
- `confirmed`: 확인됨 (1개 이상 블록)
- `failed`: 실행 실패

---

## 에러 응답

모든 에러는 다음 형식을 따릅니다:

```json
{
  "code": "ERROR_CODE",
  "message": "에러 메시지"
}
```

### 주요 에러 코드

| 코드 | HTTP 상태 | 설명 |
|------|----------|------|
| VALIDATION_ERROR | 400 | 입력 검증 실패 |
| INVALID_REQUEST | 400 | 잘못된 요청 |
| INVALID_SIGNATURE | 400 | 서명 검증 실패 |
| NOT_FOUND | 404 | 리소스 없음 |
| INTERNAL_ERROR | 500 | 서버 오류 |

전체 에러 코드 목록은 [에러 코드 레퍼런스](errors.ko.md)를 참고하세요.

---

## 사용 예제

### cURL

```bash
# 결제 생성
curl -X POST http://localhost:3001/payments/create \
  -H "Content-Type: application/json" \
  -H "x-api-key: sk_test_abc123" \
  -d '{
    "amount": 100,
    "currency": "SUT",
    "chainId": 80002,
    "recipientAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  }'

# 결제 상태 조회
curl http://localhost:3001/payments/pay_123/status

# 토큰 잔액 조회
curl "http://localhost:3001/tokens/0xE4C687167705Abf55d709395f92e254bdF5825a2/balance?chainId=80002&address=0x..."
```

### JavaScript/TypeScript (SDK)

```typescript
import { MSQPayClient } from '@globalmsq/msqpay';

const client = new MSQPayClient({
  environment: 'development',
  apiKey: 'sk_test_abc123'
});

// 결제 생성
const payment = await client.createPayment({
  merchantId: 'merchant_001',
  amount: 100,
  chainId: 31337,
  recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2'
});

// 결제 상태 조회
const status = await client.getPaymentStatus(payment.paymentId);
```

---

## 관련 문서

- [결제 통합하기](../guides/integrate-payment.ko.md) - SDK 사용 가이드
- [SDK 레퍼런스](sdk.ko.md) - MSQPayClient 전체 메서드
- [에러 코드](errors.ko.md) - 전체 에러 코드 목록
- [시스템 구조](architecture.ko.md) - 아키텍처 다이어그램
