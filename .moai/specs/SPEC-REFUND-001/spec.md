---
id: SPEC-REFUND-001
title: MSQPay 환불 기능 (Refund Feature)
category: feature
status: draft
created_at: 2025-01-30
updated_at: 2025-01-30
author: @user
tags:
  - backend
  - blockchain
  - smart-contract
  - refund
  - gasless-transaction
---

# SPEC-REFUND-001: MSQPay 환불 기능 (Refund Feature)

## 1. 개요 (Overview)

### 1.1 목적 (Purpose)

MSQPay 결제 시스템에 환불 기능을 추가합니다. 머천트가 완료된 결제에 대해 환불을 요청하면, Relayer를 통한 gasless 트랜잭션으로 원래 payer에게 토큰을 반환합니다.

### 1.2 범위 (Scope)

**포함 사항**:
- PaymentGatewayV1 컨트랙트에 refund() 함수 추가
- 결제 시 payer 주소 저장 (DB 스키마 변경)
- PaymentCompleted 이벤트 리스너 서비스
- 환불 API 엔드포인트 (POST /payments/refund)
- 환불용 EIP-712 서버 서명 생성
- Relayer를 통한 gasless 환불 실행
- 환불 상태 추적 및 조회

**제외 사항**:
- 부분 환불 (V2에서 구현 예정)
- 수수료 반환 (환불 시 수수료는 머천트 부담)
- 환불 사유별 통계/분석

### 1.3 용어 정의 (Terminology)

| 용어 | 정의 |
|------|------|
| **originalPaymentId** | 환불 대상이 되는 원본 결제의 paymentId (bytes32) |
| **refundPaymentId** | 환불 트랜잭션의 고유 식별자 (bytes32) |
| **payer** | 원본 결제를 실행한 사용자 지갑 주소 |
| **환불 금액** | 원본 결제 금액 전액 (수수료 포함) |
| **머천트 부담** | 환불 시 수수료 손실은 머천트가 부담 |

### 1.4 핵심 설계 결정 (Key Design Decisions)

**환불 흐름**:
```
원본 결제: Payer 100 USDT → Treasury 1 USDT (fee) + Merchant 99 USDT
환불:      Merchant 100 USDT → Payer 100 USDT (전액 환불)
결과:      Merchant -1 USDT 손해 (수수료 부담), Treasury fee 유지
```

**설계 근거**:
- 환불은 머천트 책임 (상품/서비스 문제로 인한 환불)
- 수수료는 결제 처리 비용 (이미 제공된 서비스)
- 일반 PG사 운영 방식과 동일

---

## 2. EARS 요구사항 명세 (EARS Requirements Specification)

### 2.1 환경 (Environment)

**ENV-001**: 시스템은 PaymentGatewayV1 컨트랙트가 배포된 환경에서 실행되어야 한다.

**ENV-002**: 시스템은 Relayer 서비스가 활성화되어 있어야 한다.

**ENV-003**: 시스템은 다음 환경 변수가 설정되어 있어야 한다:
- `SIGNER_PRIVATE_KEY`: 환불 서명용 서버 개인키
- `RELAY_API_URL`: Relayer 서비스 URL

### 2.2 가정 (Assumptions)

**ASM-001**: 환불 대상 결제는 CONFIRMED 상태여야 한다.

**ASM-002**: 머천트는 환불 금액만큼의 토큰을 보유하고 있어야 한다.

**ASM-003**: 머천트는 PaymentGateway 컨트랙트에 토큰 approve를 완료해야 한다.

**ASM-004**: payer 주소는 결제 확정 시점에 저장되어 있어야 한다.

**ASM-005**: 하나의 결제에 대해 환불은 1회만 가능하다 (전액 환불).

### 2.3 기능 요구사항 (Functional Requirements)

#### 2.3.1 Phase 1: 기반 작업 (Payer 저장 및 이벤트 리스닝)

##### DB 스키마 변경

**REQ-F001**: payments 테이블에 다음 컬럼이 추가되어야 한다:
- `payer_address` (VARCHAR(42), nullable): 결제 실행자 지갑 주소
- `refund_tx_hash` (VARCHAR(66), nullable): 환불 트랜잭션 해시
- `refunded_at` (DATETIME, nullable): 환불 완료 시간

**REQ-F002**: PaymentStatus enum에 `REFUNDED` 상태가 추가되어야 한다.

##### 이벤트 리스너 서비스

**REQ-F003**: 시스템은 PaymentCompleted 이벤트를 실시간 모니터링해야 한다.

**REQ-F004**: PaymentCompleted 이벤트 수신 시 다음을 수행해야 한다:
- 해당 paymentId의 status를 CONFIRMED로 업데이트
- payer_address를 이벤트의 payerAddress로 저장
- tx_hash를 저장

##### Gasless 라우트 수정

**REQ-F005**: POST /payments/gasless 호출 시 forwardRequest.from을 payer_address로 저장해야 한다.

#### 2.3.2 Phase 2: 스마트 컨트랙트 변경

##### 상태 변수 추가

**REQ-F010**: 컨트랙트에 다음 mapping이 추가되어야 한다:
```
mapping(bytes32 => bool) public refundedPayments
```

##### refund() 함수

**REQ-F011**: 시스템은 refund() 함수를 제공해야 한다.

**REQ-F012**: refund() 함수는 다음 파라미터를 받아야 한다:
- `originalPaymentId` (bytes32): 원본 결제 ID
- `tokenAddress` (address): 환불 토큰 주소
- `amount` (uint256): 환불 금액
- `payerAddress` (address): 환불 수령자 (원본 payer)
- `merchantId` (bytes32): 머천트 식별자
- `serverSignature` (bytes): 서버 서명

**REQ-F013**: refund() 함수는 다음을 검증해야 한다:
- processedPayments[originalPaymentId] == true (원본 결제 존재)
- refundedPayments[originalPaymentId] == false (미환불 상태)
- 서버 서명이 유효함

**REQ-F014**: refund() 함수는 검증 통과 시 다음을 수행해야 한다:
- refundedPayments[originalPaymentId] = true
- 토큰 전송: msg.sender → payerAddress (amount)
- RefundCompleted 이벤트 emit

##### RefundCompleted 이벤트

**REQ-F015**: 다음 형식의 이벤트를 정의해야 한다:
```
event RefundCompleted(
  bytes32 indexed originalPaymentId,
  bytes32 indexed merchantId,
  address indexed payerAddress,
  address merchantAddress,
  address tokenAddress,
  uint256 amount,
  uint256 timestamp
)
```

#### 2.3.3 Phase 3: 서버 API

##### 환불 서명 생성

**REQ-F020**: SignatureServerService에 환불용 EIP-712 서명 생성 기능을 추가해야 한다.

**REQ-F021**: 환불 서명은 다음 필드를 포함해야 한다:
- originalPaymentId
- tokenAddress
- amount
- payerAddress
- merchantId
- deadline

##### 환불 API 엔드포인트

**REQ-F022**: 시스템은 POST /payments/refund 엔드포인트를 제공해야 한다.

**REQ-F023**: 환불 요청은 API Key 인증이 필요하다 (머천트만 가능).

**REQ-F024**: 환불 요청은 다음 필드를 포함해야 한다:
- `paymentId` (string, required): 환불 대상 결제 ID
- `reason` (string, optional): 환불 사유

**REQ-F025**: 시스템은 환불 요청 시 다음을 검증해야 한다:
- 해당 결제가 존재하는지
- 결제 상태가 CONFIRMED인지
- 해당 머천트 소유의 결제인지
- 이미 환불되지 않았는지 (refunded_at == null)
- payer_address가 저장되어 있는지

**REQ-F026**: 검증 통과 시 다음을 수행해야 한다:
- 환불용 서버 서명 생성
- Relayer에 환불 트랜잭션 제출
- 응답 반환: success, originalPaymentId, status, serverSignature

**REQ-F027**: 환불 트랜잭션 확정 시 다음을 수행해야 한다:
- status를 REFUNDED로 업데이트
- refund_tx_hash 저장
- refunded_at 저장

##### 환불 상태 조회

**REQ-F028**: GET /payments/:id 응답에 환불 정보가 포함되어야 한다:
- refund_tx_hash (환불된 경우)
- refunded_at (환불된 경우)

#### 2.3.4 Phase 4: 머천트 Approve

**REQ-F030**: 머천트는 PaymentGateway 컨트랙트에 토큰 approve가 필요하다.

**REQ-F031**: 시스템은 GET /merchants/allowance API를 제공하여 현재 approve 상태를 조회할 수 있어야 한다.

### 2.4 비기능 요구사항 (Non-Functional Requirements)

#### 2.4.1 성능 (Performance)

**REQ-NF001**: 환불 API 응답 시간은 p95 500ms 이하여야 한다.

**REQ-NF002**: 이벤트 리스너는 PaymentCompleted 이벤트를 30초 이내에 처리해야 한다.

#### 2.4.2 보안 (Security)

**REQ-NF003**: 환불은 해당 결제의 머천트만 요청 가능해야 한다.

**REQ-NF004**: 서버 서명 없이는 컨트랙트에서 환불이 불가능해야 한다.

**REQ-NF005**: 이중 환불이 불가능해야 한다 (컨트랙트 + DB 양쪽에서 방지).

#### 2.4.3 신뢰성 (Reliability)

**REQ-NF006**: 환불 트랜잭션 실패 시 DB 상태는 롤백되어야 한다.

**REQ-NF007**: 이벤트 리스너 장애 시 누락된 이벤트를 복구할 수 있어야 한다.

#### 2.4.4 테스트 가능성 (Testability)

**REQ-NF008**: 환불 기능은 90% 이상의 테스트 커버리지를 달성해야 한다.

**REQ-NF009**: 컨트랙트 환불 기능은 단위 테스트로 검증되어야 한다.

---

## 3. 인터페이스 명세 (Interface Specifications)

### 3.1 API 엔드포인트

#### 3.1.1 POST /payments/refund

**Request**:
```typescript
{
  paymentId: string;   // 환불 대상 결제 ID (payment_hash)
  reason?: string;     // 환불 사유 (optional)
}
```

**Response (200 OK)**:
```typescript
{
  success: true;
  originalPaymentId: string;
  payerAddress: string;
  amount: string;
  tokenAddress: string;
  status: "REFUND_PENDING";
  serverSignature: string;
}
```

**Error Responses**:
- 400 Bad Request: 검증 실패
  - PAYMENT_NOT_CONFIRMED: 결제가 CONFIRMED 상태가 아님
  - PAYMENT_ALREADY_REFUNDED: 이미 환불된 결제
  - PAYER_ADDRESS_NOT_FOUND: payer 주소가 저장되지 않음
- 401 Unauthorized: 인증 실패
- 403 Forbidden: 해당 머천트 소유가 아님
- 404 Not Found: 결제 정보 없음
- 500 Internal Server Error: 서버 오류

#### 3.1.2 GET /merchants/allowance

**Query Parameters**:
- `tokenAddress` (required): 확인할 토큰 주소

**Response (200 OK)**:
```typescript
{
  merchantAddress: string;
  tokenAddress: string;
  allowance: string;        // 현재 approve된 금액
  isApproved: boolean;      // unlimited approve 여부
}
```

### 3.2 데이터베이스 스키마 변경

#### payments 테이블 컬럼 추가

```sql
ALTER TABLE payments ADD COLUMN payer_address VARCHAR(42);
ALTER TABLE payments ADD COLUMN refund_tx_hash VARCHAR(66);
ALTER TABLE payments ADD COLUMN refunded_at TIMESTAMP;

CREATE INDEX idx_payments_payer_address ON payments(payer_address);
CREATE INDEX idx_payments_refunded_at ON payments(refunded_at);
```

#### PaymentStatus enum 확장

```sql
-- 기존: CREATED, PENDING, CONFIRMED, FAILED, EXPIRED
-- 추가: REFUNDED
ALTER TYPE payment_status ADD VALUE 'REFUNDED';
```

### 3.3 스마트 컨트랙트 인터페이스

#### refund() 함수

```solidity
function refund(
    bytes32 originalPaymentId,
    address tokenAddress,
    uint256 amount,
    address payerAddress,
    bytes32 merchantId,
    bytes calldata serverSignature
) external nonReentrant;
```

#### RefundCompleted 이벤트

```solidity
event RefundCompleted(
    bytes32 indexed originalPaymentId,
    bytes32 indexed merchantId,
    address indexed payerAddress,
    address merchantAddress,
    address tokenAddress,
    uint256 amount,
    uint256 timestamp
);
```

#### EIP-712 환불 서명 타입

```typescript
const REFUND_TYPE = {
  Refund: [
    { name: 'originalPaymentId', type: 'bytes32' },
    { name: 'tokenAddress', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'payerAddress', type: 'address' },
    { name: 'merchantId', type: 'bytes32' },
    { name: 'deadline', type: 'uint256' }
  ]
};
```

---

## 4. 설계 제약사항 (Design Constraints)

**DC-001**: 환불은 전액 환불만 지원한다 (부분 환불 V2에서 구현).

**DC-002**: 환불 시 수수료는 반환하지 않는다 (머천트 부담).

**DC-003**: 하나의 결제에 대해 1회만 환불 가능하다.

**DC-004**: 환불은 CONFIRMED 상태의 결제만 가능하다.

**DC-005**: 머천트가 PaymentGateway에 토큰 approve를 해야 환불이 가능하다.

**DC-006**: 환불 트랜잭션도 Relayer를 통한 gasless로 실행된다.

**DC-007**: 가스비는 Treasury 수익에서 충당한다 (비즈니스 비용).

---

## 5. 수용 기준 (Acceptance Criteria)

### 5.1 기능 수용 기준

**AC-F001**: CONFIRMED 상태의 결제에 대해 환불 요청 시 200 OK 응답과 함께 serverSignature가 반환된다.

**AC-F002**: CONFIRMED가 아닌 상태의 결제에 대해 환불 요청 시 400 Bad Request가 반환된다.

**AC-F003**: 이미 환불된 결제에 대해 환불 요청 시 400 Bad Request가 반환된다.

**AC-F004**: 다른 머천트의 결제에 대해 환불 요청 시 403 Forbidden이 반환된다.

**AC-F005**: 환불 트랜잭션 확정 후 status가 REFUNDED로 변경된다.

**AC-F006**: 환불 트랜잭션 확정 후 payer 지갑에 토큰이 입금된다.

**AC-F007**: PaymentCompleted 이벤트 수신 시 payer_address가 저장된다.

**AC-F008**: 컨트랙트에서 이중 환불 시도 시 트랜잭션이 revert된다.

**AC-F009**: 잘못된 서버 서명으로 환불 시도 시 트랜잭션이 revert된다.

### 5.2 비기능 수용 기준

**AC-NF001**: 환불 API 응답 시간은 p95 500ms 이하이다.

**AC-NF002**: 환불 관련 테스트 커버리지는 90% 이상이다.

**AC-NF003**: 이벤트 리스너는 30초 이내에 이벤트를 처리한다.

---

## 6. 구현 순서 (Implementation Order)

### Phase 1: 기반 작업
1. DB 스키마 마이그레이션 (payer_address, refund 컬럼)
2. PaymentCompleted 이벤트 리스너 서비스 구현
3. /payments/gasless 라우트에서 payer 저장

### Phase 2: 컨트랙트 변경
4. refundedPayments mapping 추가
5. refund() 함수 구현
6. RefundCompleted 이벤트 추가
7. 컨트랙트 테스트 작성

### Phase 3: 서버 API
8. 환불용 EIP-712 서명 생성 (SignatureServerService)
9. POST /payments/refund 엔드포인트 구현
10. Relayer 연동 (gasless 환불)
11. 환불 상태 업데이트 로직

### Phase 4: 머천트 Approve
12. GET /merchants/allowance API 구현
13. 머천트 가이드 문서 작성

---

## 7. 추적성 (Traceability)

| 요구사항 ID | 관련 파일 | 테스트 파일 |
|------------|----------|-----------|
| REQ-F001-F002 | `schema.prisma`, `init.sql` | - |
| REQ-F003-F004 | `event-listener.service.ts` | `event-listener.test.ts` |
| REQ-F005 | `routes/payments/gasless.ts` | `gasless.test.ts` |
| REQ-F010-F015 | `PaymentGatewayV1.sol` | `PaymentGatewayV1.test.ts` |
| REQ-F020-F021 | `signature-server.service.ts` | `signature-server.test.ts` |
| REQ-F022-F027 | `routes/payments/refund.ts` | `refund.test.ts` |
| REQ-F030-F031 | `routes/merchants/allowance.ts` | `allowance.test.ts` |

---

## 8. 참조 문서 (References)

- SPEC-SERVER-002: MSQPay 결제 서버
- SPEC-RELAY-001: Simple Relayer 서비스
- PaymentGatewayV1.sol: 결제 게이트웨이 컨트랙트
- EIP-712: Typed structured data hashing and signing

---

**문서 종류**: EARS 형식 요구사항 명세서
**작성 도구**: MoAI-ADK workflow-spec
**준수 프레임워크**: TRUST 5, SPEC-First TDD
