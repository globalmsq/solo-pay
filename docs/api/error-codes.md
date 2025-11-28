# MSQPay API 에러 코드 레퍼런스

## 개요

MSQPay Payment Server는 Self-Descriptive 에러 코드 체계를 사용하여 명확하고 일관성 있는 에러 응답을 제공합니다. 이 문서는 모든 에러 코드와 처리 방법을 설명합니다.

### 에러 코드 명명 규칙

에러 코드는 다음 패턴을 따릅니다:

```
[DOMAIN]_[ENTITY]_[ISSUE]
```

**예시**:
- `PAYMENT_STORE_INVALID_ADDRESS` - 결제 도메인의 상점 주소 검증 오류
- `SIGNATURE_INVALID` - 서명 도메인의 검증 실패
- `DATABASE_CONNECTION_FAILED` - 데이터베이스 연결 실패

### 에러 응답 구조

MSQPay는 GitHub API와 Stripe 스타일을 결합한 에러 응답 형식을 사용합니다:

```typescript
{
  error: {
    type: string;        // 에러 타입 (예: "validation_error", "authentication_error")
    code: string;        // Self-descriptive 에러 코드 (예: "PAYMENT_STORE_INVALID_ADDRESS")
    message: string;     // 사용자 친화적 메시지
    field?: string;      // 문제가 발생한 필드 (선택적)
    value?: any;         // 실제 입력값 (디버깅용, 선택적)
    docs_url?: string;   // 문서 링크 (선택적)
  }
}
```

### HTTP 상태 코드 매핑

| HTTP 상태 | 에러 타입 | 설명 |
|-----------|----------|------|
| 400 | validation_error | 입력 검증 실패 |
| 400 | state_error | 잘못된 상태 전환 시도 |
| 401 | authentication_error | 인증 실패 (서명 검증 실패) |
| 404 | not_found_error | 리소스를 찾을 수 없음 |
| 410 | expired_error | 리소스가 만료됨 |
| 429 | rate_limit_error | Rate Limiting 초과 |
| 500 | internal_error | 내부 서버 오류 |
| 503 | service_unavailable_error | 서비스 불가 (외부 의존성 오류) |

---

## 에러 타입

### 1. validation_error (HTTP 400)

입력 데이터 검증 실패 시 발생하는 에러입니다.

**특징**:
- 클라이언트가 잘못된 데이터를 전송했을 때 발생
- `field`와 `value` 필드를 통해 구체적인 문제점 제공
- 재시도 전에 입력 데이터를 수정해야 함

**관련 에러 코드**:
- `PAYMENT_STORE_INVALID_ADDRESS`
- `PAYMENT_TOKEN_INVALID_ADDRESS`
- `PAYMENT_AMOUNT_INVALID_ZERO`

### 2. authentication_error (HTTP 401)

인증 및 서명 검증 실패 시 발생하는 에러입니다.

**특징**:
- EIP-712 서명 검증 실패
- 서명자 주소 불일치
- 재시도 전에 올바른 서명을 생성해야 함

**관련 에러 코드**:
- `SIGNATURE_INVALID`
- `SIGNATURE_SIGNER_MISMATCH`

### 3. not_found_error (HTTP 404)

요청한 리소스를 찾을 수 없을 때 발생하는 에러입니다.

**특징**:
- 존재하지 않는 paymentId 조회
- 재시도해도 동일한 결과 (리소스가 실제로 없음)

**관련 에러 코드**:
- `PAYMENT_NOT_FOUND`

### 4. state_error (HTTP 400)

잘못된 상태 전환 시도 시 발생하는 에러입니다.

**특징**:
- 이미 처리된 결제 재실행 시도
- 비즈니스 로직 위반
- 결제 상태를 확인한 후 적절한 조치 필요

**관련 에러 코드**:
- `PAYMENT_ALREADY_PROCESSED`

### 5. expired_error (HTTP 410)

리소스가 만료되었을 때 발생하는 에러입니다.

**특징**:
- 결제 만료 시간(15분) 초과
- 재시도 불가능 (새로운 결제 생성 필요)
- HTTP 410 Gone 상태 코드 사용

**관련 에러 코드**:
- `PAYMENT_EXPIRED`

### 6. rate_limit_error (HTTP 429)

Rate Limiting 제한을 초과했을 때 발생하는 에러입니다.

**특징**:
- IP당 분당 100개 요청 제한 초과
- 일정 시간 후 재시도 필요
- `Retry-After` 헤더 제공 (권장)

**관련 에러 코드**:
- `RATE_LIMIT_EXCEEDED`

### 7. service_unavailable_error (HTTP 503)

외부 의존성 서비스 오류 시 발생하는 에러입니다.

**특징**:
- 데이터베이스, Redis, 블록체인 RPC, OZ Defender 등 외부 서비스 장애
- 일시적 오류이므로 재시도 가능 (Exponential Backoff 권장)

**관련 에러 코드**:
- `DATABASE_CONNECTION_FAILED`
- `REDIS_CONNECTION_FAILED`
- `BLOCKCHAIN_RPC_ERROR`
- `DEFENDER_API_ERROR`
- `GASLESS_LIMIT_EXCEEDED`

### 8. internal_error (HTTP 500)

예상치 못한 내부 서버 오류입니다.

**특징**:
- 서버 측 버그 또는 예외 상황
- 재시도 가능하나 문제가 지속되면 지원팀 문의 필요

**관련 에러 코드**:
- `INTERNAL_SERVER_ERROR`

---

## 에러 코드 전체 목록

### 1. PAYMENT_STORE_INVALID_ADDRESS

**HTTP 상태**: 400 Bad Request
**에러 타입**: validation_error
**설명**: 상점 주소 형식이 유효하지 않습니다.

**원인**:
- `storeAddress` 필드가 유효한 Ethereum 주소 형식 (0x로 시작하는 42자리 16진수)이 아님
- 빈 문자열 또는 null 값 전달

**해결 방법**:
1. 주소가 `0x`로 시작하는지 확인
2. 총 길이가 42자(0x + 40자리 16진수)인지 확인
3. 유효한 checksum 주소 사용 (web3.js, ethers.js, viem 활용)

**예시**:
```typescript
// ❌ 잘못된 예시
{
  "storeAddress": "invalid-address",
  "tokenAddress": "0x1234...",
  "amount": "1000000000000000000"
}

// ✅ 올바른 예시
{
  "storeAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
  "tokenAddress": "0x1234567890abcdef1234567890abcdef12345678",
  "amount": "1000000000000000000"
}
```

**응답 예시**:
```json
{
  "error": {
    "type": "validation_error",
    "code": "PAYMENT_STORE_INVALID_ADDRESS",
    "message": "Store address must be a valid Ethereum address",
    "field": "storeAddress",
    "value": "invalid-address"
  }
}
```

---

### 2. PAYMENT_TOKEN_INVALID_ADDRESS

**HTTP 상태**: 400 Bad Request
**에러 타입**: validation_error
**설명**: 토큰 주소 형식이 유효하지 않습니다.

**원인**:
- `tokenAddress` 필드가 유효한 Ethereum 주소 형식이 아님
- ERC-20 토큰 주소가 아닌 다른 값 전달

**해결 방법**:
1. 유효한 ERC-20 토큰 주소 사용
2. Polygon Amoy Testnet에서 배포된 토큰 주소 확인
3. 주소 형식 검증 (checksum 주소 권장)

**예시**:
```typescript
// ❌ 잘못된 예시
{
  "storeAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
  "tokenAddress": "0xinvalid",
  "amount": "1000000000000000000"
}

// ✅ 올바른 예시
{
  "storeAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
  "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "amount": "1000000000000000000"
}
```

**응답 예시**:
```json
{
  "error": {
    "type": "validation_error",
    "code": "PAYMENT_TOKEN_INVALID_ADDRESS",
    "message": "Token address must be a valid Ethereum address",
    "field": "tokenAddress",
    "value": "0xinvalid"
  }
}
```

---

### 3. PAYMENT_AMOUNT_INVALID_ZERO

**HTTP 상태**: 400 Bad Request
**에러 타입**: validation_error
**설명**: 결제 금액이 0이거나 음수입니다.

**원인**:
- `amount` 필드가 "0" 또는 음수 값
- Wei 단위 금액 계산 오류

**해결 방법**:
1. 양수 금액 전달 (amount > 0)
2. Wei 단위 금액 계산 정확성 확인
3. 최소 결제 금액 확인 (프로젝트 정책에 따라)

**예시**:
```typescript
// ❌ 잘못된 예시
{
  "storeAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
  "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "amount": "0"
}

// ✅ 올바른 예시 (1 USDT = 10^6 wei, 6 decimals)
{
  "storeAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
  "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "amount": "1000000"
}

// ✅ 올바른 예시 (1 ETH = 10^18 wei, 18 decimals)
{
  "storeAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
  "tokenAddress": "0x0000000000000000000000000000000000000000",
  "amount": "1000000000000000000"
}
```

**응답 예시**:
```json
{
  "error": {
    "type": "validation_error",
    "code": "PAYMENT_AMOUNT_INVALID_ZERO",
    "message": "Payment amount must be greater than zero",
    "field": "amount",
    "value": "0"
  }
}
```

---

### 4. SIGNATURE_INVALID

**HTTP 상태**: 401 Unauthorized
**에러 타입**: authentication_error
**설명**: EIP-712 서명 검증에 실패했습니다.

**원인**:
- 잘못된 EIP-712 서명 형식
- 서명 생성 시 잘못된 도메인 또는 타입 정의 사용
- 서명 메시지와 실제 결제 데이터 불일치

**해결 방법**:
1. 올바른 EIP-712 도메인 정의 사용:
   ```typescript
   const domain = {
     name: 'MSQPay',
     version: '1',
     chainId: 80002, // Polygon Amoy
     verifyingContract: PAYMENT_PROCESSOR_ADDRESS
   };
   ```

2. 올바른 타입 정의 사용:
   ```typescript
   const types = {
     Payment: [
       { name: 'paymentId', type: 'string' },
       { name: 'storeAddress', type: 'address' },
       { name: 'tokenAddress', type: 'address' },
       { name: 'amount', type: 'uint256' },
       { name: 'customerAddress', type: 'address' }
     ]
   };
   ```

3. 서명 생성 예시 (ethers.js v6):
   ```typescript
   const signature = await signer.signTypedData(domain, types, {
     paymentId: "uuid-v4-payment-id",
     storeAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
     tokenAddress: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
     amount: "1000000",
     customerAddress: "0xcustomer..."
   });
   ```

**응답 예시**:
```json
{
  "error": {
    "type": "authentication_error",
    "code": "SIGNATURE_INVALID",
    "message": "Invalid EIP-712 signature",
    "docs_url": "https://docs.msqpay.com/api/error-codes#signature_invalid"
  }
}
```

---

### 5. SIGNATURE_SIGNER_MISMATCH

**HTTP 상태**: 401 Unauthorized
**에러 타입**: authentication_error
**설명**: 서명자 주소가 customerAddress와 일치하지 않습니다.

**원인**:
- 서명을 생성한 지갑 주소와 요청의 `customerAddress`가 다름
- 다른 사람의 서명을 도용하려는 시도

**해결 방법**:
1. 서명 생성 시 사용한 지갑 주소를 `customerAddress`로 전달
2. 올바른 지갑으로 서명 재생성

**예시**:
```typescript
// ❌ 잘못된 예시
const signer = wallet1; // 0xaaa...
const signature = await signer.signTypedData(domain, types, message);

await executePayment(paymentId, {
  customerAddress: "0xbbb...", // 다른 주소
  signature
});

// ✅ 올바른 예시
const signer = wallet1; // 0xaaa...
const signature = await signer.signTypedData(domain, types, message);

await executePayment(paymentId, {
  customerAddress: await signer.getAddress(), // 0xaaa...
  signature
});
```

**응답 예시**:
```json
{
  "error": {
    "type": "authentication_error",
    "code": "SIGNATURE_SIGNER_MISMATCH",
    "message": "Signature signer does not match customer address",
    "field": "customerAddress",
    "docs_url": "https://docs.msqpay.com/api/error-codes#signature_signer_mismatch"
  }
}
```

---

### 6. PAYMENT_NOT_FOUND

**HTTP 상태**: 404 Not Found
**에러 타입**: not_found_error
**설명**: 요청한 결제 정보를 찾을 수 없습니다.

**원인**:
- 존재하지 않는 `paymentId` 조회
- 잘못된 UUID 형식 전달
- 삭제되거나 만료된 결제 (데이터베이스에서 제거됨)

**해결 방법**:
1. 올바른 `paymentId` 사용 (결제 생성 시 반환된 UUID)
2. UUID 형식 확인 (예: `123e4567-e89b-12d3-a456-426614174000`)
3. 결제 생성 API를 통해 새로운 결제 생성

**응답 예시**:
```json
{
  "error": {
    "type": "not_found_error",
    "code": "PAYMENT_NOT_FOUND",
    "message": "Payment not found",
    "field": "paymentId",
    "value": "invalid-uuid"
  }
}
```

---

### 7. PAYMENT_ALREADY_PROCESSED

**HTTP 상태**: 400 Bad Request
**에러 타입**: state_error
**설명**: 이미 처리된 결제를 다시 실행하려고 시도했습니다.

**원인**:
- 결제 상태가 "pending"이 아님 (processing, completed, failed)
- 동일한 결제를 중복 실행 시도
- 상태 전환 로직 오류

**해결 방법**:
1. 결제 조회 API로 현재 상태 확인:
   ```bash
   GET /api/payments/:paymentId
   ```

2. 상태별 조치:
   - `processing`: 트랜잭션 확인 대기
   - `completed`: 결제 완료, 추가 조치 불필요
   - `failed`: 새로운 결제 생성 필요
   - `expired`: 새로운 결제 생성 필요

**응답 예시**:
```json
{
  "error": {
    "type": "state_error",
    "code": "PAYMENT_ALREADY_PROCESSED",
    "message": "Payment has already been processed",
    "field": "status",
    "value": "completed"
  }
}
```

---

### 8. PAYMENT_EXPIRED

**HTTP 상태**: 410 Gone
**에러 타입**: expired_error
**설명**: 결제가 만료되었습니다 (생성 후 15분 경과).

**원인**:
- 결제 생성 시간 + 15분 초과
- 사용자가 결제 실행을 너무 늦게 시도

**해결 방법**:
1. 새로운 결제 생성 (POST /api/payments)
2. 15분 내에 결제 실행 완료
3. 프론트엔드에서 만료 시간 타이머 표시 권장

**예시**:
```typescript
// 결제 생성
const payment = await createPayment({
  storeAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
  tokenAddress: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  amount: "1000000"
});

// expiresAt: 생성 시간 + 15분 (Unix timestamp)
console.log("Expires at:", new Date(payment.expiresAt * 1000));

// 15분 내에 실행해야 함
if (Date.now() / 1000 < payment.expiresAt) {
  await executePayment(payment.paymentId, { customerAddress, signature });
} else {
  // 만료되었으므로 새로운 결제 생성
  const newPayment = await createPayment({...});
}
```

**응답 예시**:
```json
{
  "error": {
    "type": "expired_error",
    "code": "PAYMENT_EXPIRED",
    "message": "Payment has expired. Please create a new payment.",
    "field": "expiresAt",
    "value": 1732785600
  }
}
```

---

### 9. RATE_LIMIT_EXCEEDED

**HTTP 상태**: 429 Too Many Requests
**에러 타입**: rate_limit_error
**설명**: Rate Limiting 제한을 초과했습니다.

**원인**:
- 동일 IP에서 분당 100개 초과 요청
- 과도한 API 호출

**해결 방법**:
1. 요청 빈도 감소 (최대 분당 100개)
2. 일정 시간 대기 후 재시도 (Exponential Backoff)
3. `Retry-After` 헤더 확인 (있는 경우)

**재시도 전략** (Exponential Backoff):
```typescript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.status === 429) {
        const retryAfter = error.headers['retry-after'];
        const delay = retryAfter
          ? parseInt(retryAfter) * 1000
          : Math.pow(2, i) * 1000; // 1s, 2s, 4s

        console.log(`Rate limited. Retrying after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
}

// 사용 예시
await retryWithBackoff(() => createPayment({ ... }));
```

**응답 예시**:
```json
{
  "error": {
    "type": "rate_limit_error",
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Maximum 100 requests per minute.",
    "docs_url": "https://docs.msqpay.com/api/rate-limits"
  }
}
```

---

### 10. DATABASE_CONNECTION_FAILED

**HTTP 상태**: 503 Service Unavailable
**에러 타입**: service_unavailable_error
**설명**: MySQL 데이터베이스 연결에 실패했습니다.

**원인**:
- MySQL 서버 다운
- 네트워크 연결 문제
- 데이터베이스 연결 풀 고갈
- 잘못된 데이터베이스 자격 증명

**해결 방법**:
1. 일시적 오류이므로 재시도 (Exponential Backoff)
2. 서버 상태 페이지 확인 (https://status.msqpay.com)
3. 문제가 지속되면 지원팀 문의

**응답 예시**:
```json
{
  "error": {
    "type": "service_unavailable_error",
    "code": "DATABASE_CONNECTION_FAILED",
    "message": "Database connection failed. Please try again later.",
    "docs_url": "https://status.msqpay.com"
  }
}
```

---

### 11. REDIS_CONNECTION_FAILED

**HTTP 상태**: 503 Service Unavailable
**에러 타입**: service_unavailable_error
**설명**: Redis 캐시 서버 연결에 실패했습니다.

**원인**:
- Redis 서버 다운
- 네트워크 연결 문제
- Redis 메모리 부족

**해결 방법**:
1. 일시적 오류이므로 재시도
2. Redis 캐시는 선택적이므로 기능은 계속 작동 (성능 저하 가능)

**응답 예시**:
```json
{
  "error": {
    "type": "service_unavailable_error",
    "code": "REDIS_CONNECTION_FAILED",
    "message": "Redis connection failed. Service may experience degraded performance.",
    "docs_url": "https://status.msqpay.com"
  }
}
```

---

### 12. BLOCKCHAIN_RPC_ERROR

**HTTP 상태**: 503 Service Unavailable
**에러 타입**: service_unavailable_error
**설명**: 블록체인 RPC 노드 연결에 실패했습니다.

**원인**:
- Polygon Amoy RPC 노드 다운
- 네트워크 혼잡
- RPC 요청 제한 초과

**해결 방법**:
1. 일시적 오류이므로 재시도 (Exponential Backoff)
2. 블록체인 네트워크 상태 확인 (https://amoy.polygonscan.com/)
3. 문제가 지속되면 지원팀 문의

**응답 예시**:
```json
{
  "error": {
    "type": "service_unavailable_error",
    "code": "BLOCKCHAIN_RPC_ERROR",
    "message": "Blockchain RPC error. Please try again later.",
    "docs_url": "https://amoy.polygonscan.com/"
  }
}
```

---

### 13. DEFENDER_API_ERROR

**HTTP 상태**: 503 Service Unavailable
**에러 타입**: service_unavailable_error
**설명**: OpenZeppelin Defender API 호출에 실패했습니다.

**원인**:
- OZ Defender 서비스 다운
- Relayer 잔액 부족 (MATIC 부족)
- API 키 만료 또는 권한 문제

**해결 방법**:
1. 일시적 오류이므로 재시도
2. OZ Defender 상태 확인 (https://defender.openzeppelin.com/v2/#/status)
3. Relayer MATIC 잔액 확인
4. 문제가 지속되면 지원팀 문의

**응답 예시**:
```json
{
  "error": {
    "type": "service_unavailable_error",
    "code": "DEFENDER_API_ERROR",
    "message": "OpenZeppelin Defender API error. Please try again later.",
    "docs_url": "https://defender.openzeppelin.com/v2/#/status"
  }
}
```

---

### 14. GASLESS_LIMIT_EXCEEDED

**HTTP 상태**: 503 Service Unavailable
**에러 타입**: service_unavailable_error
**설명**: 동시 Gasless 트랜잭션 제한(10개)을 초과했습니다.

**원인**:
- 이미 10개의 Gasless 트랜잭션이 처리 중
- OZ Defender Relayer 제한

**해결 방법**:
1. 잠시 후 재시도 (일부 트랜잭션이 완료되면 가능)
2. 트래픽이 적은 시간대에 재시도
3. Direct Payment 방식 사용 고려 (사용자가 직접 가스비 지불)

**응답 예시**:
```json
{
  "error": {
    "type": "service_unavailable_error",
    "code": "GASLESS_LIMIT_EXCEEDED",
    "message": "Gasless transaction limit exceeded. Please try again later or use direct payment.",
    "docs_url": "https://docs.msqpay.com/api/gasless-payments"
  }
}
```

---

### 15. INTERNAL_SERVER_ERROR

**HTTP 상태**: 500 Internal Server Error
**에러 타입**: internal_error
**설명**: 예상치 못한 내부 서버 오류가 발생했습니다.

**원인**:
- 서버 측 버그
- 예외 처리되지 않은 오류
- 시스템 리소스 부족

**해결 방법**:
1. 일시적 오류일 수 있으므로 재시도
2. 문제가 지속되면 지원팀에 오류 ID와 함께 문의
3. 가능한 경우 요청 내용 및 타임스탬프 기록

**응답 예시**:
```json
{
  "error": {
    "type": "internal_error",
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred. Please contact support with error ID.",
    "error_id": "err_1234567890abcdef",
    "docs_url": "https://support.msqpay.com"
  }
}
```

---

## 에러 응답 예시

### validation_error 예시

```bash
curl -X POST https://api.msqpay.com/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "storeAddress": "invalid",
    "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "amount": "1000000"
  }'
```

**응답 (HTTP 400)**:
```json
{
  "error": {
    "type": "validation_error",
    "code": "PAYMENT_STORE_INVALID_ADDRESS",
    "message": "Store address must be a valid Ethereum address",
    "field": "storeAddress",
    "value": "invalid"
  }
}
```

---

### authentication_error 예시

```bash
curl -X POST https://api.msqpay.com/api/payments/123e4567-e89b-12d3-a456-426614174000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "customerAddress": "0xCustomer...",
    "signature": "0xinvalid_signature"
  }'
```

**응답 (HTTP 401)**:
```json
{
  "error": {
    "type": "authentication_error",
    "code": "SIGNATURE_INVALID",
    "message": "Invalid EIP-712 signature",
    "docs_url": "https://docs.msqpay.com/api/error-codes#signature_invalid"
  }
}
```

---

### not_found_error 예시

```bash
curl https://api.msqpay.com/api/payments/nonexistent-uuid
```

**응답 (HTTP 404)**:
```json
{
  "error": {
    "type": "not_found_error",
    "code": "PAYMENT_NOT_FOUND",
    "message": "Payment not found",
    "field": "paymentId",
    "value": "nonexistent-uuid"
  }
}
```

---

### state_error 예시

```bash
curl -X POST https://api.msqpay.com/api/payments/123e4567-e89b-12d3-a456-426614174000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "customerAddress": "0xCustomer...",
    "signature": "0x..."
  }'
```

**응답 (HTTP 400)** (이미 completed 상태):
```json
{
  "error": {
    "type": "state_error",
    "code": "PAYMENT_ALREADY_PROCESSED",
    "message": "Payment has already been processed",
    "field": "status",
    "value": "completed"
  }
}
```

---

### expired_error 예시

```bash
curl -X POST https://api.msqpay.com/api/payments/123e4567-e89b-12d3-a456-426614174000/execute \
  -H "Content-Type: application/json" \
  -d '{
    "customerAddress": "0xCustomer...",
    "signature": "0x..."
  }'
```

**응답 (HTTP 410)**:
```json
{
  "error": {
    "type": "expired_error",
    "code": "PAYMENT_EXPIRED",
    "message": "Payment has expired. Please create a new payment.",
    "field": "expiresAt",
    "value": 1732785600
  }
}
```

---

### rate_limit_error 예시

```bash
# 분당 100개 초과 요청 후
curl https://api.msqpay.com/api/payments
```

**응답 (HTTP 429)**:
```json
{
  "error": {
    "type": "rate_limit_error",
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Maximum 100 requests per minute.",
    "docs_url": "https://docs.msqpay.com/api/rate-limits"
  }
}
```

---

### service_unavailable_error 예시

```bash
curl -X POST https://api.msqpay.com/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "storeAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "amount": "1000000"
  }'
```

**응답 (HTTP 503)** (데이터베이스 연결 실패):
```json
{
  "error": {
    "type": "service_unavailable_error",
    "code": "DATABASE_CONNECTION_FAILED",
    "message": "Database connection failed. Please try again later.",
    "docs_url": "https://status.msqpay.com"
  }
}
```

---

### internal_error 예시

```bash
curl -X POST https://api.msqpay.com/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "storeAddress": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "amount": "1000000"
  }'
```

**응답 (HTTP 500)**:
```json
{
  "error": {
    "type": "internal_error",
    "code": "INTERNAL_SERVER_ERROR",
    "message": "An unexpected error occurred. Please contact support with error ID.",
    "error_id": "err_1234567890abcdef",
    "docs_url": "https://support.msqpay.com"
  }
}
```

---

## 통합 가이드

### TypeScript 사용 예시

#### 1. 에러 타입 정의

```typescript
// types/error.ts
export type ErrorType =
  | 'validation_error'
  | 'authentication_error'
  | 'not_found_error'
  | 'state_error'
  | 'expired_error'
  | 'rate_limit_error'
  | 'service_unavailable_error'
  | 'internal_error';

export type ErrorCode =
  | 'PAYMENT_STORE_INVALID_ADDRESS'
  | 'PAYMENT_TOKEN_INVALID_ADDRESS'
  | 'PAYMENT_AMOUNT_INVALID_ZERO'
  | 'SIGNATURE_INVALID'
  | 'SIGNATURE_SIGNER_MISMATCH'
  | 'PAYMENT_NOT_FOUND'
  | 'PAYMENT_ALREADY_PROCESSED'
  | 'PAYMENT_EXPIRED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'DATABASE_CONNECTION_FAILED'
  | 'REDIS_CONNECTION_FAILED'
  | 'BLOCKCHAIN_RPC_ERROR'
  | 'DEFENDER_API_ERROR'
  | 'GASLESS_LIMIT_EXCEEDED'
  | 'INTERNAL_SERVER_ERROR';

export interface ErrorResponse {
  error: {
    type: ErrorType;
    code: ErrorCode;
    message: string;
    field?: string;
    value?: any;
    docs_url?: string;
    error_id?: string;
  };
}
```

#### 2. 에러 핸들러 클래스

```typescript
// utils/error-handler.ts
import type { ErrorResponse, ErrorCode } from './types/error';

export class MSQPayError extends Error {
  constructor(
    public status: number,
    public errorResponse: ErrorResponse
  ) {
    super(errorResponse.error.message);
    this.name = 'MSQPayError';
  }

  get code(): ErrorCode {
    return this.errorResponse.error.code;
  }

  get type(): string {
    return this.errorResponse.error.type;
  }

  isRetryable(): boolean {
    // 재시도 가능한 에러인지 확인
    return [
      'RATE_LIMIT_EXCEEDED',
      'DATABASE_CONNECTION_FAILED',
      'REDIS_CONNECTION_FAILED',
      'BLOCKCHAIN_RPC_ERROR',
      'DEFENDER_API_ERROR',
      'GASLESS_LIMIT_EXCEEDED',
      'INTERNAL_SERVER_ERROR'
    ].includes(this.code);
  }

  isClientError(): boolean {
    // 클라이언트 측 오류인지 확인
    return this.status >= 400 && this.status < 500;
  }

  isServerError(): boolean {
    // 서버 측 오류인지 확인
    return this.status >= 500;
  }
}
```

#### 3. API 클라이언트 예시

```typescript
// client/msqpay-client.ts
import { MSQPayError } from './utils/error-handler';

export class MSQPayClient {
  constructor(private apiUrl: string) {}

  async createPayment(params: {
    storeAddress: string;
    tokenAddress: string;
    amount: string;
    customerEmail?: string;
    metadata?: Record<string, any>;
  }) {
    try {
      const response = await fetch(`${this.apiUrl}/api/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });

      if (!response.ok) {
        const errorResponse = await response.json();
        throw new MSQPayError(response.status, errorResponse);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof MSQPayError) {
        console.error(`[${error.code}] ${error.message}`);

        // 에러 코드별 처리
        switch (error.code) {
          case 'PAYMENT_STORE_INVALID_ADDRESS':
            throw new Error('유효하지 않은 상점 주소입니다. 주소를 확인해주세요.');

          case 'PAYMENT_TOKEN_INVALID_ADDRESS':
            throw new Error('유효하지 않은 토큰 주소입니다. 주소를 확인해주세요.');

          case 'PAYMENT_AMOUNT_INVALID_ZERO':
            throw new Error('결제 금액은 0보다 커야 합니다.');

          default:
            throw error;
        }
      }
      throw error;
    }
  }

  async executePayment(
    paymentId: string,
    params: {
      customerAddress: string;
      signature: string;
    }
  ) {
    try {
      const response = await fetch(
        `${this.apiUrl}/api/payments/${paymentId}/execute`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params)
        }
      );

      if (!response.ok) {
        const errorResponse = await response.json();
        throw new MSQPayError(response.status, errorResponse);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof MSQPayError) {
        // 재시도 가능한 에러인지 확인
        if (error.isRetryable()) {
          console.log('재시도 가능한 에러입니다. 잠시 후 다시 시도해주세요.');
        }

        // 에러 코드별 처리
        switch (error.code) {
          case 'SIGNATURE_INVALID':
            throw new Error('서명이 유효하지 않습니다. 다시 서명해주세요.');

          case 'SIGNATURE_SIGNER_MISMATCH':
            throw new Error('서명자 주소가 일치하지 않습니다.');

          case 'PAYMENT_NOT_FOUND':
            throw new Error('결제 정보를 찾을 수 없습니다.');

          case 'PAYMENT_ALREADY_PROCESSED':
            throw new Error('이미 처리된 결제입니다.');

          case 'PAYMENT_EXPIRED':
            throw new Error('결제가 만료되었습니다. 새로운 결제를 생성해주세요.');

          case 'RATE_LIMIT_EXCEEDED':
            throw new Error('요청 제한을 초과했습니다. 잠시 후 다시 시도해주세요.');

          default:
            throw error;
        }
      }
      throw error;
    }
  }
}
```

#### 4. 재시도 로직 (Exponential Backoff)

```typescript
// utils/retry.ts
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof MSQPayError && error.isRetryable()) {
        if (attempt === maxRetries - 1) {
          throw error; // 마지막 시도 실패
        }

        const delay = baseDelay * Math.pow(2, attempt);
        console.log(`재시도 중... (${attempt + 1}/${maxRetries}) - ${delay}ms 대기`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error; // 재시도 불가능한 에러
      }
    }
  }

  throw new Error('최대 재시도 횟수를 초과했습니다.');
}

// 사용 예시
const client = new MSQPayClient('https://api.msqpay.com');

const payment = await retryWithBackoff(() =>
  client.createPayment({
    storeAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
    tokenAddress: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    amount: "1000000"
  })
);
```

---

### 프론트엔드에서 에러 처리

#### React 예시

```tsx
// components/PaymentForm.tsx
import { useState } from 'react';
import { MSQPayClient } from '../client/msqpay-client';
import { retryWithBackoff } from '../utils/retry';

export function PaymentForm() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const client = new MSQPayClient('https://api.msqpay.com');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const payment = await retryWithBackoff(() =>
        client.createPayment({
          storeAddress: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1",
          tokenAddress: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
          amount: "1000000"
        })
      );

      console.log('결제 생성 완료:', payment.paymentId);
      // 결제 실행 페이지로 이동
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <button type="submit" disabled={loading}>
        {loading ? '처리 중...' : '결제 생성'}
      </button>
    </form>
  );
}
```

---

### 에러 로깅 권장 사항

#### 1. 구조화된 로깅

```typescript
// utils/logger.ts
export function logError(error: MSQPayError, context?: Record<string, any>) {
  const logData = {
    timestamp: new Date().toISOString(),
    errorCode: error.code,
    errorType: error.type,
    message: error.message,
    status: error.status,
    ...context
  };

  // 로깅 서비스로 전송 (예: Sentry, LogRocket, DataDog)
  console.error('[MSQPay Error]', JSON.stringify(logData, null, 2));

  // 프로덕션 환경에서는 외부 로깅 서비스 사용
  if (process.env.NODE_ENV === 'production') {
    // Sentry.captureException(error, { extra: logData });
  }
}

// 사용 예시
try {
  await client.createPayment({ ... });
} catch (error) {
  if (error instanceof MSQPayError) {
    logError(error, {
      userId: currentUser?.id,
      paymentParams: { storeAddress, tokenAddress, amount }
    });
  }
}
```

#### 2. 에러 메트릭 추적

```typescript
// utils/metrics.ts
export function trackErrorMetric(errorCode: ErrorCode) {
  // 에러 발생 횟수 추적 (예: DataDog, Prometheus)
  console.log(`[Metric] Error occurred: ${errorCode}`);

  // 프로덕션 환경에서는 메트릭 서비스 사용
  if (process.env.NODE_ENV === 'production') {
    // datadogMetrics.increment('msqpay.error', {
    //   tags: [`error_code:${errorCode}`]
    // });
  }
}
```

---

## 문제 해결

### validation_error 문제 해결

**문제**: `PAYMENT_STORE_INVALID_ADDRESS`

**해결 방법**:
1. 주소가 `0x`로 시작하는지 확인
2. 주소 길이가 42자인지 확인 (0x + 40자리 16진수)
3. checksum 주소 사용 (ethers.js, viem, web3.js의 getAddress() 함수 사용)

```typescript
import { getAddress } from 'viem';

try {
  const checksumAddress = getAddress(userInputAddress);
  // 유효한 주소
} catch {
  // 유효하지 않은 주소
}
```

---

**문제**: `PAYMENT_AMOUNT_INVALID_ZERO`

**해결 방법**:
1. 금액이 0보다 큰지 확인
2. Wei 단위 변환 정확성 확인
3. 토큰의 decimals 값 확인

```typescript
import { parseUnits } from 'viem';

// USDT (6 decimals)
const usdtAmount = parseUnits('1.5', 6); // "1500000"

// ETH (18 decimals)
const ethAmount = parseUnits('0.01', 18); // "10000000000000000"
```

---

### authentication_error 문제 해결

**문제**: `SIGNATURE_INVALID`

**해결 방법**:
1. 올바른 EIP-712 도메인 정의 사용
2. 올바른 타입 정의 사용
3. 서명 메시지가 실제 결제 데이터와 일치하는지 확인

```typescript
import { privateKeyToAccount } from 'viem/accounts';

const account = privateKeyToAccount('0x...');

const domain = {
  name: 'MSQPay',
  version: '1',
  chainId: 80002,
  verifyingContract: PAYMENT_PROCESSOR_ADDRESS
};

const types = {
  Payment: [
    { name: 'paymentId', type: 'string' },
    { name: 'storeAddress', type: 'address' },
    { name: 'tokenAddress', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'customerAddress', type: 'address' }
  ]
};

const message = {
  paymentId: payment.paymentId,
  storeAddress: payment.storeAddress,
  tokenAddress: payment.tokenAddress,
  amount: payment.amount,
  customerAddress: account.address
};

const signature = await account.signTypedData({
  domain,
  types,
  primaryType: 'Payment',
  message
});
```

---

**문제**: `SIGNATURE_SIGNER_MISMATCH`

**해결 방법**:
1. 서명 생성에 사용한 지갑 주소를 `customerAddress`로 전달
2. 올바른 지갑으로 서명 재생성

```typescript
const signature = await account.signTypedData({ ... });

await client.executePayment(paymentId, {
  customerAddress: account.address, // 서명한 지갑 주소
  signature
});
```

---

### state_error 문제 해결

**문제**: `PAYMENT_ALREADY_PROCESSED`

**해결 방법**:
1. 결제 조회 API로 현재 상태 확인
2. 상태가 "pending"인 경우에만 실행 시도

```typescript
const payment = await client.getPayment(paymentId);

if (payment.status === 'pending') {
  await client.executePayment(paymentId, { customerAddress, signature });
} else {
  console.log(`결제 상태: ${payment.status} - 실행 불가`);
}
```

---

### expired_error 문제 해결

**문제**: `PAYMENT_EXPIRED`

**해결 방법**:
1. 새로운 결제 생성
2. 프론트엔드에서 만료 시간 타이머 표시

```typescript
// 결제 만료 시간 확인
const isExpired = Date.now() / 1000 > payment.expiresAt;

if (isExpired) {
  // 새로운 결제 생성
  const newPayment = await client.createPayment({ ... });
} else {
  // 남은 시간 계산
  const remainingSeconds = payment.expiresAt - Date.now() / 1000;
  console.log(`남은 시간: ${Math.floor(remainingSeconds / 60)}분`);
}
```

---

### rate_limit_error 문제 해결

**문제**: `RATE_LIMIT_EXCEEDED`

**해결 방법**:
1. 요청 빈도 감소
2. Exponential Backoff로 재시도

```typescript
async function retryWithBackoff(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof MSQPayError && error.code === 'RATE_LIMIT_EXCEEDED') {
        const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
        console.log(`Rate limited. Retrying after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
}
```

---

### service_unavailable_error 문제 해결

**문제**: `DATABASE_CONNECTION_FAILED`, `REDIS_CONNECTION_FAILED`, `BLOCKCHAIN_RPC_ERROR`, `DEFENDER_API_ERROR`, `GASLESS_LIMIT_EXCEEDED`

**해결 방법**:
1. 일시적 오류이므로 재시도 (Exponential Backoff)
2. 서비스 상태 페이지 확인
3. 문제가 지속되면 지원팀 문의

```typescript
const result = await retryWithBackoff(
  () => client.executePayment(paymentId, { customerAddress, signature }),
  maxRetries = 5
);
```

---

## 관련 문서

- [MSQPay API 레퍼런스](./api-reference.md)
- [MSQPay 인증 가이드](./authentication.md)
- [MSQPay Rate Limiting](./rate-limits.md)
- [MSQPay 상태 페이지](https://status.msqpay.com)

---

**버전**: 1.0.0
**최종 수정일**: 2025-11-28
**작성자**: MSQPay Team
