# 에러 코드

API 응답에서 반환되는 에러 코드와 해결 방법입니다.

## HTTP 상태 코드

| 코드 | 설명                        |
| ---- | --------------------------- |
| 200  | 성공                        |
| 201  | 생성 성공                   |
| 202  | 요청 수락 (비동기 처리)     |
| 400  | 잘못된 요청 (파라미터 오류) |
| 401  | 인증 실패 (API Key 오류)    |
| 403  | 권한 없음                   |
| 404  | 리소스 없음                 |
| 500  | 서버 오류                   |

## 에러 응답 형식

```json
{
  "code": "ERROR_CODE",
  "message": "Human readable message"
}
```

---

## 인증 오류 (401)

### UNAUTHORIZED

API Key가 유효하지 않거나 누락되었습니다.

```json
{
  "code": "UNAUTHORIZED",
  "message": "Invalid or missing API key"
}
```

**해결 방법**

- `x-api-key` 헤더 확인
- 대시보드에서 API Key 확인
- 환경에 맞는 키 사용 (test vs live)

---

## 검증 오류 (400)

### VALIDATION_ERROR

입력 데이터 검증에 실패했습니다.

```json
{
  "code": "VALIDATION_ERROR",
  "message": "입력 검증 실패",
  "details": [
    {
      "path": ["amount"],
      "message": "금액은 양수여야 합니다"
    }
  ]
}
```

**해결 방법**

- `details` 필드에서 어떤 필드가 잘못되었는지 확인
- 필수 파라미터가 모두 포함되었는지 확인

### UNSUPPORTED_CHAIN

지원하지 않는 체인입니다.

```json
{
  "code": "UNSUPPORTED_CHAIN",
  "message": "Unsupported chain"
}
```

**해결 방법**

- `GET /chains` API로 지원 체인 목록 확인
- chainId 값 확인

### UNSUPPORTED_TOKEN

지원하지 않는 토큰입니다.

```json
{
  "code": "UNSUPPORTED_TOKEN",
  "message": "Unsupported token"
}
```

**해결 방법**

- 지원 토큰 목록 확인
- 토큰 주소 오타 확인
- 해당 체인에서 활성화된 토큰인지 확인

### CHAIN_MISMATCH

체인 설정이 일치하지 않습니다.

```json
{
  "code": "CHAIN_MISMATCH",
  "message": "Merchant is configured for chain 80002, but payment requested for chain 137"
}
```

**해결 방법**

- 가맹점에 설정된 체인과 요청 체인 확인
- 토큰이 해당 체인에 속하는지 확인

---

## 리소스 오류 (404)

### MERCHANT_NOT_FOUND

가맹점을 찾을 수 없습니다.

```json
{
  "code": "MERCHANT_NOT_FOUND",
  "message": "Merchant not found"
}
```

**해결 방법**

- `merchantId` 값 확인
- 가맹점 등록 여부 확인

### PAYMENT_NOT_FOUND

결제를 찾을 수 없습니다.

```json
{
  "code": "PAYMENT_NOT_FOUND",
  "message": "결제를 찾을 수 없습니다"
}
```

**해결 방법**

- 결제 ID (paymentId) 확인
- 해당 가맹점의 결제인지 확인

### TOKEN_NOT_FOUND

토큰을 찾을 수 없습니다.

```json
{
  "code": "TOKEN_NOT_FOUND",
  "message": "Token not found in database"
}
```

**해결 방법**

- 토큰 주소 확인
- 해당 체인에 등록된 토큰인지 확인

### PAYMENT_METHOD_NOT_FOUND

결제 수단이 설정되지 않았습니다.

```json
{
  "code": "PAYMENT_METHOD_NOT_FOUND",
  "message": "Payment method not configured for this merchant and token"
}
```

**해결 방법**

- 가맹점에 해당 토큰이 결제 수단으로 등록되었는지 확인
- 대시보드에서 결제 수단 설정

---

## 권한 오류 (403)

### MERCHANT_DISABLED

가맹점이 비활성화되었습니다.

```json
{
  "code": "MERCHANT_DISABLED",
  "message": "Merchant is disabled"
}
```

**해결 방법**

- 대시보드에서 가맹점 상태 확인
- 관리자에게 문의

### PAYMENT_METHOD_DISABLED

결제 수단이 비활성화되었습니다.

```json
{
  "code": "PAYMENT_METHOD_DISABLED",
  "message": "Payment method is disabled"
}
```

**해결 방법**

- 대시보드에서 결제 수단 활성화

---

## 결제 상태 오류 (400)

### INVALID_PAYMENT_STATUS

결제 상태가 올바르지 않습니다.

```json
{
  "code": "INVALID_PAYMENT_STATUS",
  "message": "결제 상태가 CONFIRMED입니다. Gasless 요청은 CREATED 또는 PENDING 상태에서만 가능합니다."
}
```

**해결 방법**

- 결제 상태 먼저 확인
- 이미 완료된 결제에 대한 중복 요청 방지

---

## Gasless 오류 (400)

### INVALID_SIGNATURE

EIP-712 서명 검증에 실패했습니다.

```json
{
  "code": "INVALID_SIGNATURE",
  "message": "유효하지 않은 서명 형식입니다"
}
```

**해결 방법**

- 서명 형식 확인 (`0x` 로 시작하는 hex 문자열)
- 도메인(name, version, chainId, verifyingContract) 확인
- 타입 정의 확인

---

## 서버 오류 (500)

### INTERNAL_ERROR

서버 내부 오류입니다.

```json
{
  "code": "INTERNAL_ERROR",
  "message": "An internal error occurred"
}
```

**해결 방법**

- 잠시 후 재시도
- 문제 지속 시 support@solopay.com 문의

---

## SDK 에러 처리

```typescript
import { SoloPayError } from '@globalmsq/solopay'

try {
  const payment = await client.createPayment({ ... })
} catch (error) {
  if (error instanceof SoloPayError) {
    switch (error.code) {
      case 'UNSUPPORTED_TOKEN':
        console.log('지원하지 않는 토큰입니다')
        break
      case 'VALIDATION_ERROR':
        console.log('입력값을 확인하세요:', error.details)
        break
      case 'PAYMENT_NOT_FOUND':
        console.log('결제를 찾을 수 없습니다')
        break
      default:
        console.log(`에러: ${error.message}`)
    }
  }
}
```

## 다음 단계

- [SDK 사용법](/ko/sdk/) - 에러 처리 포함
- [Webhook 설정](/ko/webhook/) - 이벤트 기반 처리
