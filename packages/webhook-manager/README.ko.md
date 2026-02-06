# Webhook Manager (`@solo-pay/webhook-manager`)

[English](README.md) | [한국어](README.ko.md)

결제 확정 시 머천트의 webhook URL로 `payment.confirmed` 웹훅을 전달하는 백그라운드 워커입니다. Gateway가 Redis(BullMQ)에 job을 넣으면, 이 서비스가 큐를 소비하며 각 머천트의 `webhook_url`로 HTTP POST를 보냅니다.

## 개요

결제가 확정되면(온체인 또는 상태 동기화) Gateway가 `solo-pay-webhook` 큐에 job을 추가합니다. Webhook Manager 워커가 job을 가져와 머천트 URL로 payload를 POST하고, 실패 시 10초, 30초, 90초 간격으로 재시도합니다.

**용도**:

- 웹훅 전송을 Gateway 요청 라이프사이클에서 분리
- 재시도 및 큐 지속(Redis)을 통한 안정적 전달
- 로컬(Docker), Amoy, 프로덕션 동일 플로우

## 주요 기능

- **BullMQ 큐**: Redis 기반 큐, 재시작 후에도 job 유지
- **재시도 정책**: 2xx가 아니거나 네트워크 오류 시 10초, 30초, 90초 후 최대 3회 재시도
- **단일 이벤트**: `payment.confirmed` (paymentId, orderId, status, txHash, amount, tokenSymbol, confirmedAt)
- **HTTP 서버 없음**: Redis에서만 소비하고 외부로 POST만 전송
- **Docker 지원**: `docker-compose.yaml`, `docker-compose-amoy.yaml`, `docker-compose-relayer.yaml`에 포함

## 기술 스택

| 구성요소 | 기술            |
| -------- | --------------- |
| 큐       | BullMQ (Redis)  |
| Redis    | ioredis ^5.4    |
| 런타임   | Node.js 18+     |
| 언어     | TypeScript ^5.4 |
| 테스트   | Vitest ^4       |

## 시작하기

### 설치

```bash
cd packages/webhook-manager
pnpm install
```

### 환경 변수

`.env.example`을 복사해 `.env`를 만들고 Redis 연결을 설정합니다.

```bash
cp .env.example .env
```

- **REDIS_URL**: (선택) 단일 연결 문자열 (예: `redis://localhost:6379`). 설정 시 REDIS_HOST/REDIS_PORT를 무시합니다.
- **REDIS_HOST**, **REDIS_PORT**: REDIS_URL이 없을 때 사용. 기본값: `localhost`, `6379`.
- **NODE_ENV**: (선택) `production`(info 로그), `development`(debug), `test`(silent).

### 실행

```bash
# 개발 (watch)
pnpm dev

# 프로덕션
pnpm build
pnpm start
```

워커가 Redis에 연결해 `solo-pay-webhook` 큐의 job을 처리합니다. HTTP 포트는 사용하지 않습니다.

## 연동

- **Gateway**: 결제가 CONFIRMED가 될 때(status 또는 payment-detail 동기화) `createWebhookQueue(redis)`와 `queue.addPaymentConfirmed({ url, body })`로 job 추가.
- **머천트**: JSON을 받는 POST 엔드포인트(예: `https://example.com/api/webhook`) 필요. body는 `PaymentConfirmedBody`(paymentId, orderId, status, txHash, amount, tokenSymbol, confirmedAt) 형식과 동일합니다.

## 스크립트

| 스크립트         | 설명                         |
| ---------------- | ---------------------------- |
| `pnpm build`     | TypeScript를 `dist/`로 빌드  |
| `pnpm start`     | 워커 실행 (`dist/worker.js`) |
| `pnpm dev`       | watch 모드로 워커 실행       |
| `pnpm test`      | Vitest 테스트 실행           |
| `pnpm typecheck` | 타입 검사만 수행             |

## 라이선스

MIT
