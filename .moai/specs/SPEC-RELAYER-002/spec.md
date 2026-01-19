# SPEC-RELAYER-002: simple-relayer API 호환성 구현

---
id: SPEC-RELAYER-002
title: simple-relayer와 msq-relayer-service API 호환성 구현
status: draft
created: 2025-12-26
author: workflow-spec
tags: [relayer, api-compatibility, refactoring, gasless-transaction]
---

## 개요

simple-defender 패키지를 simple-relayer로 리네이밍하고, msq-relayer-service와 100% API 호환성을 확보하여 pay-server가 URL 변경만으로 두 릴레이어 서비스 간 전환이 가능하도록 한다.

## 목표

1. **네이밍 통일**: defender 관련 모든 명칭을 relayer로 변경
2. **API 호환성**: msq-relayer-service의 API 스펙과 완전 호환
3. **무중단 전환**: pay-server가 RELAY_API_URL 환경변수만 변경하면 릴레이어 서비스 전환 가능
4. **하위 호환성 유지 불필요**: 기존 defender API는 제거하고 새로운 relayer API로 완전 교체

## 환경 (Environment)

### 현재 상태

- **패키지**: `packages/simple-defender/` (`@msqpay/simple-defender`)
- **서비스 클래스**: `DefenderService` (pay-server 내부)
- **환경변수**: `DEFENDER_API_URL`, `DEFENDER_API_KEY`, `DEFENDER_API_SECRET`
- **Docker 서비스명**: `simple-defender`

### 목표 상태

- **패키지**: `packages/simple-relayer/` (`@msqpay/simple-relayer`)
- **서비스 클래스**: `RelayerService` (pay-server 내부)
- **환경변수**: `RELAY_API_URL`, `RELAY_API_KEY`, `RELAYER_API_SECRET`
- **Docker 서비스명**: `simple-relayer`

### API 엔드포인트 변경

| 기능 | 현재 (simple-defender) | 목표 (msq-relayer-service 호환) |
|------|------------------------|--------------------------------|
| Direct Relay | `POST /relay` | `POST /api/v1/relay/direct` |
| Gasless Relay | `POST /relay/forward` | `POST /api/v1/relay/gasless` |
| 상태 조회 | `GET /relay/:id` | `GET /api/v1/relay/status/:txId` |
| Nonce 조회 | `GET /nonce/:address` | `GET /api/v1/relay/gasless/nonce/:address` |
| Health Check | `GET /health` | `GET /api/v1/health` |
| Relayer Info | `GET /relayer` | 제거 (health에 통합 또는 별도 결정) |

### Gasless Request Body 변경

**현재 형식 (simple-defender)**:
```json
{
  "forwardRequest": {
    "from": "0x...",
    "to": "0x...",
    "value": "0",
    "gas": "500000",
    "deadline": "1735200000",
    "data": "0x...",
    "signature": "0x..."
  },
  "gasLimit": "500000",
  "speed": "average"
}
```

**목표 형식 (msq-relayer-service)**:
```json
{
  "request": {
    "from": "0x...",
    "to": "0x...",
    "value": "0",
    "gas": "500000",
    "nonce": 0,
    "deadline": 1735200000,
    "data": "0x..."
  },
  "signature": "0x..."
}
```

**주요 변경사항**:
- `forwardRequest` -> `request`
- `signature`가 request 객체 외부로 이동
- `deadline` 타입: string -> number
- `nonce` 필드 추가 (필수)
- `gasLimit`, `speed` 필드 제거

### 인증 방식

- **헤더**: `X-API-Key` (msq-relayer-service 호환)
- **로컬 개발**: API Key 검증 생략 가능 (환경변수 설정에 따라)

## 가정 (Assumptions)

1. msq-relayer-service의 API 스펙이 확정되어 변경되지 않음
2. pay-server 외에 simple-defender를 직접 사용하는 다른 클라이언트 없음
3. 기존 simple-defender의 하위 호환성 유지 불필요
4. 모든 변경은 하나의 PR에서 atomic하게 진행

## 요구사항 (Requirements)

### Phase 0: 네이밍 리팩토링 (defender -> relayer)

**REQ-0.1**: 패키지 리네이밍
- WHEN 빌드 시스템이 패키지를 인식할 때
- THE SYSTEM SHALL packages/simple-defender를 packages/simple-relayer로 리네이밍한다
- THE SYSTEM SHALL package.json의 name을 @msqpay/simple-relayer로 변경한다

**REQ-0.2**: 서비스 클래스 리네이밍
- WHEN pay-server가 릴레이어 서비스를 사용할 때
- THE SYSTEM SHALL DefenderService를 RelayerService로 리네이밍한다
- THE SYSTEM SHALL 관련 타입(DefenderTxStatus, DefenderApiResponse)을 Relayer 접두사로 변경한다

**REQ-0.3**: 환경변수 리네이밍
- WHEN 시스템이 환경변수를 읽을 때
- THE SYSTEM SHALL DEFENDER_* 환경변수를 RELAYER_*로 변경한다
  - DEFENDER_API_URL -> RELAY_API_URL
  - DEFENDER_API_KEY -> RELAY_API_KEY
  - DEFENDER_API_SECRET -> RELAYER_API_SECRET

**REQ-0.4**: Docker 설정 업데이트
- WHEN Docker Compose가 서비스를 구성할 때
- THE SYSTEM SHALL simple-defender 서비스명을 simple-relayer로 변경한다
- THE SYSTEM SHALL Dockerfile.packages의 관련 target을 업데이트한다

**REQ-0.5**: 문서 업데이트
- WHEN 개발자가 문서를 참조할 때
- THE SYSTEM SHALL 모든 defender 관련 용어를 relayer로 변경한다
- THE SYSTEM SHALL API 문서, 설정 가이드, README 등을 업데이트한다

### Phase 1: API 라우트 변경

**REQ-1.1**: API 버전 프리픽스 추가
- WHEN 클라이언트가 API를 호출할 때
- THE SYSTEM SHALL 모든 엔드포인트에 /api/v1 프리픽스를 추가한다

**REQ-1.2**: Direct Relay 엔드포인트
- WHEN 클라이언트가 직접 릴레이를 요청할 때
- THE SYSTEM SHALL POST /api/v1/relay/direct 엔드포인트를 제공한다
- THE SYSTEM SHALL 기존 POST /relay와 동일한 기능을 수행한다

**REQ-1.3**: Gasless Relay 엔드포인트
- WHEN 클라이언트가 가스리스 릴레이를 요청할 때
- THE SYSTEM SHALL POST /api/v1/relay/gasless 엔드포인트를 제공한다
- THE SYSTEM SHALL msq-relayer-service 호환 request body를 처리한다

**REQ-1.4**: 상태 조회 엔드포인트
- WHEN 클라이언트가 트랜잭션 상태를 조회할 때
- THE SYSTEM SHALL GET /api/v1/relay/status/:txId 엔드포인트를 제공한다

**REQ-1.5**: Nonce 조회 엔드포인트
- WHEN 클라이언트가 nonce를 조회할 때
- THE SYSTEM SHALL GET /api/v1/relay/gasless/nonce/:address 엔드포인트를 제공한다

**REQ-1.6**: Health Check 엔드포인트
- WHEN 클라이언트가 서비스 상태를 확인할 때
- THE SYSTEM SHALL GET /api/v1/health 엔드포인트를 제공한다

### Phase 2: Request Body 변환

**REQ-2.1**: Gasless Request 필드 변경
- WHEN 가스리스 트랜잭션 요청이 들어올 때
- THE SYSTEM SHALL `forwardRequest` 대신 `request` 필드를 파싱한다
- THE SYSTEM SHALL `signature`를 request 객체 외부에서 읽는다

**REQ-2.2**: Deadline 타입 변환
- WHEN deadline 값을 처리할 때
- THE SYSTEM SHALL number 타입의 deadline을 받아 처리한다
- THE SYSTEM SHALL 내부적으로 BigInt 변환 시 적절히 처리한다

**REQ-2.3**: Nonce 필드 처리
- WHEN 가스리스 요청을 처리할 때
- THE SYSTEM SHALL request.nonce 필드를 필수로 요구한다
- THE SYSTEM SHALL nonce 값을 Forwarder 호출 시 사용한다

### Phase 3: pay-server 클라이언트 업데이트

**REQ-3.1**: RelayerService 클래스 업데이트
- WHEN pay-server가 릴레이어를 호출할 때
- THE SYSTEM SHALL 새로운 API 엔드포인트를 사용한다
- THE SYSTEM SHALL 새로운 request body 형식으로 요청을 전송한다

**REQ-3.2**: 환경변수 적용
- WHEN pay-server가 시작할 때
- THE SYSTEM SHALL RELAY_API_URL 환경변수를 사용한다
- THE SYSTEM SHALL RELAY_API_KEY 환경변수로 인증한다

### Phase 4: 인증 지원

**REQ-4.1**: X-API-Key 헤더 지원
- WHEN 클라이언트가 API를 호출할 때
- THE SYSTEM SHALL X-API-Key 헤더를 인식한다
- THE SYSTEM SHALL 환경변수로 설정된 API Key와 비교하여 인증한다

**REQ-4.2**: 로컬 개발 모드
- WHEN NODE_ENV=development일 때
- THE SYSTEM MAY API Key 검증을 생략할 수 있다

### Phase 5: Response 형식 통일

**REQ-5.1**: 표준 응답 형식
- WHEN API가 응답을 반환할 때
- THE SYSTEM SHALL msq-relayer-service와 동일한 응답 형식을 사용한다

**REQ-5.2**: 에러 응답 형식
- WHEN 에러가 발생할 때
- THE SYSTEM SHALL 표준화된 에러 응답 형식을 사용한다

## 사양 (Specifications)

### 영향 받는 파일 목록

**Phase 0 - 패키지 리네이밍**:
- `packages/simple-defender/` -> `packages/simple-relayer/` (디렉토리 전체)
- `packages/simple-defender/package.json` (패키지명 변경)
- `packages/pay-server/src/services/defender.service.ts` -> `relayer.service.ts`
- `packages/pay-server/src/index.ts` (import 경로 변경)
- `docker/docker-compose.yml` (서비스명, 환경변수)
- `docker/docker-compose-amoy.yml` (서비스명, 환경변수)
- `docker/Dockerfile.packages` (target명, 경로)
- `pnpm-workspace.yaml` (패키지 경로)

**Phase 0 - 문서 업데이트 (16개 파일)**:
- `docs/technical-spec.md`
- `docs/implementation-plan.md`
- `docs/architecture-payments.md`
- `docs/deployment/payments-setup.md`
- `docs/implementation/payments-api.md`
- `docs/api/error-codes.md`
- `README.md`
- `.moai/specs/SPEC-RELAY-001/spec.md`
- `.moai/specs/SPEC-RELAY-001/plan.md`
- `.moai/specs/SPEC-RELAY-001/acceptance.md`
- `.moai/specs/SPEC-SERVER-001/spec.md`
- `.moai/specs/SPEC-SERVER-001/plan.md`

**Phase 1-5 - API 변경**:
- `packages/simple-relayer/src/routes/relay.routes.ts`
- `packages/simple-relayer/src/routes/health.routes.ts`
- `packages/simple-relayer/src/services/relay.service.ts`
- `packages/simple-relayer/src/server.ts`
- `packages/pay-server/src/services/relayer.service.ts`
- `packages/pay-server/src/schemas/payment.schema.ts` (필요시)

### 테스트 전략

1. **로컬 테스트**: simple-relayer 변경 후 pay-server와 통합 테스트
2. **외부 테스트**: msq-relayer-service 연결 테스트 (URL만 변경하여 동작 확인)

### 마이그레이션 순서

1. Phase 0: 네이밍 리팩토링 (defender -> relayer)
2. Phase 1: simple-relayer API 라우트 변경
3. Phase 2: simple-relayer Request Body 변환
4. Phase 3: pay-server 클라이언트 업데이트
5. Phase 4: 인증 지원 추가
6. Phase 5: Response 형식 통일
7. 통합 테스트

## 추적성 (Traceability)

- **관련 SPEC**: SPEC-RELAY-001 (simple-defender 최초 구현)
- **관련 SPEC**: SPEC-SERVER-001 (pay-server 릴레이어 통합)
- **선행 작업**: 없음
- **후속 작업**: msq-relayer-service 연동 테스트

## 위험 요소 및 대응

### 위험 1: 빌드 실패
- **원인**: pnpm 워크스페이스 캐시에 이전 패키지명 잔존
- **대응**: pnpm store prune 및 clean install

### 위험 2: Docker 빌드 실패
- **원인**: 이미지 캐시에 이전 레이어 잔존
- **대응**: docker system prune 후 rebuild

### 위험 3: API 호환성 불일치
- **원인**: msq-relayer-service 스펙 변경
- **대응**: API 스펙 문서 확인 후 구현

## 제약사항 (Constraints)

- **하위 호환성**: 기존 defender API 하위 호환성 유지 불필요
- **외부 의존성**: msq-relayer-service API 스펙에 종속
- **테스트 환경**: 로컬 simple-relayer로 먼저 테스트, 이후 외부 서비스 테스트
