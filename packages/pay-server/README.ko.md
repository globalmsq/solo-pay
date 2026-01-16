# MSQ Pay Server

[English](README.md) | [한국어](README.ko.md)

MSQ Pay Server는 블록체인 기반 결제 시스템의 백엔드 API 서버입니다. Fastify 프레임워크와 viem을 사용하여 멀티체인 ERC-20 토큰 결제를 처리합니다.

## 주요 기능

- **멀티체인 지원**: 단일 서버로 여러 블록체인 네트워크 처리
- **멀티토큰 지원**: 체인별 다양한 ERC-20 토큰 결제
- **결제 방식**: Direct Payment 및 Gasless Payment (Meta-Transaction)
- **ERC2771 Forwarder**: EIP-712 서명 기반 Meta-Transaction
- **Stateless 아키텍처**: 스마트 컨트랙트를 Single Source of Truth로 사용
- **Redis 캐싱**: 블록체인 조회 결과 캐싱으로 성능 최적화
- **Prisma ORM**: MySQL 데이터베이스 관리

## 기술 스택

| 구성요소   | 기술            | 버전    |
| ---------- | --------------- | ------- |
| Framework  | Fastify         | ^5.0.0  |
| Blockchain | viem            | ^2.21.0 |
| Database   | MySQL + Prisma  | ^6.0.0  |
| Cache      | Redis + ioredis | ^5.4.0  |
| Validation | Zod             | ^3.23.0 |
| Runtime    | Node.js         | 18+     |
| Language   | TypeScript      | ^5.4.0  |
| Testing    | Vitest          | ^2.0.0  |

## 시작하기

### 환경 요구사항

- Node.js >= 18.0.0
- MySQL >= 8.0
- Redis >= 7.0 (선택사항, 캐싱용)

### 설치

```bash
cd packages/pay-server
pnpm install
```

### 환경변수 설정

`.env.example`을 복사하여 `.env` 파일을 생성합니다:

```bash
cp .env.example .env
```

필수 환경변수:

```bash
# Server Configuration
PORT=3001
HOST=0.0.0.0

# Database (MySQL)
DATABASE_URL=mysql://msqpay:pass@localhost:3306/msqpay
# 또는 개별 설정:
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=msqpay
MYSQL_PASSWORD=pass
MYSQL_DATABASE=msqpay

# Redis (Optional - 캐싱용)
REDIS_URL=redis://localhost:6379
# 또는 개별 설정:
REDIS_HOST=localhost
REDIS_PORT=6379

# Relayer Service
RELAYER_API_URL=http://simple-relayer:3001  # Local development
# RELAYER_API_URL=https://api.defender.openzeppelin.com  # Production
RELAYER_API_KEY=  # Production only
RELAYER_API_SECRET=  # Production only
```

> **참고**: 체인 설정(RPC URL, Contract 주소 등)은 데이터베이스의 `chains` 테이블에서 관리됩니다. 환경변수가 아닙니다.

### 데이터베이스 설정

```bash
# Prisma 마이그레이션 실행 (자동으로 generate도 실행됨)
pnpm prisma migrate dev
```

> **참고**: `prisma migrate dev`는 데이터베이스 마이그레이션 후 자동으로 `prisma generate`를 실행합니다.

### 개발 서버 실행

```bash
# 개발 모드 (hot reload)
pnpm dev

# 프로덕션 빌드
pnpm build

# 프로덕션 실행
pnpm start
```

서버가 `http://localhost:3001`에서 실행됩니다.

### 헬스 체크

```bash
curl http://localhost:3001/health
```

응답 예시:

```json
{
  "status": "ok",
  "timestamp": "2025-01-05T10:30:00.000Z",
  "uptime": 123.456
}
```

## API 엔드포인트

### 결제 API

- `POST /payments/create` - 결제 생성
- `GET /payments/:paymentId/status` - 결제 상태 조회
- `POST /payments/:paymentId/gasless` - Gasless 결제 제출
- `POST /payments/:paymentId/relay` - Relay 트랜잭션 실행
- `GET /payments/history` - 결제 내역 조회

### 체인 설정 API

- `GET /config/chains` - 지원 체인 목록 조회
- `GET /config/chains/:chainId` - 특정 체인 설정 조회

### 토큰 API

- `GET /tokens/balance` - 토큰 잔액 조회
- `GET /tokens/allowance` - 토큰 승인량 조회

자세한 API 문서는 [docs/reference/api.md](../../docs/reference/api.ko.md)를 참고하세요.

## 프로젝트 구조

```
packages/pay-server/
├── src/
│   ├── index.ts                 # 서버 진입점
│   ├── app.ts                   # Fastify 앱 설정
│   ├── config/
│   │   └── chains.ts            # 체인 설정 관리
│   ├── routes/
│   │   ├── payments.ts          # 결제 라우트
│   │   ├── config.ts            # 설정 라우트
│   │   └── tokens.ts            # 토큰 라우트
│   ├── services/
│   │   ├── blockchain.service.ts    # 블록체인 조회
│   │   ├── payment.service.ts       # 결제 로직
│   │   ├── relay.service.ts         # Relay 실행
│   │   ├── signature.service.ts     # EIP-712 서명 검증
│   │   ├── chain.service.ts         # 체인 관리
│   │   ├── token.service.ts         # 토큰 관리
│   │   ├── merchant.service.ts      # 상점 관리
│   │   └── nonce.service.ts         # Nonce 관리
│   ├── db/
│   │   ├── client.ts            # Prisma Client
│   │   └── redis.ts             # Redis Client
│   ├── schemas/
│   │   └── payment.schema.ts    # Zod 검증 스키마
│   └── types/
│       └── index.ts             # TypeScript 타입
├── tests/                       # 통합 테스트
├── prisma/
│   └── schema.prisma            # 데이터베이스 스키마
├── chains.testnet.json          # Testnet 체인 설정
├── chains.production.json       # Production 체인 설정
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## 체인 설정

MSQ Pay Server는 **완전한 멀티체인 아키텍처**를 지원합니다. 체인 설정은 데이터베이스에서 동적으로 관리됩니다.

### 동적 체인 관리

- 체인 정보는 MySQL `chains` 테이블에 저장
- 서버 시작 시 데이터베이스에서 자동 로드
- 코드 변경 없이 새 체인 추가 가능
- 모든 EVM 호환 체인 지원 (Ethereum, Polygon, BSC, Arbitrum, Optimism 등)

### 체인 추가 방법

데이터베이스에 INSERT하면 즉시 지원됩니다:

```sql
INSERT INTO chains (network_id, name, rpc_url, gateway_address, forwarder_address, is_testnet)
VALUES (
  42161,
  'Arbitrum One',
  'https://arb1.arbitrum.io/rpc',
  '0x...', -- PaymentGateway 컨트랙트 주소
  '0x...', -- ERC2771Forwarder 컨트랙트 주소
  FALSE
);
```

### 체인 활성화 요구사항

- `gateway_address`: PaymentGateway 컨트랙트 배포 필수
- `forwarder_address`: ERC2771Forwarder 컨트랙트 배포 필수
- `is_enabled = TRUE`: 체인 활성화
- `is_deleted = FALSE`: 체인 삭제 안 됨

### 초기 체인 데이터

Docker 환경에서는 `docker/init.sql`이 자동 실행되어 다음 체인이 초기화됩니다:

- Localhost (Hardhat) - 개발용
- Polygon Amoy - 테스트넷
- Sepolia, BSC Testnet - 준비 중
- Polygon, Ethereum, BSC - 프로덕션 (컨트랙트 배포 후)

## 테스트

```bash
# 전체 테스트 실행
pnpm test

# 커버리지 리포트
pnpm test:coverage

# 타입 체크
pnpm typecheck
```

### 테스트 커버리지

현재 테스트 커버리지: **82.89%**

- 단위 테스트: 65개 통과
- 통합 테스트: 포함

## 보안

### API Key 인증

상점 서버는 API Key로 인증합니다:

```bash
curl -H "x-api-key: sk_test_..." \
  http://localhost:3001/payments/create
```

### Relayer 보안

- Relayer 개인키는 환경변수로 관리
- 서명 검증을 통한 사용자 의도 확인
- Nonce 및 Deadline으로 재생 공격 방지

## Docker 실행

```bash
# Docker Compose로 전체 스택 실행
cd docker
docker-compose up -d

# 로그 확인
docker-compose logs -f pay-server
```

Docker 환경에서는 다음 서비스와 연동됩니다:

- MySQL (포트 3306)
- Redis (포트 6379)
- Simple Relayer (포트 3001)

## 배포

### Testnet 배포

1. 환경변수 설정 (`.env` 파일)
2. MySQL 및 Redis 준비
3. Prisma 마이그레이션 실행
4. 데이터베이스에 체인 및 토큰 데이터 INSERT
5. 서버 실행

### Production 배포

1. 환경변수 설정 (프로덕션 `.env`)
2. MySQL 및 Redis 클러스터 준비
3. 프로덕션 체인에 컨트랙트 배포
4. 데이터베이스에 프로덕션 체인 등록
5. Relayer 지갑에 충분한 네이티브 토큰
6. 로드 밸런서 및 모니터링 설정
7. 서버 실행

배포 가이드: [docs/guides/deploy-server.md](../../docs/guides/deploy-server.ko.md)

## 문서

- [API 레퍼런스](../../docs/reference/api.ko.md)
- [아키텍처 문서](../../docs/reference/architecture.ko.md)
- [배포 가이드](../../docs/guides/deploy-server.ko.md)

## 라이선스

MIT License
