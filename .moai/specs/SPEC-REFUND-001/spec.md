---
id: SPEC-REFUND-001
title: SoloPay 환불 기능 (Refund Feature)
category: feature
status: in-progress
created_at: 2025-01-30
updated_at: 2026-02-06
author: @user
tags:
  - backend
  - blockchain
  - smart-contract
  - refund
  - gasless-transaction
---

# SPEC-REFUND-001: SoloPay 환불 기능 (Refund Feature)

## 1. 개요 (Overview)

### 1.1 목적 (Purpose)

SoloPay 결제 시스템에 환불 기능을 추가합니다. 머천트가 완료된 결제에 대해 환불을 요청하면, Relayer를 통한 gasless 트랜잭션으로 원래 payer에게 토큰을 반환합니다.

### 1.2 범위 (Scope)

**포함 사항**:

- PaymentGatewayV1 컨트랙트에 refund() 함수 추가
- Refund 독립 테이블 및 리소스 설계
- 환불 API 엔드포인트 (POST /refunds, GET /refunds/:id, GET /refunds)
- 환불용 EIP-712 서버 서명 생성
- Relayer를 통한 gasless 환불 실행
- 환불 상태 추적 및 조회

**제외 사항**:

- 부분 환불 (V2에서 구현 예정)
- 수수료 반환 (환불 시 수수료는 머천트 부담)
- 환불 사유별 통계/분석

### 1.3 현재 구현 상태 (Current Implementation Status)

**이미 구현됨**:

- payer_address 컬럼 (payments 테이블)
- PaymentCompleted 이벤트 리스닝 및 payer_address 저장 (status.ts)

**구현 필요**:

- refunds 테이블 및 RefundStatus enum
- 스마트 컨트랙트 refund() 함수
- 환불 API 엔드포인트
- RefundCompleted 이벤트 리스너

### 1.4 핵심 설계 결정 (Key Design Decisions)

**환불 흐름**:

```
원본 결제: Payer 100 USDT --> Treasury 1 USDT (fee) + Merchant 99 USDT
환불:      Merchant 100 USDT --> Payer 100 USDT (전액 환불)
결과:      Merchant -1 USDT 손해 (수수료 부담), Treasury fee 유지
```

**설계 근거**:

- 환불은 머천트 책임 (상품/서비스 문제로 인한 환불)
- 수수료는 결제 처리 비용 (이미 제공된 서비스)
- 일반 PG사 운영 방식과 동일

**Refund를 독립 리소스로 설계하는 이유**:

- RESTful API 원칙 준수
- 환불 이력 관리 용이
- 부분 환불 등 향후 확장성 확보
- 머천트 대시보드에서 환불 내역 조회 편의

---

## 2. 데이터 모델 (Data Model)

### 2.1 RefundStatus Enum

```
PENDING    - 환불 요청됨, 트랜잭션 제출 전
SUBMITTED  - Relayer에 트랜잭션 제출됨
CONFIRMED  - 온체인에서 환불 완료 확인됨
FAILED     - 환불 실패 (트랜잭션 revert 또는 타임아웃)
```

### 2.2 Refund 테이블

```
refunds
├── id                  INT AUTO_INCREMENT PRIMARY KEY
├── refund_hash         VARCHAR(66) UNIQUE    -- bytes32, 환불 고유 식별자
├── payment_id          INT NOT NULL          -- FK to payments.id
├── merchant_id         INT NOT NULL          -- FK to merchants.id (denormalized)
├── amount              DECIMAL(65,0)         -- 환불 금액 (wei)
├── token_address       VARCHAR(42)           -- 환불 토큰 주소
├── payer_address       VARCHAR(42)           -- 환불 수령자 (원본 payer)
├── status              ENUM(RefundStatus)    -- PENDING, SUBMITTED, CONFIRMED, FAILED
├── reason              VARCHAR(500)          -- 환불 사유 (optional)
├── tx_hash             VARCHAR(66)           -- 환불 트랜잭션 해시
├── error_message       TEXT                  -- 실패 시 에러 메시지
├── submitted_at        TIMESTAMP             -- Relayer 제출 시간
├── confirmed_at        TIMESTAMP             -- 온체인 확정 시간
├── created_at          TIMESTAMP DEFAULT NOW()
├── updated_at          TIMESTAMP DEFAULT NOW() ON UPDATE
│
├── INDEX idx_payment_id (payment_id)
├── INDEX idx_merchant_id (merchant_id)
├── INDEX idx_status (status)
└── INDEX idx_created_at (created_at)
```

### 2.3 EventType Enum 확장

```
기존: CREATED, STATUS_CHANGED, RELAY_SUBMITTED, RELAY_CONFIRMED, EXPIRED
추가: REFUND_REQUESTED, REFUND_SUBMITTED, REFUND_CONFIRMED, REFUND_FAILED
```

---

## 3. API 명세 (API Specification)

### 3.1 POST /refunds - 환불 요청 생성

**Request**:

```
POST /refunds
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "paymentId": "0x1234...abcd",   // payment_hash (required)
  "reason": "고객 요청"            // 환불 사유 (optional)
}
```

**Response (201 Created)**:

```
{
  "success": true,
  "data": {
    "refundId": "0xabcd...1234",
    "paymentId": "0x1234...abcd",
    "amount": "100000000000000000000",
    "tokenAddress": "0xE4C6...",
    "payerAddress": "0x7bE4...",
    "status": "PENDING",
    "createdAt": "2025-02-06T10:00:00Z"
  }
}
```

**Error Responses**:

- 400 PAYMENT_NOT_CONFIRMED: 결제가 CONFIRMED 상태가 아님
- 400 PAYMENT_ALREADY_REFUNDED: 이미 환불된 결제
- 400 PAYER_ADDRESS_NOT_FOUND: payer 주소가 저장되지 않음
- 400 REFUND_IN_PROGRESS: 이미 환불 진행 중
- 401 Unauthorized: 인증 실패
- 403 Forbidden: 해당 머천트 소유가 아님
- 404 Not Found: 결제 정보 없음

### 3.2 GET /refunds/:refundId - 환불 상태 조회

**Request**:

```
GET /refunds/0xabcd...1234
Authorization: Bearer <api_key>
```

**Response (200 OK)**:

```
{
  "success": true,
  "data": {
    "refundId": "0xabcd...1234",
    "paymentId": "0x1234...abcd",
    "amount": "100000000000000000000",
    "tokenAddress": "0xE4C6...",
    "tokenSymbol": "SUT",
    "tokenDecimals": 18,
    "payerAddress": "0x7bE4...",
    "status": "CONFIRMED",
    "reason": "고객 요청",
    "txHash": "0x9876...fedc",
    "createdAt": "2025-02-06T10:00:00Z",
    "submittedAt": "2025-02-06T10:00:05Z",
    "confirmedAt": "2025-02-06T10:00:30Z"
  }
}
```

### 3.3 GET /refunds - 환불 목록 조회

**Request**:

```
GET /refunds?page=1&limit=20&status=CONFIRMED&paymentId=0x1234...
Authorization: Bearer <api_key>
```

**Query Parameters**:

- page: 페이지 번호 (default: 1)
- limit: 페이지 크기 (default: 20, max: 100)
- status: 상태 필터 (optional)
- paymentId: 결제 ID 필터 (optional)

**Response (200 OK)**:

```
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

---

## 4. 스마트 컨트랙트 변경 (Smart Contract Changes)

### 4.1 상태 변수 추가

```solidity
// 환불된 결제 추적
mapping(bytes32 => bool) public refundedPayments;

// EIP-712 환불 요청 타입해시
bytes32 public constant REFUND_REQUEST_TYPEHASH = keccak256(
    "RefundRequest(bytes32 originalPaymentId,address tokenAddress,uint256 amount,address payerAddress,bytes32 merchantId)"
);
```

### 4.2 refund() 함수

```solidity
function refund(
    bytes32 originalPaymentId,
    address tokenAddress,
    uint256 amount,
    address payerAddress,
    bytes32 merchantId,
    bytes calldata serverSignature
) external nonReentrant {
    // 1. 검증
    require(processedPayments[originalPaymentId], "PG: payment not found");
    require(!refundedPayments[originalPaymentId], "PG: already refunded");
    require(amount > 0, "PG: amount must be > 0");
    require(tokenAddress != address(0), "PG: invalid token");
    require(payerAddress != address(0), "PG: invalid payer");
    require(_verifyRefundSignature(...), "PG: invalid signature");

    // 2. 상태 변경 (reentrancy 방지)
    refundedPayments[originalPaymentId] = true;

    // 3. 토큰 전송: _msgSender()(머천트) --> payerAddress
    address merchantAddress = _msgSender();
    IERC20(tokenAddress).safeTransferFrom(merchantAddress, payerAddress, amount);

    // 4. 이벤트 발생
    emit RefundCompleted(
        originalPaymentId,
        merchantId,
        payerAddress,
        merchantAddress,
        tokenAddress,
        amount,
        block.timestamp
    );
}
```

### 4.3 RefundCompleted 이벤트

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

### 4.4 EIP-712 서명 검증

```solidity
function _verifyRefundSignature(
    bytes32 originalPaymentId,
    address tokenAddress,
    uint256 amount,
    address payerAddress,
    bytes32 merchantId,
    bytes calldata signature
) internal view returns (bool) {
    bytes32 structHash = keccak256(abi.encode(
        REFUND_REQUEST_TYPEHASH,
        originalPaymentId,
        tokenAddress,
        amount,
        payerAddress,
        merchantId
    ));
    bytes32 hash = _hashTypedDataV4(structHash);
    return hash.recover(signature) == signerAddress;
}
```

---

## 5. 환불 처리 플로우 (Refund Processing Flow)

### 5.1 환불 요청 플로우

```
1. 머천트 --> POST /refunds { paymentId }
2. Gateway 검증:
   - 결제 존재 및 CONFIRMED 상태
   - 머천트 소유 확인
   - payer_address 존재
   - 기존 환불 없음
3. refund_hash 생성 (keccak256)
4. Refund 레코드 생성 (status: PENDING)
5. 서버 서명 생성 (EIP-712)
6. Relayer에 트랜잭션 제출
7. Refund 상태 --> SUBMITTED
8. 응답 반환 (201 Created)
```

### 5.2 환불 확정 플로우

```
1. RefundCompleted 이벤트 감지
2. originalPaymentId로 Refund 조회
3. Refund 상태 --> CONFIRMED
4. tx_hash, confirmed_at 저장
5. PaymentEvent 기록 (REFUND_CONFIRMED)
6. 웹훅 발송 (옵션)
```

### 5.3 환불 실패 플로우

```
1. 트랜잭션 revert 또는 타임아웃
2. Refund 상태 --> FAILED
3. error_message 저장
4. PaymentEvent 기록 (REFUND_FAILED)
5. 웹훅 발송 (옵션)
```

---

## 6. 구현 순서 (Implementation Order)

### Phase 1: DB 스키마

- [x] RefundStatus enum 추가 (Prisma schema)
- [x] refunds 테이블 생성 (Prisma schema)
- [x] EventType enum에 환불 관련 타입 추가
- [x] init.sql 동기화

### Phase 2: 스마트 컨트랙트

- [x] refundedPayments mapping 추가
- [x] REFUND_REQUEST_TYPEHASH 추가 (deadline 제거됨)
- [x] _verifyRefundSignature() 함수 구현
- [x] refund() 함수 구현
- [x] RefundCompleted 이벤트 추가
- [x] IPaymentGateway 인터페이스 업데이트
- [x] 컨트랙트 테스트 작성 (34 passing)
- [ ] 테스트넷 배포 (Amoy)

### Phase 3: Gateway API

- [x] RefundService 생성
- [x] 환불용 EIP-712 서명 생성 (SignatureServerService)
- [x] POST /refunds 엔드포인트
- [x] GET /refunds/:id 엔드포인트
- [x] GET /refunds 엔드포인트 (목록)
- [ ] RefundCompleted 이벤트 리스너
- [ ] API 테스트 작성

### Phase 4: 통합 및 문서화

- [x] E2E 테스트 (결제 --> 환불 전체 플로우, 69 passing)
- [ ] gateway-sdk에 환불 메서드 추가
- [ ] API 문서 업데이트 (guide)

---

## 7. 설계 제약사항 (Design Constraints)

**DC-001**: 환불은 전액 환불만 지원한다 (부분 환불 V2에서 구현).

**DC-002**: 환불 시 수수료는 반환하지 않는다 (머천트 부담).

**DC-003**: 하나의 결제에 대해 1회만 환불 가능하다.

**DC-004**: 환불은 CONFIRMED 상태의 결제만 가능하다.

**DC-005**: 머천트가 PaymentGateway에 토큰 approve를 해야 환불이 가능하다.

**DC-006**: 환불 트랜잭션은 Relayer를 통한 gasless로 실행된다.

**DC-007**: 가스비는 Treasury 수익에서 충당한다 (비즈니스 비용).

---

## 8. 수용 기준 (Acceptance Criteria)

### 8.1 기능 수용 기준

**AC-F001**: CONFIRMED 상태의 결제에 대해 환불 요청 시 201 Created와 함께 refundId가 반환된다.

**AC-F002**: CONFIRMED가 아닌 상태의 결제에 대해 환불 요청 시 400 Bad Request가 반환된다.

**AC-F003**: 이미 환불된 결제에 대해 환불 요청 시 400 Bad Request가 반환된다.

**AC-F004**: 다른 머천트의 결제에 대해 환불 요청 시 403 Forbidden이 반환된다.

**AC-F005**: 환불 트랜잭션 확정 후 status가 CONFIRMED로 변경된다.

**AC-F006**: 환불 트랜잭션 확정 후 payer 지갑에 토큰이 입금된다.

**AC-F007**: GET /refunds/:id로 환불 상태를 조회할 수 있다.

**AC-F008**: GET /refunds로 머천트의 환불 목록을 조회할 수 있다.

**AC-F009**: 컨트랙트에서 이중 환불 시도 시 트랜잭션이 revert된다.

**AC-F010**: 잘못된 서버 서명으로 환불 시도 시 트랜잭션이 revert된다.

### 8.2 비기능 수용 기준

**AC-NF001**: 환불 API 응답 시간은 p95 500ms 이하이다.

**AC-NF002**: 환불 관련 테스트 커버리지는 90% 이상이다.

**AC-NF003**: RefundCompleted 이벤트는 30초 이내에 처리된다.

---

## 9. 추적성 매트릭스 (Traceability Matrix)

| 구현 항목 | 관련 파일 | 테스트 파일 |
|----------|----------|-----------|
| RefundStatus, Refund 모델 | schema.prisma, init.sql | - |
| refund() 함수 | PaymentGatewayV1.sol | PaymentGatewayV1.refund.test.ts |
| RefundService | services/refund.service.ts | refund.service.test.ts |
| POST /refunds | routes/refunds/create.ts | refunds.create.test.ts |
| GET /refunds/:id | routes/refunds/status.ts | refunds.status.test.ts |
| GET /refunds | routes/refunds/list.ts | refunds.list.test.ts |
| RefundCompleted 리스너 | listeners/refund-completed.ts | refund-completed.test.ts |

---

## 10. 참조 문서 (References)

- PaymentGatewayV1.sol: 결제 게이트웨이 컨트랙트
- EIP-712: Typed structured data hashing and signing
- ERC-2771: Meta-transactions

---

**문서 종류**: EARS 형식 요구사항 명세서
**상태**: In Progress
**다음 단계**: Phase 2 테스트넷 배포, Phase 3 이벤트 리스너/API 테스트, Phase 4 SDK/문서
