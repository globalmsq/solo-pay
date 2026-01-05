[English](architecture.md) | [한국어](architecture.ko.md)

# 시스템 구조

MSQPay 블록체인 결제 시스템의 전체 아키텍처 및 설계 원칙입니다.

## 핵심 원칙

| 원칙 | 설명 |
|------|------|
| **Contract = Source of Truth** | 결제 완료 여부는 오직 스마트 컨트랙트만 신뢰 |
| **Integrated DB Architecture** | MySQL + Redis 캐싱 통합, 그러나 Contract = Source of Truth 유지 |
| **Consistent API Interface** | MVP와 Production 모두 동일한 API 형태 |
| **Server-Issued paymentId** | 결제서버가 유일한 paymentId 생성자 |
| **Merchant Server ↔ Blockchain Separation** | 상점서버는 결제서버 API만 호출, 블록체인 직접 접근 불가 |

## 전체 시스템 다이어그램

```mermaid
flowchart TB
    subgraph Client["클라이언트"]
        Frontend[프론트엔드]
        Metamask[Metamask]
    end

    subgraph Store["상점"]
        StoreServer[상점서버<br/>SDK]
    end

    subgraph Payment["결제 시스템"]
        PaymentServer[결제서버<br/>API]
        OZRelay[OZ Defender Relay]
    end

    subgraph Blockchain["블록체인"]
        Contract[PaymentGateway<br/>Source of Truth]
    end

    Frontend --> StoreServer
    Frontend --> Metamask
    Metamask -->|Direct TX| Contract
    StoreServer -->|API Key 인증| PaymentServer
    PaymentServer --> OZRelay
    OZRelay -->|Gasless Relay| Contract
    PaymentServer -->|상태 조회| Contract
```

## 결제 플로우

### Direct Payment

사용자가 가스비를 직접 지불하는 방식:

```mermaid
sequenceDiagram
    autonumber
    participant U as 사용자
    participant F as 프론트엔드
    participant S as 상점서버
    participant A as 결제서버 (API)
    participant W as Wallet
    participant C as Contract

    U->>F: 상품 결제 요청
    F->>S: 결제 준비 요청 (productId만)
    S->>A: createPayment() (DB 가격 조회 후)
    A-->>S: paymentId 응답
    S-->>F: paymentId + 결제 정보

    F->>W: Token Approve 요청 (필요시)
    W-->>F: Approve 완료

    F->>W: pay() TX 요청
    W->>C: pay(paymentId, token, amount, merchant)
    C-->>W: TX 완료

    loop Polling (2초 간격)
        S->>A: getPaymentStatus()
        A->>C: processedPayments 조회
        A-->>S: status 응답
    end

    S-->>F: 결제 완료
    F-->>U: 상품 지급
```

### Gasless Payment

서비스가 가스비를 대납하는 방식:

```mermaid
sequenceDiagram
    autonumber
    participant U as 사용자
    participant F as 프론트엔드
    participant S as 상점서버
    participant A as 결제서버 (API)
    participant W as Wallet
    participant R as OZ Relay
    participant C as Contract

    U->>F: 상품 결제 요청
    F->>S: 결제 준비 요청 (productId만)
    S->>A: createPayment() (DB 가격 조회 후)
    A-->>S: paymentId 응답

    S->>A: getGaslessData(paymentId, userAddress)
    A-->>S: typedData + forwardRequest
    S-->>F: 서명 요청 데이터

    F->>W: EIP-712 서명 요청 (가스비 없음)
    W-->>F: signature

    F->>S: signature 전송
    S->>A: submitGaslessSignature()
    A->>R: Relay 요청
    R->>C: execute(forwardRequest, signature)
    C-->>R: TX 완료

    loop Polling (2초 간격)
        S->>A: getPaymentStatus()
        A->>C: processedPayments 조회
        A-->>S: status 응답
    end

    S-->>F: 결제 완료
    F-->>U: 상품 지급
```

## Docker Compose 아키텍처 (로컬 개발)

```mermaid
flowchart TB
    subgraph Docker["Docker Network (msqpay-network)"]
        subgraph Infra["인프라"]
            MySQL[(MySQL 8.0<br/>:3306)]
            Redis[(Redis 7<br/>:6379)]
        end

        subgraph Blockchain["블록체인"]
            Hardhat[Hardhat Node<br/>:8545]
        end

        subgraph Apps["애플리케이션"]
            Server[Payment Server<br/>Fastify :3001]
            Demo[Demo App<br/>Next.js :3000]
        end
    end

    Server --> MySQL
    Server --> Redis
    Server --> Hardhat
    Demo --> Server
```

### 서비스 구성

| 서비스 | 포트 | 설명 |
|--------|------|------|
| mysql | 3306 | 결제 데이터 |
| redis | 6379 | 캐싱 |
| hardhat | 8545 | 로컬 블록체인 |
| server | 3001 | Payment API |
| demo | 3000 | 프론트엔드 |

## API 서버 구조

### Fastify 컨테이너 구조

```mermaid
flowchart TB
    subgraph Container["Fastify 서버"]
        subgraph Routes["라우트 계층"]
            PaymentRoutes[결제 API<br/>4개 엔드포인트]
            TokenRoutes[토큰 API<br/>2개 엔드포인트]
            TxRoutes[거래 API<br/>1개 엔드포인트]
        end

        subgraph Services["서비스 계층"]
            BlockchainService[BlockchainService<br/>스마트 컨트랙트 상호작용]
            ForwarderService[ForwarderService<br/>Meta-TX 처리]
        end

        subgraph Validation["검증 계층"]
            Zod[Zod<br/>요청/응답 스키마]
        end

        subgraph Client["블록체인 클라이언트"]
            Viem[viem<br/>read/write 함수]
        end
    end

    subgraph External["외부 시스템"]
        Forwarder[ERC2771Forwarder<br/>서명 검증]
        Gateway[PaymentGateway<br/>결제 저장소]
        Polygon[Polygon 노드<br/>거래 검증]
    end

    Routes --> Services
    Services --> Viem
    Services --> Validation
    Viem --> Polygon
    ForwarderService --> Forwarder
    Forwarder --> Gateway
```

## 스마트 컨트랙트 구조

### PaymentGateway

```
PaymentGateway (UUPS Upgradeable)
├── Storage
│   ├── processedPayments: mapping(bytes32 => bool)
│   └── trustedForwarder: address
├── Functions
│   ├── pay() - Direct Payment
│   ├── payWithToken() - Direct Payment (token specified)
│   └── _authorizeUpgrade() - Upgrade authorization
└── Events
    └── PaymentProcessed(paymentId, payer, merchant, token, amount)
```

### ERC2771Forwarder

```
ERC2771Forwarder
├── Storage
│   └── nonces: mapping(address => uint256)
├── Functions
│   ├── execute() - Execute Meta-TX
│   ├── verify() - Verify EIP-712 signature
│   └── getNonce() - Get user nonce
└── EIP-712 Types
    └── ForwardRequest(from, to, value, gas, nonce, deadline, data)
```

## paymentId 생성

결제서버에서 Node.js로 생성 (스마트 컨트랙트 아님):

```typescript
import { keccak256, toBytes, concat } from 'viem';
import { randomBytes } from 'crypto';

function generatePaymentId(storeId: string, orderId: string): `0x${string}` {
  return keccak256(
    concat([
      toBytes(storeId),      // API Key에서 추출
      toBytes(orderId),      // 상점서버 요청
      randomBytes(32)        // 매번 다른 ID 보장
    ])
  );
}
```

**특징**:
- 같은 상점 + 같은 orderId → 항상 다른 paymentId
- storeId 포함 → 상점간 충돌 불가
- randomBytes 포함 → 동일 요청도 매번 새로운 ID

## 보안 설계

### 클라이언트 조작 방지

| 위협 | 대응 |
|------|------|
| 가짜 paymentId 생성 | 결제서버만 paymentId 발급 |
| 결제 완료 위조 | Contract에서 직접 조회 |
| **금액 조작 (Direct)** | **상점서버에서 상품 가격 조회 (프론트 amount 수신 금지)** |
| 금액 조작 (Gasless) | 서명 데이터에서 amount 확인 |
| 상점 위장 | API Key 인증 |

**핵심 보안 원칙**: 프론트엔드는 `productId`만 전송하고, 상점서버가 DB/설정에서 실제 가격을 조회하여 결제서버에 전달해야 합니다.

### 컨트랙트 보안

| 위험 | 대응 |
|------|------|
| Reentrancy | ReentrancyGuard 적용 |
| Replay Attack | processedPayments로 중복 방지 |
| Meta-tx Replay | Forwarder nonce + deadline |
| Unauthorized Upgrade | onlyOwner modifier on _authorizeUpgrade |

### SDK/API 보안

| 위험 | 대응 |
|------|------|
| Invalid Payment ID | Hash order ID로 고유성 보장 |
| Signature Reuse | nonce + deadline 포함 |
| Man-in-the-middle | HTTPS only |
| Rate Limiting | 10 req/s per client (향후 적용) |

## 네트워크 설정

### Polygon Amoy Testnet

| 항목 | 값 |
|------|-----|
| Chain ID | 80002 |
| Name | Polygon Amoy Testnet |
| RPC URL | https://rpc-amoy.polygon.technology |
| Block Explorer | https://amoy.polygonscan.com |

### 배포된 컨트랙트

| Contract | Address |
|----------|---------|
| PaymentGateway (Proxy) | `0x2256bedB57869AF4fadF16e1ebD534A7d47513d7` |
| PaymentGatewayV1 (Impl) | `0xDc40C3735163fEd63c198c3920B65B66DB54b1Bf` |
| ERC2771Forwarder | `0x0d9A0fAf9a8101368aa01B88442B38f82180520E` |
| SUT Token | `0xE4C687167705Abf55d709395f92e254bdF5825a2` |

## 확장성

### Production 아키텍처 (향후)

Production 환경에서는 API Server와 Status Worker를 분리:

| 서버 | 역할 | Stateless |
|------|------|-----------|
| **API Server** | 외부 요청 처리, 결제 생성, Relay | O |
| **Status Worker** | 블록체인 이벤트 모니터링, 상태 동기화 | X |

**확장 방식**:

| 구성요소 | 확장 방식 |
|----------|----------|
| API Server | 수평 확장 (로드밸런서) |
| Status Worker | 단일 인스턴스 (이벤트 중복 방지) |
| MySQL | Read Replica |
| Redis | Cluster 모드 |

## 기술 스택

| 구성요소 | 기술 |
|----------|------|
| Smart Contract | Solidity 0.8.24, OpenZeppelin 5.x |
| Contract Framework | Hardhat |
| Payment Server | Node.js, Fastify v5, viem v2.21 |
| Payment Server Tests | Vitest, Pino structured logging |
| SDK | TypeScript, Node 18+ native fetch |
| SDK Tests | Vitest, 100% coverage |
| Relay | Simple Relayer (dev) / OZ Defender (prod) |
| Demo App | Next.js 14, wagmi, RainbowKit |
| Package Manager | pnpm |

## 관련 문서

- [API 레퍼런스](api.ko.md) - 모든 API 엔드포인트
- [SDK 레퍼런스](sdk.ko.md) - MSQPayClient 메서드
- [결제 통합하기](../guides/integrate-payment.ko.md) - SDK 사용법
- [서버 배포하기](../guides/deploy-server.ko.md) - 배포 가이드
