# SPEC-LOG-001: 인수 조건

---
id: SPEC-LOG-001
title: Console.log를 Pino 로거로 전환 - 인수 조건
status: draft
---

## 1. 테스트 시나리오

### TC-001: 로거 모듈 존재 확인

**Given** pay-server 프로젝트가 있을 때
**When** `src/lib/logger.ts` 파일을 확인하면
**Then** 파일이 존재해야 한다
**And** `createLogger`, `getLogLevel` 함수가 export되어야 한다

---

### TC-002: Console 문 완전 제거 확인

**Given** SPEC-LOG-001 구현이 완료되었을 때
**When** `grep -r "console\.(log|error|warn)" packages/pay-server/src/` 명령을 실행하면
**Then** 결과가 0건이어야 한다

---

### TC-003: 구조화된 로그 출력 확인

**Given** 로거 모듈이 생성되었을 때
**When** `createLogger('TestService').info({ key: 'value' }, 'test message')`를 호출하면
**Then** 출력에 `service: "TestService"` 필드가 포함되어야 한다
**And** 출력에 `key: "value"` 필드가 포함되어야 한다
**And** 출력에 `msg: "test message"` 필드가 포함되어야 한다

---

### TC-004: 환경별 로그 레벨 확인 - Development

**Given** `NODE_ENV=development`일 때
**When** 서버가 시작되면
**Then** 로그 레벨이 `debug`로 설정되어야 한다
**And** debug 레벨 로그가 출력되어야 한다

---

### TC-005: 환경별 로그 레벨 확인 - Production

**Given** `NODE_ENV=production`일 때
**When** 서버가 시작되면
**Then** 로그 레벨이 `info`로 설정되어야 한다
**And** debug 레벨 로그가 출력되지 않아야 한다

---

### TC-006: 환경별 로그 레벨 확인 - Test

**Given** `NODE_ENV=test`일 때
**When** 서버가 시작되면
**Then** 로그 레벨이 `silent`로 설정되어야 한다
**And** 어떤 로그도 출력되지 않아야 한다

---

### TC-007: 에러 객체 구조화 로깅 확인

**Given** 로거 모듈이 생성되었을 때
**When** `logger.error({ err: new Error('test error') }, 'operation failed')`를 호출하면
**Then** 출력에 `err` 객체가 포함되어야 한다
**And** `err` 객체에 `message`, `stack` 필드가 포함되어야 한다

---

### TC-008: Redis 연결 실패 로깅 확인

**Given** Redis 서버가 연결 불가 상태일 때
**When** 애플리케이션이 Redis에 연결을 시도하면
**Then** warn 레벨 로그가 출력되어야 한다
**And** 로그에 에러 메시지가 포함되어야 한다

---

### TC-009: 서버 시작 로깅 확인

**Given** pay-server 애플리케이션이 있을 때
**When** 서버가 시작되면
**Then** 체인 설정 로딩 로그가 출력되어야 한다
**And** 지원 체인 목록 로그가 출력되어야 한다
**And** 서버 시작 완료 로그가 출력되어야 한다

---

### TC-010: Graceful Shutdown 로깅 확인

**Given** pay-server가 실행 중일 때
**When** SIGTERM 신호를 수신하면
**Then** 종료 시작 로그가 출력되어야 한다
**And** 종료 완료 로그가 출력되어야 한다

---

### TC-011: DefenderService 트랜잭션 로깅 확인

**Given** DefenderService가 초기화되었을 때
**When** Gasless 트랜잭션이 제출되면
**Then** info 레벨 로그에 paymentId와 transactionId가 포함되어야 한다

---

### TC-012: BlockchainService 체인 초기화 로깅 확인

**Given** BlockchainService가 초기화될 때
**When** 각 체인이 설정되면
**Then** info 레벨 로그에 chainId, name, rpcUrl이 포함되어야 한다

---

## 2. 품질 게이트

### 2.1 코드 품질

| 항목 | 기준 |
|------|------|
| TypeScript 컴파일 | 에러 0개 |
| ESLint | 에러 0개 |
| console 문 잔존 | 0개 |

### 2.2 기능 품질

| 항목 | 기준 |
|------|------|
| 서버 시작 | 정상 시작 |
| 로그 출력 형식 | JSON 구조화 |
| 환경별 로그 레벨 | 정확히 동작 |
| 이모지/한국어 메시지 | 보존됨 |

### 2.3 호환성

| 항목 | 기준 |
|------|------|
| Node.js 18+ | 호환 |
| Fastify 5.x | 호환 |
| 기존 API 동작 | 변경 없음 |

---

## 3. 검증 방법

### 3.1 자동화 검증

```bash
# 1. console 문 잔존 검사
grep -r "console\.(log|error|warn)" packages/pay-server/src/
# 결과: 0건이어야 함

# 2. TypeScript 컴파일
pnpm --filter pay-server build
# 결과: 에러 없이 완료

# 3. 린트 검사
pnpm --filter pay-server lint
# 결과: 에러 없이 완료
```

### 3.2 수동 검증

**서버 시작 테스트:**

1. `pnpm --filter pay-server dev` 실행
2. 로그 출력 확인 (JSON 형식, 구조화된 필드)
3. 체인 초기화 로그 확인
4. 서버 시작 완료 로그 확인

**환경별 로그 레벨 테스트:**

1. `NODE_ENV=production pnpm --filter pay-server start` 실행
2. debug 레벨 로그가 출력되지 않음 확인
3. info 레벨 로그만 출력됨 확인

**Graceful Shutdown 테스트:**

1. 서버 실행 후 Ctrl+C 입력
2. 종료 로그 메시지 확인
3. 정상 종료 확인

---

## 4. Definition of Done

### 4.1 필수 조건

- [ ] `src/lib/logger.ts` 파일 생성 완료
- [ ] 모든 console.log/error/warn 문이 Pino 로거로 교체됨
- [ ] TypeScript 컴파일 에러 없음
- [ ] ESLint 에러 없음
- [ ] 서버 정상 시작 확인
- [ ] JSON 구조화 로그 출력 확인
- [ ] 환경별 로그 레벨 동작 확인

### 4.2 선택 조건

- [ ] request-id 포함 로깅 (선택)
- [ ] 체인 ID 컨텍스트 로깅 (선택)

### 4.3 문서화

- [ ] 코드 내 JSDoc 주석 작성
- [ ] 변경 사항 커밋 메시지에 SPEC-LOG-001 태그 포함

---

## 5. 요구사항 추적성

| 요구사항 | 테스트 케이스 | 상태 |
|----------|--------------|------|
| REQ-U-001 | TC-001, TC-002 | 대기 |
| REQ-U-002 | TC-002 | 대기 |
| REQ-U-003 | TC-003 | 대기 |
| REQ-E-001 | TC-004, TC-005, TC-006 | 대기 |
| REQ-E-002 | TC-007 | 대기 |
| REQ-E-003 | TC-011, TC-012 | 대기 |
| REQ-S-001 | TC-008 | 대기 |
| REQ-S-002 | TC-011 | 대기 |
| REQ-X-001 | TC-005 | 대기 |
| REQ-X-002 | 코드 리뷰 | 대기 |
