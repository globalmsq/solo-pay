# 클라이언트 메서드

SoloPayClient가 제공하는 메서드들을 설명합니다.

## createPayment()

새 결제를 생성합니다.

```typescript
const payment = await client.createPayment({
  merchantId: 'merchant_demo_001',
  amount: 10.5,
  chainId: 80002,
  tokenAddress: '0x...',
  recipientAddress: '0x...',
});
```

**파라미터**

| 이름               | 타입     | 필수 | 설명                                 |
| ------------------ | -------- | ---- | ------------------------------------ |
| `merchantId`       | `string` | ✓    | 가맹점 고유 식별자 (merchant_key)    |
| `amount`           | `number` | ✓    | 결제 금액 (토큰 단위, 예: 10.5 USDC) |
| `chainId`          | `number` | ✓    | 블록체인 네트워크 ID                 |
| `tokenAddress`     | `string` | ✓    | ERC-20 토큰 컨트랙트 주소            |
| `recipientAddress` | `string` | ✓    | 결제 수령 주소                       |

**반환값**

```typescript
{
  success: boolean;
  paymentId: string; // bytes32 해시
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  gatewayAddress: string;
  forwarderAddress: string;
  amount: string; // wei 단위
  status: string;
  expiresAt: string;
}
```

## getPaymentStatus()

결제 상태를 조회합니다.

```typescript
const status = await client.getPaymentStatus('0xabc123...');
```

**파라미터**

| 이름        | 타입     | 필수 | 설명                   |
| ----------- | -------- | ---- | ---------------------- |
| `paymentId` | `string` | ✓    | 결제 ID (bytes32 해시) |

**반환값**

```typescript
{
  success: true
  data: {
    paymentId: string
    status: 'CREATED' | 'PENDING' | 'CONFIRMED' | 'FAILED' | 'EXPIRED'
    amount: string
    tokenAddress: string
    tokenSymbol: string
    recipientAddress: string
    transactionHash?: string
    payment_hash: string
    network_id: number
    createdAt: string
    updatedAt: string
  }
}
```

## getPaymentHistory()

결제 내역을 조회합니다.

```typescript
const history = await client.getPaymentHistory({
  chainId: 80002,
  payer: '0x...',
  limit: 10,
});
```

**파라미터**

| 이름      | 타입     | 필수 | 설명                 |
| --------- | -------- | ---- | -------------------- |
| `chainId` | `number` | ✓    | 블록체인 네트워크 ID |
| `payer`   | `string` | ✓    | 결제자 지갑 주소     |
| `limit`   | `number` |      | 조회 개수            |

**반환값**

```typescript
{
  success: true;
  data: Array<{
    paymentId: string;
    payer: string;
    merchant: string;
    token: string;
    tokenSymbol: string;
    decimals: number;
    amount: string;
    timestamp: string;
    transactionHash: string;
    status: string;
    isGasless: boolean;
    relayId?: string;
  }>;
}
```

## submitGasless()

Gasless 결제를 제출합니다.

```typescript
const result = await client.submitGasless({
  paymentId: '0xabc123...',
  forwarderAddress: '0x...',
  forwardRequest: {
    from: '0x...',
    to: '0x...',
    value: '0',
    gas: '200000',
    nonce: '1',
    deadline: '1706281200',
    data: '0x...',
    signature: '0x...',
  },
});
```

**파라미터**

| 이름                       | 타입     | 필수 | 설명                            |
| -------------------------- | -------- | ---- | ------------------------------- |
| `paymentId`                | `string` | ✓    | 결제 ID (bytes32 해시)          |
| `forwarderAddress`         | `string` | ✓    | ERC2771 Forwarder 컨트랙트 주소 |
| `forwardRequest`           | `object` | ✓    | EIP-712 서명된 요청 데이터      |
| `forwardRequest.signature` | `string` | ✓    | EIP-712 서명                    |

자세한 내용은 [Gasless 결제](/ko/gasless/) 가이드를 참고하세요.

**반환값**

```typescript
{
  success: true;
  relayRequestId: string;
  status: 'submitted' | 'mined' | 'failed';
  message: string;
}
```

## getRelayStatus()

Relay 요청 상태를 조회합니다.

```typescript
const status = await client.getRelayStatus('relay_abc123');
```

**파라미터**

| 이름             | 타입     | 필수 | 설명          |
| ---------------- | -------- | ---- | ------------- |
| `relayRequestId` | `string` | ✓    | Relay 요청 ID |

**반환값**

```typescript
{
  success: true
  relayRequestId: string
  transactionHash?: string
  status: 'submitted' | 'pending' | 'mined' | 'confirmed' | 'failed'
}
```

## 에러 처리

```typescript
import { SoloPayError } from '@globalmsq/solopay'

try {
  const payment = await client.createPayment({ ... })
} catch (error) {
  if (error instanceof SoloPayError) {
    console.log(error.code)       // 'UNSUPPORTED_TOKEN'
    console.log(error.message)    // 'Unsupported token'
    console.log(error.statusCode) // 400
  }
}
```

## 다음 단계

- [결제 생성](/ko/payments/create) - 결제 플로우 상세
- [에러 코드](/ko/api/errors) - 전체 에러 코드 목록
