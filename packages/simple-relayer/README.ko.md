# Simple Relayer

[English](README.md) | [한국어](README.ko.md)

Simple Relayer는 로컬 개발 환경에서 프로덕션 Relayer API를 대체하는 경량 HTTP 서비스입니다. ERC2771Forwarder를 사용한 Meta-Transaction(Gasless Payment)을 처리합니다.

## 개요

로컬 개발 시 외부 Relayer 서비스 없이 Gasless 결제를 테스트할 수 있도록 동일한 API 인터페이스를 제공합니다.

**용도**:
- Docker Compose 로컬 개발 환경
- Hardhat 네트워크에서 Gasless 결제 테스트
- 프로덕션 Relayer API 호환 HTTP 서비스

**프로덕션 사용 불가**: 이 서비스는 개발용이며, 프로덕션에서는 전문 Relayer 서비스(예: OpenZeppelin Defender)를 사용해야 합니다.

## 주요 기능

- ✅ **Relayer API 호환**: `/txs` 엔드포인트로 프로덕션 Relayer와 동일한 인터페이스
- ✅ **ERC2771 Forwarder 지원**: Meta-Transaction 실행
- ✅ **서명 검증**: EIP-712 서명 검증
- ✅ **경량 구현**: Fastify + viem만 사용
- ✅ **Docker 지원**: Docker Compose 환경에서 즉시 사용 가능

## 기술 스택

| 구성요소 | 기술 | 버전 |
|----------|------|------|
| Framework | Fastify | ^5.0.0 |
| Blockchain | viem | ^2.21.0 |
| Runtime | Node.js | 18+ |
| Language | TypeScript | ^5.4.0 |
| Testing | Vitest | ^2.0.0 |

## 시작하기

### 설치

```bash
cd packages/simple-relayer
pnpm install
```

### 환경변수 설정

`.env` 파일 생성:

```bash
# Server Configuration
PORT=3001
LOG_LEVEL=info

# Blockchain
RPC_URL=http://hardhat:8545  # Docker 환경
# RPC_URL=http://localhost:8545  # 로컬 환경

# Relayer Wallet
RELAYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Forwarder Contract
FORWARDER_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
```

### 개발 서버 실행

```bash
# 개발 모드 (hot reload)
pnpm dev

# 프로덕션 빌드 및 실행
pnpm build
pnpm start
```

서버가 `http://localhost:3001`에서 실행됩니다.

## API 엔드포인트

### POST /txs

Meta-Transaction을 실행합니다. 프로덕션 Relayer API와 호환됩니다.

**요청**:
```bash
curl -X POST http://localhost:3001/txs \
  -H "Content-Type: application/json" \
  -d '{
    "to": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "data": "0x...",
    "speed": "fast",
    "gasLimit": 100000
  }'
```

**요청 파라미터**:
- `to` (required): Forwarder 컨트랙트 주소
- `data` (required): ERC2771Forwarder.execute() 호출 데이터 (인코딩된 ForwardRequest)
- `speed` (optional): 가스 가격 설정 (`safeLow`, `average`, `fast`, `fastest`) - 현재 무시됨
- `gasLimit` (optional): 가스 한도 - 현재 무시됨

**응답**:
```json
{
  "transactionId": "1a2b3c4d-5e6f-7g8h-9i0j-k1l2m3n4o5p6",
  "hash": "0x123abc...",
  "status": "mined",
  "chainId": 31337
}
```

**응답 필드**:
- `transactionId`: 고유 트랜잭션 ID (UUID)
- `hash`: 블록체인 트랜잭션 해시
- `status`: 트랜잭션 상태 (`pending`, `mined`, `failed`)
- `chainId`: 체인 ID

### GET /health

서버 헬스 체크

**요청**:
```bash
curl http://localhost:3001/health
```

**응답**:
```json
{
  "status": "ok",
  "timestamp": "2025-01-05T10:30:00.000Z"
}
```

## Docker 사용

### Docker Compose

`docker-compose.yml`에서 자동으로 실행됩니다:

```yaml
services:
  simple-relayer:
    build:
      context: ..
      dockerfile: docker/Dockerfile.packages
      target: simple-relayer
    ports:
      - "3001:3001"
    environment:
      PORT: 3001
      RPC_URL: http://hardhat:8545
      RELAYER_PRIVATE_KEY: ${RELAYER_PRIVATE_KEY}
      FORWARDER_ADDRESS: ${FORWARDER_ADDRESS}
    depends_on:
      - hardhat
```

### Docker 환경에서 실행

```bash
cd docker
docker-compose up -d simple-relayer

# 로그 확인
docker-compose logs -f simple-relayer
```

## Pay-Server와 연동

Pay-Server는 환경변수로 Relayer 서비스를 선택합니다:

```bash
# 로컬 개발 (Simple Relayer)
RELAYER_API_URL=http://simple-relayer:3001

# 프로덕션 (외부 Relayer 서비스)
RELAYER_API_URL=https://api.defender.openzeppelin.com
```

Pay-Server의 `RelayService`는 동일한 API를 호출하므로 코드 수정 없이 환경 전환이 가능합니다.

## 프로젝트 구조

```
packages/simple-relayer/
├── src/
│   ├── server.ts               # Fastify 서버 진입점
│   ├── index.ts                # 메인 export
│   ├── routes/
│   │   ├── relay.routes.ts     # POST /txs 라우트
│   │   └── health.routes.ts    # GET /health 라우트
│   └── services/
│       └── relay.service.ts    # Relay 실행 로직
├── tests/
│   └── relay.test.ts           # 테스트
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## 작동 방식

1. **요청 수신**: Pay-Server가 `/txs` 엔드포인트로 Meta-Transaction 요청
2. **데이터 디코딩**: `data` 필드에서 ForwardRequest 추출
3. **서명 검증**: ERC2771Forwarder에서 서명 유효성 확인
4. **트랜잭션 실행**: Relayer 지갑으로 `forwarder.execute()` 호출
5. **결과 반환**: 트랜잭션 해시 및 상태 반환

## 테스트

```bash
# 전체 테스트 실행
pnpm test

# 커버리지 리포트
pnpm test:coverage

# 타입 체크
pnpm typecheck
```

## 프로덕션 Relayer vs Simple Relayer

| 기능 | 프로덕션 Relayer | Simple Relayer |
|------|-----------------|----------------|
| **환경** | Production | Development |
| **인증** | API Key + Secret | 없음 |
| **가스 관리** | 자동 충전, 가스 가격 최적화 | 고정 (Hardhat 기본값) |
| **모니터링** | 대시보드, 알림 | 로그만 |
| **Nonce 관리** | 자동 | viem 자동 처리 |
| **재시도 로직** | 있음 | 없음 |
| **비용** | 유료 | 무료 |
| **설정** | 복잡 | 간단 |

## 보안 주의사항

⚠️ **프로덕션 사용 금지**: 이 서비스는 개발 전용입니다.

**개발 환경에서만 사용해야 하는 이유**:
- 인증 없음 (누구나 트랜잭션 실행 가능)
- 가스 관리 없음 (Relayer 잔액 고갈 가능)
- 에러 처리 최소화
- 모니터링 부재
- Nonce 충돌 가능성

**Relayer 개인키 관리**:
- 테스트 계정만 사용
- 실제 자산이 있는 계정 사용 금지
- `.env` 파일을 Git에 커밋하지 마세요

## 프로덕션 배포

프로덕션 환경에서는 반드시 전문 **Relayer 서비스**를 사용하세요 (예: OpenZeppelin Defender):

1. [OpenZeppelin Defender](https://defender.openzeppelin.com/) 계정 생성
2. Relayer 생성 및 API Key 발급
3. Pay-Server 환경변수 설정:
   ```bash
   RELAYER_API_URL=https://api.defender.openzeppelin.com
   RELAYER_API_KEY=your-api-key
   RELAYER_API_SECRET=your-api-secret
   ```

## 문서

- [아키텍처 문서](../../docs/reference/architecture.ko.md)
- [배포 가이드](../../docs/guides/deploy-server.ko.md)
- [OpenZeppelin Defender 문서](https://docs.openzeppelin.com/defender/)

## 라이선스

MIT License
