# API Reference

SoloPay REST API 전체 명세입니다.

## Base URL

| 환경        | URL                               |
| ----------- | --------------------------------- |
| Production  | `https://api.solopay.com`         |
| Staging     | `https://staging-api.solopay.com` |
| Development | `http://localhost:3001`           |

## 인증

모든 API 요청에 `x-api-key` 헤더가 필요합니다.

```bash
curl -H "x-api-key: sk_test_xxxxx" https://api.solopay.com/...
```

## 공통 응답 형식

### 성공

```json
{
  "success": true,
  ...
}
```

### 에러

```json
{
  "code": "ERROR_CODE",
  "message": "Human readable message"
}
```

---

## Payments

### POST /payments/create

결제를 생성합니다. 인증: `x-public-key`, `Origin` 헤더.

**Request**

```json
{
  "orderId": "order-001",
  "amount": 10.5,
  "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "successUrl": "https://example.com/success",
  "failUrl": "https://example.com/fail"
}
```

| 필드           | 타입    | 필수 | 설명                                                    |
| -------------- | ------- | ---- | ------------------------------------------------------- |
| `orderId`      | string  | ✓    | 가맹점 주문 식별자                                      |
| `amount`       | number  | ✓    | 결제 금액 (토큰 단위, 예: 10.5 USDC)                    |
| `tokenAddress` | address | ✓    | ERC-20 토큰 주소 (whitelist 등록 및 가맹점 활성화 필수) |
| `successUrl`   | string  | ✓    | 성공 시 리다이렉트 URL                                  |
| `failUrl`      | string  | ✓    | 실패 시 리다이렉트 URL                                  |
| `webhookUrl`   | string  |      | 결제별 웹훅 URL (선택)                                  |

**Response (201)**

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

---

### GET /payments/:id/status

결제 상태를 조회합니다.

**Response (200)**

```json
{
  "success": true,
  "data": {
    "paymentId": "0xabc123...",
    "status": "CONFIRMED",
    "amount": "10500000",
    "tokenAddress": "0x...",
    "tokenSymbol": "USDC",
    "recipientAddress": "0x...",
    "transactionHash": "0xdef789...",
    "payment_hash": "0xabc123...",
    "network_id": 80002,
    "createdAt": "2024-01-26T12:30:00Z",
    "updatedAt": "2024-01-26T12:35:42Z"
  }
}
```

---

### GET /payments/history

결제 내역을 조회합니다.

**Query Parameters**

| 필드      | 타입    | 필수 | 설명                 |
| --------- | ------- | ---- | -------------------- |
| `chainId` | number  | ✓    | 블록체인 네트워크 ID |
| `payer`   | address | ✓    | 결제자 지갑 주소     |
| `limit`   | number  |      | 조회 개수            |

**Response (200)**

```json
{
  "success": true,
  "data": [
    {
      "paymentId": "0x...",
      "payer": "0x...",
      "merchant": "0x...",
      "token": "0x...",
      "tokenSymbol": "USDC",
      "decimals": 6,
      "amount": "10500000",
      "timestamp": "1706271342",
      "transactionHash": "0x...",
      "status": "CONFIRMED",
      "isGasless": false
    }
  ]
}
```

---

### POST /payments/:id/gasless

Gasless 결제를 제출합니다.

**Request**

```json
{
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
}
```

| 필드                       | 타입    | 필수 | 설명                            |
| -------------------------- | ------- | ---- | ------------------------------- |
| `paymentId`                | string  | ✓    | 결제 해시 (bytes32)             |
| `forwarderAddress`         | address | ✓    | ERC2771 Forwarder 컨트랙트 주소 |
| `forwardRequest`           | object  | ✓    | EIP-712 서명된 요청 데이터      |
| `forwardRequest.signature` | string  | ✓    | EIP-712 서명                    |

**Response (202)**

```json
{
  "success": true,
  "relayRequestId": "relay_abc123",
  "status": "submitted",
  "message": "Gasless 거래가 제출되었습니다"
}
```

---

### GET /payments/relay/:id/status

Relay 요청 상태를 조회합니다.

**Response (200)**

```json
{
  "success": true,
  "relayRequestId": "relay_abc123",
  "status": "confirmed",
  "transactionHash": "0x..."
}
```

---

## Merchants

### GET /merchants/me

현재 가맹점 정보를 조회합니다.

**Response (200)**

```json
{
  "success": true,
  "data": {
    "id": 1,
    "merchant_key": "my-store",
    "name": "My Store",
    "is_enabled": true,
    "chain_id": 1,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

---

### GET /merchants/me/payment-methods

결제 수단 목록을 조회합니다.

**Response (200)**

```json
{
  "success": true,
  "data": [
    {
      "tokenAddress": "0x...",
      "tokenSymbol": "USDC",
      "tokenDecimals": 6,
      "recipientAddress": "0x...",
      "chainId": 80002,
      "chainName": "Polygon Amoy",
      "enabled": true
    }
  ]
}
```

---

## Tokens

### GET /tokens/:tokenAddress/balance

토큰 잔액을 조회합니다.

**Query Parameters**

| 필드      | 타입    | 필수 | 설명                 |
| --------- | ------- | ---- | -------------------- |
| `chainId` | number  | ✓    | 블록체인 네트워크 ID |
| `address` | address | ✓    | 지갑 주소            |

**Response (200)**

```json
{
  "success": true,
  "data": {
    "balance": "100000000"
  }
}
```

---

### GET /tokens/:tokenAddress/allowance

토큰 승인 금액을 조회합니다.

**Query Parameters**

| 필드      | 타입    | 필수 | 설명                           |
| --------- | ------- | ---- | ------------------------------ |
| `chainId` | number  | ✓    | 블록체인 네트워크 ID           |
| `owner`   | address | ✓    | 소유자 주소                    |
| `spender` | address | ✓    | 승인받은 주소 (PaymentGateway) |

**Response (200)**

```json
{
  "success": true,
  "data": {
    "allowance": "115792089237316195423570985008687907853269984665640564039457584007913129639935"
  }
}
```

---

## Chains

### GET /chains

지원 체인 목록을 조회합니다.

**Response (200)**

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "networkId": 80002,
      "name": "Polygon Amoy",
      "gatewayAddress": "0x...",
      "forwarderAddress": "0x...",
      "tokens": [
        {
          "address": "0x...",
          "symbol": "USDC",
          "decimals": 6
        }
      ]
    }
  ]
}
```

---

## Health

### GET /health

서버 상태를 확인합니다.

**Response (200)**

```json
{
  "status": "ok",
  "timestamp": "2024-01-26T12:00:00.000Z"
}
```

## 다음 단계

- [에러 코드](/ko/api/errors) - 에러 처리
- [SDK 사용법](/ko/sdk/) - SDK로 간편하게 사용
