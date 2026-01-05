[English](errors.md) | [한국어](errors.ko.md)

# 에러 코드

MSQPay API 에러 코드 및 해결 방법입니다.

## 에러 응답 구조

```json
{
  "code": "ERROR_CODE",
  "message": "에러 메시지",
  "field": "fieldName",        // 선택사항
  "value": "actualValue"       // 선택사항
}
```

## HTTP 상태 코드

| HTTP 상태 | 에러 타입 | 설명 |
|-----------|----------|------|
| 400 | validation_error | 입력 검증 실패 |
| 400 | state_error | 잘못된 상태 전환 |
| 401 | authentication_error | 인증/서명 실패 |
| 404 | not_found_error | 리소스 없음 |
| 410 | expired_error | 리소스 만료 |
| 429 | rate_limit_error | Rate Limit 초과 |
| 500 | internal_error | 서버 내부 오류 |
| 503 | service_unavailable_error | 서비스 불가 |

## 주요 에러 코드

### validation_error (400)

입력 데이터 검증 실패

| 코드 | 설명 | 해결 방법 |
|------|------|----------|
| `VALIDATION_ERROR` | 일반 검증 실패 | 입력 데이터 확인 |
| `INVALID_REQUEST` | 잘못된 요청 형식 | API 형식 확인 |
| `PAYMENT_STORE_INVALID_ADDRESS` | 상점 주소 검증 실패 | 유효한 주소 입력 |
| `PAYMENT_TOKEN_INVALID_ADDRESS` | 토큰 주소 검증 실패 | 유효한 토큰 주소 |
| `PAYMENT_AMOUNT_INVALID_ZERO` | 금액이 0 | 양수 금액 입력 |
| `INVALID_TRANSACTION_DATA` | 트랜잭션 데이터 오류 | TX 데이터 검증 |
| `INVALID_GAS_ESTIMATE` | 가스 추정 오류 | 가스 값 재계산 |

### authentication_error (401)

인증 및 서명 검증 실패

| 코드 | 설명 | 해결 방법 |
|------|------|----------|
| `INVALID_SIGNATURE` | 서명 검증 실패 | EIP-712 서명 재생성 |
| `SIGNATURE_SIGNER_MISMATCH` | 서명자 불일치 | 올바른 지갑으로 서명 |

### not_found_error (404)

리소스를 찾을 수 없음

| 코드 | 설명 | 해결 방법 |
|------|------|----------|
| `NOT_FOUND` | 결제 정보 없음 | paymentId 확인 |
| `PAYMENT_NOT_FOUND` | 결제 없음 | 유효한 paymentId 사용 |

### state_error (400)

잘못된 상태 전환

| 코드 | 설명 | 해결 방법 |
|------|------|----------|
| `PAYMENT_ALREADY_PROCESSED` | 이미 처리된 결제 | 중복 제출 방지 |
| `PAYMENT_EXPIRED` | 결제 만료 | 새 결제 생성 |

### internal_error (500)

서버 내부 오류

| 코드 | 설명 | 해결 방법 |
|------|------|----------|
| `INTERNAL_ERROR` | 서버 오류 | 재시도 또는 지원팀 문의 |
| `DATABASE_CONNECTION_FAILED` | DB 연결 실패 | 잠시 후 재시도 |
| `BLOCKCHAIN_RPC_ERROR` | RPC 오류 | 잠시 후 재시도 |

### service_unavailable_error (503)

외부 의존성 오류

| 코드 | 설명 | 해결 방법 |
|------|------|----------|
| `SERVICE_UNAVAILABLE` | 서비스 불가 | 잠시 후 재시도 |
| `RELAY_SERVICE_UNAVAILABLE` | Relay 서비스 불가 | 잠시 후 재시도 |

## 블록체인 관련 에러

### 토큰 관련

| 코드 | 설명 | 해결 방법 |
|------|------|----------|
| `INSUFFICIENT_BALANCE` | 토큰 잔액 부족 | 잔액 충전 |
| `INSUFFICIENT_ALLOWANCE` | Approval 부족 | Token approval 필요 |
| `TOKEN_TRANSFER_FAILED` | 토큰 전송 실패 | 잔액/Approval 확인 |

### 트랜잭션 관련

| 코드 | 설명 | 해결 방법 |
|------|------|----------|
| `TRANSACTION_REVERTED` | TX 실행 실패 | 가스/잔액 확인 |
| `GAS_LIMIT_EXCEEDED` | 가스 한도 초과 | 가스 한도 증가 |
| `NONCE_TOO_LOW` | Nonce 충돌 | 지갑 Nonce 재설정 |

## 에러 처리 예제

### SDK에서 에러 처리

```typescript
import { MSQPayClient, MSQPayError } from '@globalmsq/msqpay';

const client = new MSQPayClient({
  environment: 'development',
  apiKey: 'sk_test_abc123'
});

try {
  await client.createPayment(params);
} catch (error) {
  if (error instanceof MSQPayError) {
    console.error(`Error [${error.code}]: ${error.message}`);
    console.error(`HTTP Status: ${error.statusCode}`);
    console.error(`Details:`, error.details);

    // 에러 타입별 처리
    switch (error.code) {
      case 'VALIDATION_ERROR':
        // 입력 데이터 수정 후 재시도
        break;
      case 'INVALID_SIGNATURE':
        // 서명 재생성
        break;
      case 'NOT_FOUND':
        // 결제 정보 확인
        break;
      case 'INTERNAL_ERROR':
        // 재시도 또는 지원팀 문의
        break;
      default:
        // 기타 에러 처리
    }
  }
}
```

### 재시도 로직

```typescript
async function retryableRequest<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (error instanceof MSQPayError) {
        // 재시도 가능한 에러인지 확인
        const retryable = [
          'INTERNAL_ERROR',
          'SERVICE_UNAVAILABLE',
          'BLOCKCHAIN_RPC_ERROR'
        ].includes(error.code);

        if (!retryable) {
          throw error;  // 재시도 불가능한 에러는 즉시 throw
        }
      }

      // 지수 백오프
      const delay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// 사용
const payment = await retryableRequest(() =>
  client.createPayment(params)
);
```

## 디버깅 팁

### 1. field와 value 확인

에러 응답의 `field`와 `value`로 문제 파악:

```json
{
  "code": "PAYMENT_STORE_INVALID_ADDRESS",
  "message": "Invalid store address",
  "field": "recipientAddress",
  "value": "0xinvalid"
}
```

### 2. 로그 확인

Payment Server 로그:

```bash
docker-compose logs -f server
```

### 3. RPC 상태 확인

```bash
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"web3_clientVersion","params":[],"id":67}'
```

## 관련 문서

- [API 레퍼런스](api.ko.md) - 모든 API 엔드포인트
- [결제 통합하기](../guides/integrate-payment.ko.md) - 에러 처리 예제
- [SDK 레퍼런스](sdk.ko.md) - MSQPayError 클래스
