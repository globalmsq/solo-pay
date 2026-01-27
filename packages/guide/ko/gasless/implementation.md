# Gasless 구현 방법

Gasless 결제를 구현하는 상세 가이드입니다.

## 전체 플로우

```
1. 결제 생성 (서버)
       ↓
2. EIP-712 서명 요청 (프론트엔드)
       ↓
3. Gasless 요청 전송 (서버)
       ↓
4. 상태 확인 (서버/프론트엔드)
```

## Step 1: 결제 생성

일반 결제와 동일하게 결제를 생성합니다.

```typescript
// 서버 사이드
const payment = await client.createPayment({
  merchantId: 'merchant_demo_001',
  amount: 10.5,
  chainId: 80002,
  tokenAddress: '0x...',
  recipientAddress: '0x...'
})

// paymentId, forwarderAddress를 프론트엔드로 전달
```

## Step 2: EIP-712 서명 요청

프론트엔드에서 사용자에게 서명을 요청합니다.

### wagmi 사용 예시

```typescript
import { useSignTypedData } from 'wagmi'

const { signTypedDataAsync } = useSignTypedData()

// Forwarder에서 현재 nonce 조회
const nonce = await publicClient.readContract({
  address: FORWARDER_ADDRESS,
  abi: ForwarderABI,
  functionName: 'nonces',
  args: [userAddress]
})

// Forward Request 구성
const forwardRequest = {
  from: userAddress,
  to: GATEWAY_ADDRESS,
  value: 0n,
  gas: 200000n,
  nonce: nonce,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1시간 후
  data: encodeFunctionData({
    abi: PaymentGatewayABI,
    functionName: 'payWithSignature',
    args: [paymentHash, tokenAddress, amount]
  })
}

// EIP-712 서명
const signature = await signTypedDataAsync({
  domain: {
    name: 'MSQPay Forwarder',
    version: '1',
    chainId: 80002,  // Polygon Amoy
    verifyingContract: FORWARDER_ADDRESS
  },
  types: {
    ForwardRequest: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'gas', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint48' },
      { name: 'data', type: 'bytes' }
    ]
  },
  primaryType: 'ForwardRequest',
  message: forwardRequest
})
```

### 서명 요청 시 사용자 화면

사용자 지갑에서 다음과 같은 내용이 표시됩니다:

```
MSQPay Forwarder

ForwardRequest
───────────────
from:     0x1234...abcd
to:       0xGateway...
value:    0
gas:      200000
nonce:    1
deadline: 1706281200
data:     0x...
```

::: warning 중요
서명은 트랜잭션이 아니므로 **가스비가 발생하지 않습니다**.
:::

## Step 3: Gasless 요청 전송

서명을 서버로 전송하여 Gasless 결제를 요청합니다.

### SDK 사용

```typescript
// 서버 사이드
const result = await client.submitGasless({
  paymentId: payment.paymentId,
  forwarderAddress: payment.forwarderAddress,
  forwardRequest: {
    from: forwardRequest.from,
    to: forwardRequest.to,
    value: forwardRequest.value.toString(),
    gas: forwardRequest.gas.toString(),
    nonce: forwardRequest.nonce.toString(),
    deadline: forwardRequest.deadline.toString(),
    data: forwardRequest.data,
    signature: signature  // signature는 forwardRequest 안에 포함
  }
})

console.log(result.relayRequestId)  // relay_abc123
```

### REST API 사용

```bash
curl -X POST http://localhost:3001/payments/0xabc123.../gasless \
  -H "x-api-key: sk_test_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "0xabc123...",
    "forwarderAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "forwardRequest": {
      "from": "0x...",
      "to": "0x...",
      "value": "0",
      "gas": "200000",
      "nonce": "1",
      "deadline": "1706281200",
      "data": "0x...",
      "signature": "0x..."
    }
  }'
```

### 응답

```json
{
  "success": true,
  "relayRequestId": "relay_abc123",
  "status": "submitted",
  "message": "Gasless 거래가 제출되었습니다"
}
```

## Step 4: 상태 확인

### Relay 상태 조회

```typescript
const relayStatus = await client.getRelayStatus('relay_abc123')

console.log(relayStatus.status)  // submitted | pending | mined | confirmed | failed
```

### 결제 상태 조회

```typescript
const paymentStatus = await client.getPaymentStatus('0xabc123...')

console.log(paymentStatus.data.status)  // CREATED | PENDING | CONFIRMED | FAILED
```

## 전체 코드 예시

### 프론트엔드 (React + wagmi)

```typescript
import { useSignTypedData, useAccount, usePublicClient } from 'wagmi'
import { encodeFunctionData } from 'viem'

function GaslessPayment({ paymentId, forwarderAddress, gatewayAddress, amount, tokenAddress }) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { signTypedDataAsync } = useSignTypedData()

  const handleGaslessPayment = async () => {
    // 1. nonce 조회
    const nonce = await publicClient.readContract({
      address: forwarderAddress,
      abi: ForwarderABI,
      functionName: 'nonces',
      args: [address]
    })

    // 2. Forward Request 구성
    const forwardRequest = {
      from: address,
      to: gatewayAddress,
      value: 0n,
      gas: 200000n,
      nonce: nonce,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      data: encodeFunctionData({
        abi: PaymentGatewayABI,
        functionName: 'payWithSignature',
        args: [paymentId, tokenAddress, amount]
      })
    }

    // 3. 서명 요청
    const signature = await signTypedDataAsync({
      domain: { /* ... */ },
      types: { /* ... */ },
      primaryType: 'ForwardRequest',
      message: forwardRequest
    })

    // 4. 서버로 전송
    const response = await fetch('/api/gasless', {
      method: 'POST',
      body: JSON.stringify({
        paymentId,
        forwarderAddress,
        forwardRequest: {
          ...forwardRequest,
          value: forwardRequest.value.toString(),
          gas: forwardRequest.gas.toString(),
          nonce: forwardRequest.nonce.toString(),
          deadline: forwardRequest.deadline.toString(),
          signature
        }
      })
    })

    return response.json()
  }

  return (
    <button onClick={handleGaslessPayment}>
      가스비 없이 결제하기
    </button>
  )
}
```

### 백엔드 (Node.js)

```typescript
import { MSQPayClient } from '@globalmsq/msqpay'

const client = new MSQPayClient({
  apiKey: process.env.MSQPAY_API_KEY!,
  environment: 'staging'
})

app.post('/api/gasless', async (req, res) => {
  const { paymentId, forwarderAddress, forwardRequest } = req.body

  try {
    const result = await client.submitGasless({
      paymentId,
      forwarderAddress,
      forwardRequest
    })

    res.json({ success: true, relayRequestId: result.relayRequestId })
  } catch (error) {
    res.status(400).json({ success: false, error: error.message })
  }
})
```

## 에러 처리

| 에러 코드 | 원인 | 해결 방법 |
|----------|------|----------|
| `INVALID_SIGNATURE` | 서명 검증 실패 | 도메인, 타입 확인 |
| `NONCE_MISMATCH` | 논스 불일치 | 최신 논스 조회 후 재시도 |
| `DEADLINE_EXPIRED` | 서명 유효기간 만료 | 새 서명 요청 |
| `INSUFFICIENT_ALLOWANCE` | 토큰 승인 부족 | approve 먼저 실행 |

## 다음 단계

- [Webhook 설정](/ko/webhook/) - 결제 완료 알림 받기
- [에러 코드](/ko/api/errors) - 전체 에러 목록
