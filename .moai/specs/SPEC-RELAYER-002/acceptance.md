# SPEC-RELAYER-002 인수 기준

---
id: SPEC-RELAYER-002
title: simple-relayer와 msq-relayer-service API 호환성 구현
phase: acceptance-criteria
---

## 테스트 시나리오

### TC-0: 네이밍 리팩토링 검증

**TC-0.1**: 패키지 빌드 성공

- **Given**: packages/simple-relayer 디렉토리가 존재하고 package.json의 name이 @msqpay/simple-relayer임
- **When**: pnpm build 명령을 실행함
- **Then**: 빌드가 성공하고 dist/ 디렉토리에 결과물이 생성됨

**TC-0.2**: pay-server 빌드 성공

- **Given**: RelayerService 클래스로 리네이밍되고 import 경로가 수정됨
- **When**: pnpm build 명령을 실행함
- **Then**: 빌드가 성공함

**TC-0.3**: Docker 빌드 성공

- **Given**: docker-compose.yml에서 simple-relayer 서비스가 정의됨
- **When**: docker-compose build 명령을 실행함
- **Then**: 모든 이미지 빌드가 성공함

**TC-0.4**: 환경변수 적용 확인

- **Given**: RELAYER_API_URL 환경변수가 설정됨
- **When**: pay-server가 시작됨
- **Then**: RelayerService가 해당 URL을 사용하여 연결함

### TC-1: API 엔드포인트 변경 검증

**TC-1.1**: Direct Relay 엔드포인트

- **Given**: simple-relayer 서비스가 실행 중임
- **When**: POST /api/v1/relay/direct 요청을 보냄
- **Then**: 200 OK와 함께 transactionId를 반환함

**TC-1.2**: Gasless Relay 엔드포인트

- **Given**: simple-relayer 서비스가 실행 중임
- **When**: POST /api/v1/relay/gasless 요청을 보냄
- **Then**: 200 OK와 함께 transactionId를 반환함

**TC-1.3**: 상태 조회 엔드포인트

- **Given**: 트랜잭션이 제출되어 txId가 존재함
- **When**: GET /api/v1/relay/status/:txId 요청을 보냄
- **Then**: 트랜잭션 상태 정보를 반환함

**TC-1.4**: Nonce 조회 엔드포인트

- **Given**: simple-relayer 서비스가 실행 중임
- **When**: GET /api/v1/relay/gasless/nonce/:address 요청을 보냄
- **Then**: 해당 주소의 nonce 값을 반환함

**TC-1.5**: Health Check 엔드포인트

- **Given**: simple-relayer 서비스가 실행 중임
- **When**: GET /api/v1/health 요청을 보냄
- **Then**: 서비스 상태 정보를 반환함

**TC-1.6**: 레거시 엔드포인트 제거 확인

- **Given**: simple-relayer 서비스가 실행 중임
- **When**: GET /relay 또는 POST /relay/forward 요청을 보냄
- **Then**: 404 Not Found를 반환함

### TC-2: Request Body 형식 검증

**TC-2.1**: Gasless Request 새로운 형식

- **Given**: simple-relayer 서비스가 실행 중임
- **When**: 다음 형식의 POST /api/v1/relay/gasless 요청을 보냄:
  ```json
  {
    "request": {
      "from": "0x1234....",
      "to": "0x5678....",
      "value": "0",
      "gas": "500000",
      "nonce": 0,
      "deadline": 1735200000,
      "data": "0xabcd...."
    },
    "signature": "0xsig...."
  }
  ```
- **Then**: 요청이 정상 처리되고 transactionId를 반환함

**TC-2.2**: deadline 타입 검증

- **Given**: simple-relayer 서비스가 실행 중임
- **When**: deadline 필드에 number 타입 값을 전달함
- **Then**: 요청이 정상 처리됨

**TC-2.3**: nonce 필드 필수 검증

- **Given**: simple-relayer 서비스가 실행 중임
- **When**: nonce 필드 없이 요청을 보냄
- **Then**: 400 Bad Request를 반환함

**TC-2.4**: signature 위치 검증

- **Given**: simple-relayer 서비스가 실행 중임
- **When**: signature가 request 객체 외부에 위치한 요청을 보냄
- **Then**: 요청이 정상 처리됨

### TC-3: pay-server 통합 검증

**TC-3.1**: RelayerService URL 변경

- **Given**: RELAYER_API_URL이 simple-relayer URL로 설정됨
- **When**: pay-server에서 가스리스 트랜잭션을 요청함
- **Then**: simple-relayer로 정상 전달됨

**TC-3.2**: RelayerService Request Body

- **Given**: pay-server가 실행 중임
- **When**: ForwardRequest를 통한 가스리스 결제를 실행함
- **Then**: 새로운 request body 형식으로 simple-relayer에 전송됨

**TC-3.3**: 환경변수 전환 테스트

- **Given**: pay-server가 실행 중임
- **When**: RELAYER_API_URL을 msq-relayer-service URL로 변경함
- **Then**: 코드 수정 없이 msq-relayer-service와 통신함

### TC-4: 인증 검증

**TC-4.1**: X-API-Key 인증 성공

- **Given**: RELAYER_API_KEY가 설정됨
- **When**: 올바른 X-API-Key 헤더와 함께 요청을 보냄
- **Then**: 요청이 정상 처리됨

**TC-4.2**: X-API-Key 인증 실패

- **Given**: RELAYER_API_KEY가 설정됨
- **When**: 잘못된 X-API-Key 헤더와 함께 요청을 보냄
- **Then**: 401 Unauthorized를 반환함

**TC-4.3**: 개발 모드 인증 생략

- **Given**: NODE_ENV=development 또는 RELAYER_SKIP_AUTH=true
- **When**: X-API-Key 헤더 없이 요청을 보냄
- **Then**: 요청이 정상 처리됨

### TC-5: End-to-End 테스트

**TC-5.1**: 전체 스택 Docker Compose 실행

- **Given**: docker-compose.yml이 업데이트됨
- **When**: docker-compose up 명령을 실행함
- **Then**: 모든 서비스가 정상 시작됨

**TC-5.2**: Gasless 결제 E2E

- **Given**: 전체 스택이 실행 중임
- **When**: Demo 앱에서 가스리스 결제를 실행함
- **Then**: 결제가 성공적으로 완료됨

**TC-5.3**: 릴레이어 전환 E2E

- **Given**: 전체 스택이 실행 중임
- **When**: RELAYER_API_URL을 외부 msq-relayer-service로 변경함
- **Then**: 동일한 결제 플로우가 정상 동작함

## 품질 게이트 기준

### 빌드 품질

- [ ] pnpm build 성공 (모든 패키지)
- [ ] TypeScript 컴파일 에러 0개
- [ ] ESLint 에러 0개

### 테스트 커버리지

- [ ] 단위 테스트 통과율 100%
- [ ] 통합 테스트 통과율 100%

### API 호환성

- [ ] msq-relayer-service API 스펙 100% 준수
- [ ] 레거시 엔드포인트 완전 제거

### 문서화

- [ ] 모든 defender 용어가 relayer로 변경됨
- [ ] API 문서가 새로운 엔드포인트를 반영함
- [ ] 환경변수 문서가 업데이트됨

## 완료 정의 (Definition of Done)

1. **코드 완성**
   - [ ] 모든 Phase 작업 완료
   - [ ] 코드 리뷰 완료
   - [ ] 모든 테스트 통과

2. **빌드 검증**
   - [ ] 로컬 빌드 성공
   - [ ] Docker 빌드 성공

3. **테스트 검증**
   - [ ] TC-0 ~ TC-5 모든 테스트 케이스 통과
   - [ ] 로컬 환경 E2E 테스트 통과
   - [ ] (선택) 외부 msq-relayer-service 연동 테스트 통과

4. **문서화**
   - [ ] SPEC 문서 최종 업데이트
   - [ ] 영향받는 모든 문서 업데이트
   - [ ] CHANGELOG 업데이트

5. **배포 준비**
   - [ ] main 브랜치에 머지
   - [ ] 버전 태그 생성 (필요시)

## 검증 방법

### 로컬 테스트 실행

```bash
# 1. 패키지 빌드 테스트
cd packages/simple-relayer
pnpm build
pnpm test

# 2. pay-server 빌드 테스트
cd packages/pay-server
pnpm build
pnpm test

# 3. Docker 빌드 테스트
cd docker
docker-compose build

# 4. 전체 스택 실행
docker-compose up -d

# 5. API 엔드포인트 테스트
curl http://localhost:3002/api/v1/health
curl -X POST http://localhost:3002/api/v1/relay/gasless -H "Content-Type: application/json" -d '...'
```

### 외부 서비스 테스트

```bash
# 1. 환경변수 변경
export RELAYER_API_URL=https://msq-relayer-service-url

# 2. pay-server 재시작
docker-compose restart server

# 3. 동일한 테스트 실행
# ...
```
