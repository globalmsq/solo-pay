# SPEC-RELAY-001: 인수 기준

## TAG BLOCK

- SPEC-ID: SPEC-RELAY-001
- Document: Acceptance Criteria
- Version: 3.0.0
- Created: 2025-12-01
- Updated: 2025-12-02

## 인수 기준 개요

환경별 하이브리드 Gasless 트랜잭션 시스템 구현의 완료 조건과 품질 검증 기준을 정의합니다. 모든 인수 기준은 Given-When-Then 형식으로 작성됩니다.

## 환경별 아키텍처 인수 기준

### AC-001: 환경별 Relay 서비스 선택 (Local)

Given: USE_MOCK_DEFENDER=true 환경 변수가 설정되어 있을 때
When: RelayFactory.createRelayService()를 호출하면
Then: MockDefender 인스턴스가 반환되어야 합니다
And: MockDefender는 OZ Defender SDK와 동일한 인터페이스를 제공해야 합니다

검증 방법:
- 환경 변수 설정 후 서비스 타입 확인
- 인터페이스 호환성 테스트

### AC-002: 환경별 Relay 서비스 선택 (Testnet/Mainnet)

Given: USE_MOCK_DEFENDER=false 또는 미설정 환경에서
When: RelayFactory.createRelayService()를 호출하면
Then: OZ Defender SDK 인스턴스가 반환되어야 합니다
And: DEFENDER_API_KEY, DEFENDER_API_SECRET이 필요합니다

검증 방법:
- 환경 변수 미설정 시 OZ Defender 선택 확인
- API 자격증명 검증

## MockDefender 패키지 인수 기준

### AC-003: MockDefender 초기화

Given: MockDefender 패키지가 설치되어 있고
And: Forwarder 주소와 Relayer 개인키가 설정되어 있을 때
When: MockDefender 인스턴스를 생성하면
Then: relaySigner 속성이 초기화되어야 합니다
And: OZ Defender SDK와 동일한 구조를 가져야 합니다

검증 방법:
- 인스턴스 생성 테스트
- 구조 비교 테스트

### AC-004: MockRelaySigner.sendTransaction()

Given: MockDefender가 초기화되어 있고
And: 유효한 ForwardRequest가 준비되어 있을 때
When: relaySigner.sendTransaction(request)를 호출하면
Then: Forwarder.execute()가 호출되어야 합니다
And: transactionId와 hash가 반환되어야 합니다
And: OZ Defender SDK 응답 형식과 동일해야 합니다

검증 방법:
- 트랜잭션 제출 테스트
- 응답 형식 검증

### AC-005: MockRelaySigner.getTransaction()

Given: 트랜잭션이 제출되어 있을 때
When: relaySigner.getTransaction(transactionId)를 호출하면
Then: 현재 트랜잭션 상태를 반환해야 합니다
And: OZ Defender SDK 응답 형식과 동일해야 합니다

상태별 검증:
- pending: 트랜잭션이 아직 마이닝되지 않음
- mined: 트랜잭션이 블록에 포함됨
- confirmed: 1개 이상의 confirmation
- failed: 트랜잭션이 revert됨

## EIP-712 서명 검증 인수 기준

### AC-006: 유효한 EIP-712 서명 검증

Given: 유효한 EIP-712 서명이 생성되어 있고
And: 서명이 올바른 도메인과 타입으로 생성되었을 때
When: SignatureService.verifySignature(request, signature)를 호출하면
Then: true를 반환해야 합니다
And: 예외가 발생하지 않아야 합니다

검증 방법:
- viem signTypedData로 테스트 서명 생성
- verifySignature 호출 및 결과 확인

### AC-007: 무효한 EIP-712 서명 검증

Given: 무효한 서명이 제공되었을 때 (잘못된 개인키, 변조된 데이터 등)
When: SignatureService.verifySignature(request, signature)를 호출하면
Then: InvalidSignatureError가 발생해야 합니다
And: 에러 메시지에 "서명이 유효하지 않습니다"가 포함되어야 합니다

검증 케이스:
- 잘못된 개인키로 서명된 경우
- request 데이터가 변조된 경우
- 다른 도메인으로 서명된 경우

### AC-008: Nonce 조회

Given: Forwarder 컨트랙트가 배포되어 있고
And: 특정 사용자 주소가 주어졌을 때
When: NonceService.getNonce(address)를 호출하면
Then: 해당 주소의 현재 nonce를 문자열로 반환해야 합니다
And: 반환된 nonce는 0 이상의 정수여야 합니다

검증 방법:
- 컨트랙트 nonces() 함수 호출 확인
- 반환 타입 검증

## API 엔드포인트 인수 기준

### AC-009: GET /api/relay/nonce/:address

Given: 유효한 Ethereum 주소가 경로 파라미터로 제공될 때
When: GET /api/relay/nonce/:address를 호출하면
Then: 200 OK와 함께 { nonce: string } 형식의 응답을 반환해야 합니다

검증 방법:
- curl 또는 API 테스트 도구로 호출
- 응답 형식 확인

### AC-010: POST /api/payments/gasless - 성공 (Local)

Given: USE_MOCK_DEFENDER=true 환경에서
And: 유효한 ForwardRequest와 signature가 요청 본문에 포함되어 있을 때
When: POST /api/payments/gasless를 호출하면
Then: MockDefender를 통해 트랜잭션이 제출되어야 합니다
And: 200 OK와 함께 transactionHash를 포함한 응답을 반환해야 합니다

요청 형식:
```
{
  "request": {
    "from": "0x...",
    "to": "0x...",
    "value": "0",
    "gas": "200000",
    "nonce": "0",
    "deadline": "...",
    "data": "0x..."
  },
  "signature": "0x..."
}
```

응답 형식:
```
{
  "transactionHash": "0x...",
  "status": "pending"
}
```

### AC-011: POST /api/payments/gasless - 성공 (Testnet/Mainnet)

Given: USE_MOCK_DEFENDER=false 환경에서
And: 유효한 ForwardRequest와 signature가 요청 본문에 포함되어 있을 때
When: POST /api/payments/gasless를 호출하면
Then: OZ Defender SDK를 통해 트랜잭션이 제출되어야 합니다
And: 200 OK와 함께 transactionHash를 포함한 응답을 반환해야 합니다

### AC-012: POST /api/payments/gasless - 유효성 검사 실패

Given: 잘못된 형식의 요청이 전송될 때
When: POST /api/payments/gasless를 호출하면
Then: 400 Bad Request와 적절한 에러 메시지를 반환해야 합니다

검증 케이스:
- request 객체 누락
- signature 누락
- 잘못된 주소 형식
- 잘못된 nonce 형식

## Docker Compose 통합 인수 기준

### AC-013: Local 환경 변수 설정

Given: docker-compose.yml이 업데이트되어 있을 때
When: docker-compose up 명령을 실행하면
Then: server 컨테이너에 다음 환경 변수가 설정되어야 합니다

필수 환경 변수:
- USE_MOCK_DEFENDER=true
- FORWARDER_ADDRESS: ERC2771Forwarder 컨트랙트 주소
- RELAYER_PRIVATE_KEY: Relayer 지갑 개인키
- RELAYER_ADDRESS: Relayer 지갑 주소
- RPC_URL: Hardhat 노드 URL
- CHAIN_ID: 네트워크 체인 ID

검증 방법:
- docker exec로 환경 변수 확인
- docker-compose config로 설정 검증

### AC-014: Local 환경 전체 플로우 E2E 테스트

Given: Docker Compose 환경이 실행 중이고
And: USE_MOCK_DEFENDER=true가 설정되어 있고
And: ERC2771Forwarder가 배포되어 있고
And: PaymentGatewayV1의 trustedForwarder가 설정되어 있을 때
When: 클라이언트가 EIP-712 서명을 생성하고 /api/payments/gasless로 요청을 보내면
Then: MockDefender를 통해 Forwarder.execute()가 호출되어야 합니다
And: PaymentGatewayV1에서 _msgSender()가 사용자 주소를 반환해야 합니다
And: 트랜잭션 해시가 응답으로 반환되어야 합니다

검증 방법:
- 테스트 스크립트로 전체 플로우 실행
- Hardhat 노드 로그에서 트랜잭션 확인
- 이벤트 로그에서 sender 주소 검증

### AC-015: Testnet 환경 설정 검증

Given: Testnet 환경용 설정이 준비되어 있을 때
When: USE_MOCK_DEFENDER=false로 서버를 시작하면
Then: OZ Defender SDK가 초기화되어야 합니다
And: DEFENDER_API_KEY, DEFENDER_API_SECRET이 검증되어야 합니다

필수 환경 변수:
- USE_MOCK_DEFENDER=false (또는 미설정)
- DEFENDER_API_KEY: OZ Defender API 키
- DEFENDER_API_SECRET: OZ Defender API 시크릿
- DEFENDER_RELAYER_ADDRESS: OZ Defender Relayer 주소
- FORWARDER_ADDRESS: Forwarder 컨트랙트 주소 (Testnet 배포)

## 보안 인수 기준

### AC-016: 서명 없는 요청 거부

Given: signature가 누락된 요청이 전송될 때
When: /api/payments/gasless를 호출하면
Then: 요청이 거부되어야 합니다
And: 400 또는 401 에러가 반환되어야 합니다

### AC-017: 변조된 요청 거부

Given: 서명 후 request 데이터가 변조되었을 때
When: SignatureService.verifySignature()가 호출되면
Then: 서명 검증이 실패해야 합니다
And: 트랜잭션이 실행되지 않아야 합니다

### AC-018: Nonce 재생 공격 방지

Given: 트랜잭션이 한 번 성공적으로 실행되었을 때
When: 동일한 request와 signature로 다시 요청하면
Then: Forwarder 컨트랙트에서 revert되어야 합니다
And: NonceInvalidError 또는 ForwarderExecutionError가 발생해야 합니다

검증 방법:
- 동일 요청 두 번 실행 시도
- 두 번째 실행 실패 확인

### AC-019: PaymentGatewayV1 _msgSender() 검증

Given: Forwarder를 통해 PaymentGatewayV1 함수가 호출될 때
When: PaymentGatewayV1 내부에서 _msgSender()를 호출하면
Then: Relayer 주소가 아닌 원래 사용자 주소가 반환되어야 합니다

검증 방법:
- 테스트 트랜잭션 실행
- 이벤트 로그에서 sender 주소 확인
- 사용자 주소와 일치 확인

## 비기능 인수 기준

### AC-020: 타입 안전성

Given: TypeScript strict 모드가 활성화되어 있을 때
When: 전체 프로젝트를 빌드하면
Then: 타입 에러 없이 빌드가 완료되어야 합니다

검증 방법:
- pnpm build 성공
- tsc --noEmit 성공

### AC-021: 테스트 커버리지

Given: MockDefender 및 관련 서비스 테스트가 작성되어 있을 때
When: 테스트 커버리지를 측정하면
Then: 새로 작성된 코드의 커버리지가 80% 이상이어야 합니다

검증 방법:
- vitest --coverage 실행
- 커버리지 리포트 확인

### AC-022: 문서화

Given: MockDefender 및 관련 서비스가 구현되어 있을 때
When: 코드를 검토하면
Then: 모든 공개 메서드에 JSDoc 주석이 있어야 합니다
And: OZ Defender SDK 호환성에 대한 명확한 설명이 있어야 합니다

검증 방법:
- 코드 리뷰
- JSDoc 생성 도구로 문서 확인

### AC-023: 성능

Given: 정상적인 네트워크 조건에서
When: SignatureService.verifySignature()를 호출하면
Then: 100ms 이내에 결과를 반환해야 합니다

Given: Forwarder.execute()가 호출될 때
When: 트랜잭션이 제출되면
Then: 트랜잭션 해시가 2초 이내에 반환되어야 합니다

### AC-024: OZ SDK 인터페이스 호환성

Given: MockDefender가 구현되어 있을 때
When: OZ Defender SDK 타입과 비교하면
Then: 다음 메서드들이 동일한 시그니처를 가져야 합니다:
- relaySigner.sendTransaction()
- relaySigner.getTransaction()
- relaySigner.getRelayer()

검증 방법:
- 타입 호환성 테스트
- 인터페이스 비교

## Quality Gate 체크리스트

### 필수 통과 항목

코드 품질:
- TypeScript 컴파일 에러 없음
- ESLint 경고/에러 없음
- Prettier 포맷팅 적용

테스트:
- 단위 테스트 100% 통과
- MockDefender 호환성 테스트 100% 통과
- EIP-712 서명 테스트 100% 통과
- 환경별 통합 테스트 100% 통과
- 새 코드 커버리지 80% 이상

기능:
- AC-001 ~ AC-024 모든 인수 기준 충족

보안:
- 서명 검증 로직 검토 완료
- Nonce 기반 재생 방지 검증
- 환경 변수 보안 검토

문서:
- JSDoc 주석 완료
- SPEC 문서 최종 업데이트

## Definition of Done

SPEC-RELAY-001 완료 조건:

구현 완료:
- MockDefender 패키지 구현 완료
- OZ Defender SDK 인터페이스 호환성 확인
- EIP-712 서명 검증 로직 구현 완료
- Nonce 관리 기능 구현 완료
- Relay 서비스 팩토리 구현 완료
- API 엔드포인트 업데이트 완료
- Docker Compose 환경 변수 설정 완료

테스트 완료:
- MockDefender 단위 테스트 작성 및 통과
- EIP-712 서명 테스트 작성 및 통과
- 환경별 통합 테스트 작성 및 통과
- Docker Compose 환경 E2E 테스트 통과

문서 완료:
- spec.md 최종 검토 완료
- plan.md 구현 결과 반영 완료
- acceptance.md 검증 결과 기록 완료

배포 준비:
- main 브랜치 머지 가능 상태
- CI/CD 파이프라인 통과
