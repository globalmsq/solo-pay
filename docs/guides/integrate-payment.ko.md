[English](integrate-payment.md) | [한국어](integrate-payment.ko.md)

# 결제 통합하기

MSQPay SDK를 사용하여 상점에 블록체인 결제를 통합하는 가이드입니다.

## SDK 설치

```bash
pnpm add @globalmsq/msqpay
```

**요구사항**:
- Node.js >= 18.0.0
- TypeScript >= 5.0 (선택사항)

## SDK 초기화

```typescript
import { MSQPayClient } from '@globalmsq/msqpay';

const client = new MSQPayClient({
  environment: 'development',  // or 'staging', 'production', 'custom'
  apiKey: 'your-api-key'
});
```

### 환경 설정

| Environment | API URL |
|-------------|---------|
| development | http://localhost:3001 |
| staging | https://pay-api.staging.msq.com |
| production | https://pay-api.msq.com |
| custom | `apiUrl` 파라미터 필요 |

## Direct Payment 구현

사용자가 가스비를 직접 지불하는 방식입니다.

### 1. 결제 생성

```typescript
const payment = await client.createPayment({
  userId: 'user-123',
  amount: 1000,
  currency: 'USD',
  tokenAddress: '0x1234567890123456789012345678901234567890',
  recipientAddress: '0x0987654321098765432109876543210987654321',
  description: 'Purchase order #12345'
});

console.log(payment.paymentId); // "pay-123"
```

### 2. 프론트엔드 결제 실행

```typescript
// wagmi/viem 사용
import { useWriteContract } from 'wagmi';

const { writeContract } = useWriteContract();

await writeContract({
  address: payment.gatewayAddress,
  abi: PaymentGatewayABI,
  functionName: 'pay',
  args: [paymentId, token, amount, merchant]
});
```

### 3. 결제 상태 조회

```typescript
// Polling (2초 간격)
const checkStatus = async () => {
  const status = await client.getPaymentStatus(payment.paymentId);

  if (status.data.status === 'completed') {
    console.log('결제 완료!');
    return true;
  }
  return false;
};

// 2초마다 확인
const interval = setInterval(async () => {
  const completed = await checkStatus();
  if (completed) clearInterval(interval);
}, 2000);
```

## Gasless Payment 구현

서비스가 가스비를 대납하는 방식입니다.

### 1. 결제 생성

Direct Payment와 동일:

```typescript
const payment = await client.createPayment({
  userId: 'user-123',
  amount: 1000,
  currency: 'USD',
  tokenAddress: '0x...',
  recipientAddress: '0x...'
});
```

### 2. Gasless 요청 제출

```typescript
const gaslessResult = await client.submitGasless({
  paymentId: payment.paymentId,
  forwarderAddress: '0x...',  // ERC2771Forwarder 주소
  signature: '0x...'           // EIP-712 서명
});

console.log(gaslessResult.relayRequestId); // "relay-123"
```

### 3. EIP-712 서명 생성 (프론트엔드)

```typescript
import { useSignTypedData } from 'wagmi';

const { signTypedData } = useSignTypedData();

// 상점서버에서 받은 typedData
const signature = await signTypedData({
  domain: typedData.domain,
  types: typedData.types,
  primaryType: typedData.primaryType,
  message: typedData.message
});

// signature를 상점서버로 전송
await fetch('/api/payments/relay', {
  method: 'POST',
  body: JSON.stringify({ paymentId, signature, forwardRequest })
});
```

### 4. 결제 상태 조회

Direct Payment와 동일하게 polling:

```typescript
const status = await client.getPaymentStatus(payment.paymentId);
console.log(status.data.status); // "pending" | "confirmed" | "completed"
```

## 결제 이력 조회

```typescript
const history = await client.getPaymentHistory({
  chainId: 31337,
  payer: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  limit: 100
});

history.data.forEach(payment => {
  console.log(`${payment.paymentId}: ${payment.amount}`);
  console.log(`Gasless: ${payment.isGasless}`);
});
```

## 에러 처리

### 주요 에러 10개

| 에러 코드 | HTTP 상태 | 설명 | 해결 방법 |
|----------|----------|------|----------|
| `VALIDATION_ERROR` | 400 | 입력 검증 실패 | 입력 데이터 확인 |
| `INVALID_REQUEST` | 400 | 잘못된 요청 | API 형식 확인 |
| `INVALID_SIGNATURE` | 400 | 서명 검증 실패 | EIP-712 서명 재생성 |
| `INVALID_TRANSACTION_DATA` | 400 | 잘못된 TX 데이터 | 트랜잭션 데이터 검증 |
| `INVALID_GAS_ESTIMATE` | 400 | 잘못된 가스 추정 | 가스 값 재계산 |
| `NOT_FOUND` | 404 | 결제 정보 없음 | paymentId 확인 |
| `PAYMENT_ALREADY_PROCESSED` | 400 | 이미 처리된 결제 | 중복 제출 방지 |
| `INSUFFICIENT_BALANCE` | 400 | 토큰 잔액 부족 | 사용자 잔액 확인 |
| `INSUFFICIENT_ALLOWANCE` | 400 | Approval 부족 | Token approval 필요 |
| `INTERNAL_ERROR` | 500 | 서버 오류 | 재시도 또는 지원팀 문의 |

### 에러 핸들링 예제

```typescript
import { MSQPayError } from '@globalmsq/msqpay';

try {
  await client.createPayment(params);
} catch (error) {
  if (error instanceof MSQPayError) {
    console.error(`Error [${error.code}]: ${error.message}`);
    console.error(`HTTP Status: ${error.statusCode}`);
    console.error(`Details:`, error.details);

    // 에러 타입별 처리
    if (error.code === 'VALIDATION_ERROR') {
      // 입력 데이터 수정 후 재시도
    } else if (error.code === 'NOT_FOUND') {
      // 결제 정보 확인
    } else {
      // 기타 에러 처리
    }
  }
}
```

## 보안 고려사항

### 금액 조작 방지 (필수)

**절대 금지**: 프론트엔드에서 `amount` 직접 받기

```typescript
// ❌ 잘못된 방법 (금액 조작 가능)
app.post('/api/checkout', async (req, res) => {
  const { amount } = req.body;  // 프론트에서 받음 → 위험!
  await client.createPayment({ amount });
});
```

**올바른 방법**: 서버에서 상품 가격 조회

```typescript
// ✅ 올바른 방법
app.post('/api/checkout', async (req, res) => {
  const { productId } = req.body;  // productId만 받음

  // DB에서 실제 가격 조회
  const product = await db.products.findById(productId);
  const amount = product.price;  // 서버에서 결정

  await client.createPayment({ amount });
});
```

### Token Approval 확인

```typescript
// 토큰 Allowance 조회
const allowanceResponse = await fetch(
  `/tokens/${token}/allowance?chainId=${chainId}&owner=${user}&spender=${gateway}`
);

const { allowance } = await allowanceResponse.json();

if (BigInt(allowance) < BigInt(amount)) {
  // Approval 필요
  console.log('Token approval 필요');
}
```

## 전체 예제

### 상점서버 (Backend)

```typescript
import { MSQPayClient } from '@globalmsq/msqpay';

const client = new MSQPayClient({
  environment: 'production',
  apiKey: process.env.MSQPAY_API_KEY!
});

app.post('/api/checkout', async (req, res) => {
  try {
    // 1. productId만 받기 (금액은 서버에서 조회)
    const { productId } = req.body;

    // 2. DB에서 실제 가격 조회
    const product = await db.products.findById(productId);

    // 3. 결제 생성
    const payment = await client.createPayment({
      userId: req.user.id,
      amount: product.price,  // 서버가 결정한 가격
      currency: 'USD',
      tokenAddress: '0x...',
      recipientAddress: '0x...'
    });

    // 4. paymentId 반환
    res.json({ paymentId: payment.paymentId });

  } catch (error) {
    if (error instanceof MSQPayError) {
      res.status(error.statusCode).json({ error: error.message });
    }
  }
});

// 결제 상태 조회
app.get('/api/payments/:id/status', async (req, res) => {
  const status = await client.getPaymentStatus(req.params.id);
  res.json(status);
});
```

### 프론트엔드

```typescript
// 1. 결제 요청 (productId만 전송)
const response = await fetch('/api/checkout', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ productId: 'prod_001' })
});

const { paymentId } = await response.json();

// 2. Direct Payment: Metamask로 트랜잭션 전송
await writeContract({
  address: gatewayAddress,
  abi: PaymentGatewayABI,
  functionName: 'pay',
  args: [paymentId, tokenAddress, amount, merchantAddress]
});

// 3. 결제 상태 확인 (2초 간격)
const checkPayment = setInterval(async () => {
  const status = await fetch(`/api/payments/${paymentId}/status`);
  const { data } = await status.json();

  if (data.status === 'completed') {
    console.log('결제 완료!');
    clearInterval(checkPayment);
  }
}, 2000);
```

## 다음 단계

- [API 레퍼런스](../reference/api.md) - 모든 API 엔드포인트 상세
- [SDK 레퍼런스](../reference/sdk.md) - MSQPayClient 전체 메서드
- [에러 코드](../reference/errors.md) - 전체 에러 코드 목록
- [서버 배포하기](deploy-server.md) - 결제 서버 배포 가이드
