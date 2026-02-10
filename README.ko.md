# SoloPay Monorepo

[English](README.md) | [한국어](README.ko.md)

Multi-Service Blockchain Payment Gateway - ERC-20 토큰 결제 게이트웨이

## Overview

여러 서비스가 통합할 수 있는 블록체인 결제 시스템입니다.

### 핵심 원칙

| 원칙                           | 설명                                                     |
| ------------------------------ | -------------------------------------------------------- |
| **Contract = Source of Truth** | 결제 완료 여부는 오직 스마트 컨트랙트만 신뢰             |
| **DB 통합 아키텍처**           | MySQL + Redis 캐싱 통합, Contract = Source of Truth 유지 |
| **동일 API 인터페이스**        | MVP와 Production 모두 같은 API 형태                      |
| **서버 발급 paymentId**        | 결제서버가 유일한 paymentId 생성자                       |
| **상점서버 ↔ 블록체인 분리**   | 상점서버는 결제서버 API만 호출, 블록체인 접근 불가       |

### Features

- **Direct Payment**: 사용자가 가스비를 직접 지불
- **Gasless Payment**: Meta-transaction을 통한 가스비 대납 (Relayer Service)
- **TypeScript SDK**: 상점서버용 API 클라이언트 (`@globalmsq/solopay`)
- **결제서버**: paymentId 발급, Contract 상태 조회, Gasless Relay
- **Demo App**: 테스트용 웹앱

## System Architecture

```
프론트엔드 → 상점서버 → 결제서버 → Contract
           (SDK)      (API)    (Source of Truth)
```

## Project Structure

```
solopay-monorepo/
├── packages/
│   ├── contracts/        # Smart Contracts (Hardhat)
│   ├── demo/             # Demo Web App (Next.js)
│   ├── guide/            # Documentation Site
│   ├── integration-tests/# Integration Tests
│   ├── gateway/          # Pay Gateway (Fastify)
│   ├── gateway-sdk/      # TypeScript SDK (@solo-pay/gateway-sdk)
│   ├── simple-relayer/   # 로컬 개발용 Relayer 서비스
│   └── subgraph/         # The Graph Subgraph (이벤트 인덱싱)
└── docs/                 # Documentation
```

## Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 8
- Docker & Docker Compose (권장)

### Installation

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

## Docker Development (Recommended)

Docker Compose를 사용한 원클릭 개발 환경:

### Quick Start

```bash
# 전체 스택 시작
cd docker && docker-compose up -d

# 로그 확인
docker-compose logs -f server

# 접속
# Demo: http://localhost:3000
# API:  http://localhost:3001/health
# Hardhat: http://localhost:8545
```

### Services

| 서비스  | 포트 | 설명                    |
| ------- | ---- | ----------------------- |
| mysql   | 3306 | 결제 데이터 (root/pass) |
| redis   | 6379 | 캐싱                    |
| hardhat | 8545 | 로컬 블록체인           |
| server  | 3001 | Payment API             |
| demo    | 3000 | 프론트엔드              |

### Commands

```bash
# 서비스 재시작
docker-compose restart server

# 리빌드
docker-compose up -d --build server

# MySQL 접속
docker-compose exec mysql mysql -u root -ppass solopay

# 전체 초기화
docker-compose down -v
```

## Manual Development

Docker 없이 수동으로 개발하는 경우:

```bash
# Terminal 1: Start Hardhat node
cd packages/contracts
npx hardhat node

# Terminal 2: Deploy contracts
cd packages/contracts
pnpm deploy:local

# Terminal 3: Start Pay Gateway
cd packages/gateway
pnpm dev

# Terminal 4: Start Demo App
cd packages/demo
pnpm dev
```

## Configuration

### Network

- **Chain**: Polygon Amoy Testnet (Chain ID: 80002)
- **RPC**: https://rpc-amoy.polygon.technology

### Token

- **SUT Token**: `0xE4C687167705Abf55d709395f92e254bdF5825a2`

### Contracts (Polygon Amoy Testnet)

| Contract                | Address                                      |
| ----------------------- | -------------------------------------------- |
| PaymentGateway (Proxy)  | `0xF3a0661743cD5cF970144a4Ed022E27c05b33BB5` |
| PaymentGatewayV1 (Impl) | `0xDc40C3735163fEd63c198c3920B65B66DB54b1Bf` |
| ERC2771Forwarder        | `0xE8a3C8e530dddd14e02DA1C81Df6a15f41ad78DE` |

Block Explorer: [amoy.polygonscan.com](https://amoy.polygonscan.com/address/0xF3a0661743cD5cF970144a4Ed022E27c05b33BB5)

## SDK Usage (@globalmsq/solopay)

```typescript
import { SoloPayClient } from '@globalmsq/solopay';

// 초기화
const client = new SoloPayClient({
  environment: 'development', // 또는 'custom' + apiUrl
  apiKey: 'sk_test_abc123',
});

// 결제 생성 (상점서버에서 호출)
// Note: 결제금은 컨트랙트 배포 시 설정된 treasury 주소로 전송됨
const payment = await client.createPayment({
  merchantId: 'merchant_001',
  amount: 100,
  chainId: 31337,
  tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
});

// 상태 조회 (chainId 불필요 - 서버에서 자동 결정)
const status = await client.getPaymentStatus(payment.paymentId);
console.log(status.data.status); // "pending" | "completed"

// Gasless 거래 제출 (EIP-712 서명 필요)
const gaslessResult = await client.submitGasless({
  paymentId: payment.paymentId,
  forwarderAddress: '0x...', // ERC2771Forwarder 컨트랙트 주소
  forwardRequest: { from, to, value, gas, deadline, data, signature: '0x...' },
});

// Relay 거래 실행
const relayResult = await client.executeRelay({
  paymentId: payment.paymentId,
  transactionData: '0x...',
  gasEstimate: 100000,
});
```

**상세 문서**: [SDK README](./packages/gateway-sdk/README.ko.md)

## Payment Server API

### 엔드포인트

| 엔드포인트                 | 메서드 | 용도                                |
| -------------------------- | ------ | ----------------------------------- |
| `/payments/create`         | POST   | 결제 생성, paymentId 발급           |
| `/api/checkout`            | POST   | 상품 기반 결제 (Demo App API Route) |
| `/payments/:id/status`     | GET    | 결제 상태 조회 (chainId 자동 결정)  |
| `/payments/:id/gasless`    | POST   | Gasless 거래 제출                   |
| `/payments/:id/relay`      | POST   | 릴레이 거래 실행                    |
| `/payments/history`        | GET    | 결제 이력 조회 (payer 기반)         |
| `/tokens/balance`          | GET    | 토큰 잔액 조회                      |
| `/tokens/allowance`        | GET    | 토큰 approval 금액 조회             |
| `/transactions/:id/status` | GET    | 거래 상태 조회                      |

### 최근 추가 기능

#### Payment History API

사용자의 결제 이력을 블록체인 이벤트와 DB에서 조회합니다:

- **엔드포인트**: `GET /payments/history?chainId={}&payer={}&limit={}`
- **기능**: 결제자(payer) 주소 기반 이력 조회
- **응답**: 결제 목록 (Gasless 여부, Relay ID, Token decimals/symbol 포함)

#### Token Balance/Allowance API

ERC-20 토큰의 지갑 상태를 조회합니다:

- **엔드포인트**: `GET /tokens/balance?tokenAddress={addr}&address={wallet}`
- **기능**: 사용자 지갑의 토큰 잔액 조회
- **엔드포인트**: `GET /tokens/allowance?tokenAddress={addr}&owner={addr}&spender={addr}`
- **기능**: 토큰 approval 금액 조회

#### Transaction Status API

거래 상태와 확인 정보를 조회합니다:

- **엔드포인트**: `GET /transactions/:id/status`
- **기능**: 트랜잭션 해시로 상태, 블록 번호, 확인 수 조회
- **상태값**: `pending` (대기), `confirmed` (확인됨), `failed` (실패)

### 환경 변수

결제 서버의 주요 환경 변수:

| 변수            | 용도                         | 예시                                       |
| --------------- | ---------------------------- | ------------------------------------------ |
| `DATABASE_URL`  | MySQL 연결 문자열            | `mysql://user:pass@localhost:3306/solopay` |
| `REDIS_URL`     | Redis 연결 문자열 (선택사항) | `redis://localhost:6379`                   |
| `RELAY_API_URL` | Relayer 서비스 엔드포인트    | `http://simple-relayer:3001`               |
| `RELAY_API_KEY` | Relayer API 키 (프로덕션만)  | `sk_...`                                   |

> **참고**: 체인 설정(RPC URL, 컨트랙트 주소)은 데이터베이스 `chains` 테이블에서 관리되며 환경변수로 설정하지 않습니다. 자세한 내용은 [Pay Gateway README](./packages/gateway/README.ko.md#체인-설정)를 참고하세요.

## Documentation

- **[시작하기](./docs/getting-started.ko.md)** - Docker를 사용한 5분 설치 가이드
- **[결제 통합하기](./docs/guides/integrate-payment.ko.md)** - SDK 사용법, Direct/Gasless 결제
- **[서버 배포하기](./docs/guides/deploy-server.ko.md)** - 프로덕션 배포, 환경 설정
- **[기여하기](./docs/guides/contribute.ko.md)** - 프로젝트에 기여하기
- **[API 레퍼런스](./docs/reference/api.ko.md)** - 모든 API 엔드포인트, 요청/응답 포맷
- **[SDK 레퍼런스](./docs/reference/sdk.ko.md)** - SoloPayClient 메서드, 전체 TypeScript 타입
- **[아키텍처 가이드](./docs/reference/architecture.ko.md)** - 시스템 설계, 보안, 결제 흐름
- **[에러 코드](./docs/reference/errors.ko.md)** - 모든 에러 코드 및 해결 방법

## Tech Stack

| Component            | Technology                                                               |
| -------------------- | ------------------------------------------------------------------------ |
| Smart Contract       | Solidity 0.8.24, OpenZeppelin 5.x                                        |
| Contract Framework   | Hardhat                                                                  |
| Payment Server       | Node.js, Fastify v5, viem v2.21                                          |
| Payment Server Tests | Vitest, Pino structured logging                                          |
| SDK                  | TypeScript, Node 18+ native fetch (no dependencies)                      |
| SDK Tests            | Vitest, 100% coverage                                                    |
| Relay                | Relayer Service (개발: Simple Relayer / 프로덕션: OpenZeppelin Defender) |
| Demo App             | Next.js 14, wagmi, RainbowKit                                            |
| Package Manager      | pnpm                                                                     |

## License

MIT
