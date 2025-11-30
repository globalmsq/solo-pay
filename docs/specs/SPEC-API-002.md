# SPEC-API-002: createPayment API 개선

## 문서 정보

| 항목 | 값 |
|------|-----|
| **SPEC ID** | SPEC-API-002 |
| **제목** | createPayment API 개선 - 블록체인 정보 서버 제공 |
| **상태** | Draft |
| **작성일** | 2025-11-30 |
| **작성자** | R2-D2 |

---

## 1. 개요

### 1.1 목적

Demo App의 하드코딩된 컨트랙트 주소 문제를 해결하기 위해 createPayment API를 개선합니다.
결제 서버가 **Single Source of Truth**로서 모든 블록체인 관련 정보를 제공합니다.

### 1.2 배경

현재 Demo App(`apps/demo/src/lib/wagmi.ts`)에서는 `CONTRACTS`, `TOKENS` 객체에 체인별 컨트랙트 주소가 하드코딩되어 있습니다. 이로 인해:

- 상점 앱이 체인별 컨트랙트 주소를 직접 관리해야 함
- 새로운 체인/토큰 추가 시 모든 상점 앱 수정 필요
- 중앙 집중식 관리 불가능

---

## 2. 문제점

### 2.1 현재 상태

```typescript
// apps/demo/src/lib/wagmi.ts - 현재 하드코딩된 상태
export const CONTRACTS: Record<number, { gateway: string; forwarder: string }> = {
  [polygonAmoy.id]: {
    gateway: "0x0000000000000000000000000000000000000000",
    forwarder: "0x0000000000000000000000000000000000000000",
  },
  [hardhat.id]: {
    gateway: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    forwarder: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  },
};

export const TOKENS: Record<number, Record<string, string>> = {
  [polygonAmoy.id]: {
    SUT: "0xE4C687167705Abf55d709395f92e254bdF5825a2",
  },
  [hardhat.id]: {
    TEST: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  },
};
```

### 2.2 문제점 요약

| 문제 | 영향 |
|------|------|
| 컨트랙트 주소 하드코딩 | 상점별 코드 수정 필요 |
| 체인별 토큰 주소 관리 | 새 체인 추가 시 모든 앱 업데이트 |
| 중앙 관리 불가 | 일관성 유지 어려움 |

---

## 3. 해결책

### 3.1 핵심 아이디어

**결제 서버가 블록체인 정보를 제공**:

1. 상점은 토큰 심볼(SUT, MSQ 등)과 chainId만 전달
2. 결제 서버가 해당 체인의 컨트랙트 주소 반환
3. Demo App에서 하드코딩된 주소 제거 가능

### 3.2 아키텍처 변경

```
[변경 전]
프론트엔드 → 상점서버 → 결제서버
    ↓
wagmi.ts에서 컨트랙트 주소 조회 (하드코딩)

[변경 후]
프론트엔드 → 상점서버 → 결제서버
                           ↓
              결제서버가 컨트랙트 주소 응답에 포함
```

---

## 4. API 설계

### 4.1 Request (상점서버 → 결제서버)

```http
POST /payments/create
Content-Type: application/json
```

```json
{
  "amount": 100,
  "currency": "SUT",
  "chainId": 80002,
  "recipientAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
}
```

#### Request 필드

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `amount` | number | ✅ | 결제 금액 (토큰 단위, 예: 100 SUT) |
| `currency` | string | ✅ | 토큰 심볼 (SUT, MSQ, TEST 등) |
| `chainId` | number | ✅ | 블록체인 네트워크 ID (MetaMask 연결 체인) |
| `recipientAddress` | string | ✅ | 결제 수령자(판매자) 주소 |

#### 지원 체인 및 토큰

| chainId | 네트워크 | 지원 토큰 |
|---------|---------|----------|
| 80002 | Polygon Amoy | SUT |
| 31337 | Hardhat (로컬) | TEST |

### 4.2 Response (결제서버 → 상점서버)

**Status: 201 Created**

```json
{
  "success": true,
  "paymentId": "pay_1732960000000",
  "tokenAddress": "0xE4C687167705Abf55d709395f92e254bdF5825a2",
  "gatewayAddress": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  "forwarderAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  "amount": "100000000000000000000",
  "status": "pending"
}
```

#### Response 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `success` | boolean | 요청 성공 여부 |
| `paymentId` | string | 생성된 결제 ID |
| `tokenAddress` | string | 해당 체인의 토큰 컨트랙트 주소 |
| `gatewayAddress` | string | 해당 체인의 Payment Gateway 주소 |
| `forwarderAddress` | string | Gasless 거래용 Forwarder 주소 |
| `amount` | string | wei 단위 변환된 금액 (decimals 적용) |
| `status` | string | 결제 상태 (`pending`) |

### 4.3 에러 응답

```json
{
  "code": "UNSUPPORTED_CHAIN",
  "message": "Chain ID 1 is not supported"
}
```

| 코드 | HTTP Status | 설명 |
|------|-------------|------|
| `VALIDATION_ERROR` | 400 | 입력 데이터 검증 실패 |
| `UNSUPPORTED_CHAIN` | 400 | 지원하지 않는 체인 |
| `UNSUPPORTED_TOKEN` | 400 | 해당 체인에서 지원하지 않는 토큰 |
| `INTERNAL_ERROR` | 500 | 서버 내부 오류 |

---

## 5. 결제 플로우

```
1. 사용자가 MetaMask 지갑 연결
   └─ wagmi/RainbowKit으로 연결

2. 프론트엔드에서 연결된 chainId 확인
   └─ 예: 80002 (Polygon Amoy)

3. 프론트엔드 → 상점서버
   └─ POST /api/payments/create
   └─ Body: { amount: 100, currency: "SUT", chainId: 80002, recipientAddress: "0x..." }

4. 상점서버 → 결제서버 (SDK 사용)
   └─ client.createPayment({ amount, currency, chainId, recipientAddress })

5. 결제서버 내부 처리
   ├─ chainId로 지원 체인 확인
   ├─ currency로 해당 체인의 토큰 주소 조회
   ├─ amount를 wei 단위로 변환 (decimals 적용)
   └─ 결제 레코드 생성 (DB 저장)

6. 결제서버 → 상점서버
   └─ Response: { paymentId, tokenAddress, gatewayAddress, forwarderAddress, amount, status }

7. 상점서버 → 프론트엔드
   └─ 결제 실행에 필요한 모든 정보 전달

8. 프론트엔드에서 트랜잭션 생성
   └─ gatewayAddress, tokenAddress 사용하여 블록체인 트랜잭션 실행
```

---

## 6. 영향 범위

### 6.1 packages/server

| 파일 | 변경 내용 |
|------|----------|
| `src/routes/payments/create.ts` | Request/Response 스키마 수정 |
| `src/config/chains.ts` (NEW) | 체인별 컨트랙트 설정 |
| `src/services/token.service.ts` (NEW) | 토큰 심볼 → 주소 조회 |

### 6.2 packages/sdk

| 파일 | 변경 내용 |
|------|----------|
| `src/types.ts` | `CreatePaymentRequest`, `CreatePaymentResponse` 타입 수정 |
| `src/client.ts` | `createPayment()` 메서드 파라미터 수정 |

### 6.3 apps/demo

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/wagmi.ts` | `CONTRACTS`, `TOKENS` 제거 가능 |
| `src/app/api/payments/create/route.ts` | 새 API 형식 사용 |

---

## 7. 구현 파일 목록

| 순서 | 파일 | 작업 |
|------|------|------|
| 1 | `docs/specs/SPEC-API-002.md` | 이 SPEC 문서 |
| 2 | `packages/server/src/config/chains.ts` | 신규 생성 |
| 3 | `packages/server/src/routes/payments/create.ts` | 수정 |
| 4 | `packages/sdk/src/types.ts` | 타입 정의 수정 |
| 5 | `packages/sdk/src/client.ts` | createPayment 메서드 수정 |
| 6 | `docs/api/payments.md` | API 문서 업데이트 |

---

## 8. 향후 확장 (Phase 2)

### 8.1 환율 변환 지원

향후 USD → 토큰 환율 변환 기능 추가 시:

```typescript
// Request
{
  "amount": 10,
  "fiatCurrency": "USD",     // 법정화폐
  "paymentToken": "SUT",     // 결제할 토큰
  "chainId": 80002
}

// Response
{
  "fiatAmount": 10,
  "tokenAmount": "15.5",     // 환율 적용된 토큰 수량
  "exchangeRate": "1.55",    // 1 USD = 1.55 SUT
  "amount": "15500000...",   // wei 단위
  ...
}
```

### 8.2 다중 토큰 결제

하나의 결제에서 여러 토큰 옵션 제공:

```typescript
// Response에 가능한 토큰 목록 포함
{
  "paymentId": "pay_123",
  "availableTokens": [
    { "symbol": "SUT", "tokenAddress": "0x...", "amount": "100..." },
    { "symbol": "MSQ", "tokenAddress": "0x...", "amount": "50..." }
  ]
}
```

---

## 9. 참조 문서

- [기존 결제 API 문서](../api/payments.md)
- [기술 스펙](../technical-spec.md)
- [아키텍처 문서](../architecture.md)
