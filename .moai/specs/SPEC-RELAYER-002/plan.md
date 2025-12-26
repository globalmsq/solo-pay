# SPEC-RELAYER-002 구현 계획

---
id: SPEC-RELAYER-002
title: simple-relayer와 msq-relayer-service API 호환성 구현
phase: implementation-plan
---

## 마일스톤 개요

| Phase | 우선순위 | 설명 | 의존성 |
|-------|---------|------|--------|
| Phase 0 | Primary | 네이밍 리팩토링 (defender -> relayer) | 없음 |
| Phase 1 | Primary | API 라우트 변경 (/api/v1 프리픽스) | Phase 0 |
| Phase 2 | Primary | Request Body 변환 | Phase 1 |
| Phase 3 | Primary | pay-server 클라이언트 업데이트 | Phase 2 |
| Phase 4 | Secondary | 인증 지원 (X-API-Key) | Phase 3 |
| Phase 5 | Secondary | Response 형식 통일 | Phase 4 |
| Integration | Final | 통합 테스트 | Phase 5 |

## Phase 0: 네이밍 리팩토링 (Primary)

### 목표
모든 defender 관련 명칭을 relayer로 통일

### 작업 목록

**0.1 패키지 디렉토리 리네이밍**
- [ ] `packages/simple-defender/` -> `packages/simple-relayer/` 이동
- [ ] `packages/simple-defender/package.json` name을 `@msqpay/simple-relayer`로 변경
- [ ] `pnpm-workspace.yaml` 패키지 경로 확인 (필요시 업데이트)

**0.2 pay-server 서비스 클래스 리네이밍**
- [ ] `defender.service.ts` -> `relayer.service.ts` 파일명 변경
- [ ] `DefenderService` -> `RelayerService` 클래스명 변경
- [ ] `DefenderTxStatus` -> `RelayerTxStatus` 타입 변경
- [ ] `DefenderApiResponse` -> `RelayerApiResponse` 타입 변경
- [ ] `defenderService` -> `relayerService` 변수명 변경
- [ ] `packages/pay-server/src/index.ts` import 경로 수정

**0.3 환경변수 리네이밍**
- [ ] `DEFENDER_API_URL` -> `RELAYER_API_URL`
- [ ] `DEFENDER_API_KEY` -> `RELAYER_API_KEY`
- [ ] `DEFENDER_API_SECRET` -> `RELAYER_API_SECRET`
- [ ] pay-server 코드에서 환경변수 읽기 부분 수정

**0.4 Docker 설정 업데이트**
- [ ] `docker/docker-compose.yml`: simple-defender -> simple-relayer 서비스명
- [ ] `docker/docker-compose.yml`: 환경변수명 변경
- [ ] `docker/docker-compose-amoy.yml`: 동일 변경
- [ ] `docker/Dockerfile.packages`: simple-defender target -> simple-relayer
- [ ] `docker/Dockerfile.packages`: 경로 참조 수정

**0.5 문서 업데이트**
- [ ] `docs/technical-spec.md`
- [ ] `docs/implementation-plan.md`
- [ ] `docs/architecture-payments.md`
- [ ] `docs/deployment/payments-setup.md`
- [ ] `docs/implementation/payments-api.md`
- [ ] `docs/api/error-codes.md`
- [ ] `README.md`
- [ ] `.moai/specs/SPEC-RELAY-001/*` (3개 파일)
- [ ] `.moai/specs/SPEC-SERVER-001/*` (2개 파일)

**0.6 검증**
- [ ] `pnpm install` 성공
- [ ] `pnpm build` 성공 (simple-relayer)
- [ ] `pnpm build` 성공 (pay-server)
- [ ] Docker build 성공

## Phase 1: API 라우트 변경 (Primary)

### 목표
msq-relayer-service 호환 API 엔드포인트 구조 구현

### 작업 목록

**1.1 라우트 파일 구조 변경**
- [ ] `routes/relay.routes.ts` 수정 (또는 신규 파일 생성)
- [ ] 모든 라우트에 `/api/v1` 프리픽스 추가
- [ ] 라우트 등록 방식 변경 (`server.ts` 수정)

**1.2 엔드포인트 변경**
- [ ] `POST /relay` -> `POST /api/v1/relay/direct`
- [ ] `POST /relay/forward` -> `POST /api/v1/relay/gasless`
- [ ] `GET /relay/:id` -> `GET /api/v1/relay/status/:txId`
- [ ] `GET /nonce/:address` -> `GET /api/v1/relay/gasless/nonce/:address`
- [ ] `GET /health` -> `GET /api/v1/health`
- [ ] `GET /relayer` 제거 또는 health에 통합

**1.3 검증**
- [ ] 단위 테스트 통과
- [ ] API 엔드포인트 호출 테스트

## Phase 2: Request Body 변환 (Primary)

### 목표
msq-relayer-service 호환 request body 형식 구현

### 작업 목록

**2.1 Gasless Request 스키마 변경**
- [ ] 새로운 요청 인터페이스 정의:
  ```typescript
  interface GaslessRelayRequest {
    request: {
      from: Address;
      to: Address;
      value: string;
      gas: string;
      nonce: number;
      deadline: number;
      data: Hex;
    };
    signature: Hex;
  }
  ```
- [ ] Fastify 스키마 업데이트
- [ ] 기존 `ForwardRelayRequest` 인터페이스 제거

**2.2 서비스 레이어 수정**
- [ ] `RelayService.submitForwardRequest()` 메서드 시그니처 변경
- [ ] 새로운 request 형식 처리 로직 구현
- [ ] nonce 필드 활용 (검증 또는 로깅)

**2.3 타입 정의 정리**
- [ ] 레거시 타입 정의 제거
- [ ] 새로운 타입 정의로 통일

**2.4 검증**
- [ ] 단위 테스트 통과
- [ ] 통합 테스트 통과

## Phase 3: pay-server 클라이언트 업데이트 (Primary)

### 목표
pay-server의 RelayerService가 새로운 API를 사용하도록 수정

### 작업 목록

**3.1 API 호출 경로 변경**
- [ ] `submitGaslessTransaction()`: `/relay` -> `/api/v1/relay/direct`
- [ ] `submitForwardTransaction()`: `/relay/forward` -> `/api/v1/relay/gasless`
- [ ] `getRelayStatus()`: `/relay/:id` -> `/api/v1/relay/status/:txId`
- [ ] `getNonce()`: `/nonce/:address` -> `/api/v1/relay/gasless/nonce/:address`
- [ ] `checkRelayerHealth()`: `/health` -> `/api/v1/health`

**3.2 Request Body 형식 변경**
- [ ] `submitForwardTransaction()` 메서드:
  - `forwardRequest` -> `request`
  - `signature` 위치 변경
  - `deadline` 타입 number로 변경
  - `nonce` 필드 추가

**3.3 환경변수 적용**
- [ ] `RELAYER_API_URL` 사용
- [ ] `RELAYER_API_KEY` 사용

**3.4 검증**
- [ ] pay-server 빌드 성공
- [ ] 통합 테스트 통과

## Phase 4: 인증 지원 (Secondary)

### 목표
X-API-Key 헤더 기반 인증 구현

### 작업 목록

**4.1 인증 미들웨어 추가**
- [ ] `X-API-Key` 헤더 추출
- [ ] 환경변수 `RELAYER_API_KEY`와 비교
- [ ] 불일치 시 401 응답

**4.2 개발 모드 예외 처리**
- [ ] `NODE_ENV=development`일 때 인증 생략 옵션
- [ ] 환경변수 `RELAYER_SKIP_AUTH=true` 옵션

**4.3 pay-server 인증 헤더 추가**
- [ ] `RelayerService.getHeaders()`에 `X-API-Key` 추가
- [ ] 기존 `X-Api-Key`, `X-Api-Secret` 제거

**4.4 검증**
- [ ] 인증 성공/실패 테스트
- [ ] 개발 모드 동작 테스트

## Phase 5: Response 형식 통일 (Secondary)

### 목표
msq-relayer-service와 동일한 응답 형식 구현

### 작업 목록

**5.1 성공 응답 형식 통일**
- [ ] msq-relayer-service 응답 형식 분석
- [ ] simple-relayer 응답 형식 일치화

**5.2 에러 응답 형식 통일**
- [ ] 표준 에러 응답 형식 정의
- [ ] 에러 코드 매핑

**5.3 검증**
- [ ] 응답 형식 테스트

## Integration: 통합 테스트 (Final)

### 목표
전체 시스템 통합 검증

### 작업 목록

**Integration.1 로컬 테스트**
- [ ] Docker Compose로 전체 스택 실행
- [ ] pay-server -> simple-relayer 통합 테스트
- [ ] Gasless 트랜잭션 End-to-End 테스트

**Integration.2 외부 서비스 테스트**
- [ ] RELAYER_API_URL을 msq-relayer-service로 변경
- [ ] 동일한 테스트 시나리오 실행
- [ ] 호환성 확인

## 기술적 접근 방식

### 리팩토링 전략

1. **Atomic 변경**: 모든 변경을 하나의 PR에서 진행하여 중간 상태 방지
2. **빌드 우선**: 각 Phase 완료 후 빌드 성공 확인
3. **테스트 기반**: 변경 후 기존 테스트 및 신규 테스트 통과 확인

### 파일 변경 순서

1. 패키지 디렉토리 이동 (git mv)
2. package.json 수정
3. 소스 코드 수정 (서비스, 라우트, 타입)
4. Docker 설정 수정
5. 문서 업데이트
6. 테스트 실행

### 롤백 계획

- 모든 변경은 feature 브랜치에서 진행
- 문제 발생 시 브랜치 삭제 후 main에서 재시작
- git mv 사용으로 파일 이력 보존

## 아키텍처 설계

### 레이어 구조

```
pay-server
    |
    v
RelayerService (HTTP Client)
    |
    v
simple-relayer (or msq-relayer-service)
    |
    v
ERC2771Forwarder Contract
    |
    v
Blockchain
```

### API 호환성 레이어

```
msq-relayer-service API Spec
    ^
    |
simple-relayer (100% 호환)
    ^
    |
RelayerService Client
```

## 리스크 및 대응

### 리스크 1: pnpm 캐시 문제
- **증상**: 빌드 실패, 패키지 찾기 실패
- **대응**: `pnpm store prune && rm -rf node_modules && pnpm install`

### 리스크 2: Docker 캐시 문제
- **증상**: 이전 이미지 레이어 사용
- **대응**: `docker system prune -a && docker-compose build --no-cache`

### 리스크 3: TypeScript 컴파일 에러
- **증상**: 타입 불일치
- **대응**: 단계별 타입 수정, any 임시 사용 후 정리

## 완료 기준

1. [ ] 모든 defender 용어가 relayer로 변경됨
2. [ ] simple-relayer가 msq-relayer-service API 스펙과 100% 호환됨
3. [ ] pay-server가 RELAYER_API_URL만 변경하면 릴레이어 전환 가능함
4. [ ] 모든 테스트 통과
5. [ ] Docker Compose로 전체 스택 정상 동작
