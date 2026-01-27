# 결제 생성

결제를 생성하고 고유 ID를 발급받습니다.

## 개요

결제 생성은 MSQPay 통합의 첫 단계입니다. 생성된 결제는 **30분 후 자동 만료**됩니다.

## 결제 플로우

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│  가맹점 서버 │         │  MSQPay API │         │   블록체인   │
└──────┬──────┘         └──────┬──────┘         └──────┬──────┘
       │                       │                       │
       │  POST /payments/create│                       │
       │──────────────────────▶│                       │
       │                       │                       │
       │  { paymentId }        │                       │
       │◀──────────────────────│                       │
       │                       │                       │
       │         (사용자가 지갑에서 결제)                │
       │                       │                       │
       │                       │    TX 전송            │
       │                       │──────────────────────▶│
       │                       │                       │
       │  Webhook: confirmed   │                       │
       │◀──────────────────────│                       │
       │                       │                       │
```

## SDK 사용

```typescript
const payment = await client.createPayment({
  merchantId: 'merchant_demo_001',
  amount: 10.5,                    // 10.5 USDC (토큰 단위)
  chainId: 80002,                  // Polygon Amoy
  tokenAddress: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
  recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
})
```

## REST API 사용

```bash
curl -X POST http://localhost:3001/payments/create \
  -H "x-api-key: sk_test_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "merchantId": "merchant_demo_001",
    "amount": 10.5,
    "chainId": 80002,
    "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    "recipientAddress": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
  }'
```

## 요청 파라미터

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `merchantId` | `string` | ✓ | 가맹점 고유 식별자 (merchant_key) |
| `amount` | `number` | ✓ | 결제 금액 (토큰 단위, 예: 10.5 USDC) |
| `chainId` | `number` | ✓ | 블록체인 네트워크 ID |
| `tokenAddress` | `address` | ✓ | ERC-20 토큰 컨트랙트 주소 |
| `recipientAddress` | `address` | ✓ | 결제 수령 주소 |

::: tip 금액 입력
금액은 토큰 단위로 입력합니다. 서버에서 자동으로 wei 단위로 변환합니다.
예: 10.5 USDC → 10500000 (6 decimals)
:::

## 응답

### 성공 (201 Created)

```json
{
  "success": true,
  "paymentId": "0xabc123def456...",
  "chainId": 80002,
  "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "tokenSymbol": "USDC",
  "tokenDecimals": 6,
  "gatewayAddress": "0x...",
  "forwarderAddress": "0x...",
  "amount": "10500000",
  "status": "created",
  "expiresAt": "2024-01-26T13:00:00.000Z"
}
```

### 에러 (400 Bad Request)

```json
{
  "code": "UNSUPPORTED_TOKEN",
  "message": "Unsupported token"
}
```

## 응답 필드 설명

| 필드 | 타입 | 설명 |
|------|------|------|
| `paymentId` | `string` | 결제 고유 식별자 (bytes32 해시) |
| `amount` | `string` | wei 단위로 변환된 금액 |
| `gatewayAddress` | `address` | PaymentGateway 컨트랙트 주소 |
| `forwarderAddress` | `address` | ERC2771 Forwarder 주소 (Gasless용) |
| `expiresAt` | `datetime` | 결제 만료 시각 (생성 후 30분) |

## 결제 생성 후

결제가 생성되면 `paymentId`와 컨트랙트 주소들을 프론트엔드에 전달합니다.

프론트엔드에서는 두 가지 방식으로 결제를 진행할 수 있습니다:

### 1. 직접 결제

사용자가 직접 트랜잭션을 전송합니다.

```typescript
// 프론트엔드 (wagmi 사용 예시)
await writeContract({
  address: gatewayAddress,
  abi: PaymentGatewayABI,
  functionName: 'pay',
  args: [paymentId, tokenAddress, amount]
})
```

### 2. Gasless 결제

사용자는 서명만 하고, Relayer가 대신 전송합니다.

[Gasless 결제 가이드](/ko/gasless/) 참고

## 다음 단계

- [결제 상태 조회](/ko/payments/status) - 결제 진행 상황 확인
- [Webhook 설정](/ko/webhook/) - 결제 완료 알림 받기
