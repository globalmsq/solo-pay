# SPEC-RELAY-001: 구현 계획

## TAG BLOCK

- SPEC-ID: SPEC-RELAY-001
- Document: Implementation Plan
- Version: 3.0.0
- Created: 2025-12-01
- Updated: 2025-12-02

## 구현 개요

환경에 따라 Relay 서비스를 선택적으로 사용하되, 모든 환경에서 ERC2771Forwarder를 통해 트랜잭션을 실행하는 하이브리드 아키텍처를 구현합니다.

### 환경별 아키텍처

| 환경 | Relay 제출자 | Forwarder | 특징 |
|------|-------------|-----------|------|
| Local (Docker Compose) | MockDefender | ERC2771Forwarder | OZ SDK 호환, 자체 호스팅 |
| Testnet/Mainnet | OZ Defender SDK | ERC2771Forwarder | 외부 서비스, 프로덕션 안정성 |

## 마일스톤

### Milestone 1: MockDefender 패키지 구현 (Primary Goal)

목표: OZ Defender SDK와 100% 동일한 인터페이스를 가진 MockDefender 패키지 구현

#### Task 1.1: MockDefender 패키지 생성

파일 위치: packages/mock-defender/

구현 내용:
- package.json 생성 (name: @msqpay/mock-defender)
- tsconfig.json 설정
- vitest.config.ts 설정
- 패키지 구조 설정

#### Task 1.2: 타입 정의

파일 위치: packages/mock-defender/src/types.ts

구현 내용:
- MockDefenderConfig 인터페이스
- ForwardRequest 인터페이스 (EIP-712 호환)
- TransactionResponse 인터페이스 (OZ SDK 호환)
- RelayerInfo 인터페이스

#### Task 1.3: MockRelaySigner 클래스 구현

파일 위치: packages/mock-defender/src/relay-signer.ts

구현 내용:
- viem walletClient 초기화
- sendTransaction(request): Forwarder.execute() 호출
- getTransaction(id): 트랜잭션 상태 조회
- getRelayer(): Relayer 정보 반환
- OZ Defender SDK와 동일한 응답 형식

#### Task 1.4: MockDefender 클래스 구현

파일 위치: packages/mock-defender/src/mock-defender.ts

구현 내용:
- constructor(config): OZ Defender SDK와 동일한 설정
- relaySigner 속성: MockRelaySigner 인스턴스
- OZ Defender 클래스와 동일한 인터페이스

### Milestone 2: EIP-712 서명 검증 서비스 (Secondary Goal)

목표: 모든 환경에서 공통으로 사용되는 EIP-712 서명 검증 로직 구현

#### Task 2.1: 서명 검증 서비스

파일 위치: packages/server/src/services/signature.service.ts

구현 내용:
- EIP-712 도메인 및 타입 정의
- verifySignature(request, signature): 서명 검증
- getDomain(): 현재 네트워크의 도메인 반환
- getForwardRequestTypes(): ForwardRequest 타입 정의 반환

#### Task 2.2: Nonce 관리 서비스

파일 위치: packages/server/src/services/nonce.service.ts

구현 내용:
- getNonce(address): Forwarder.nonces(address) 호출
- 에러 처리 (RPC 연결 실패 등)

#### Task 2.3: 트랜잭션 상태 서비스

파일 위치: packages/server/src/services/status.service.ts

구현 내용:
- getTransactionStatus(hash): 트랜잭션 상태 조회
- 상태 매핑 (pending, mined, confirmed, failed)

### Milestone 3: Relay 서비스 팩토리 (Tertiary Goal)

목표: 환경에 따라 MockDefender 또는 OZ Defender SDK를 선택하는 팩토리 구현

#### Task 3.1: Relay 서비스 팩토리

파일 위치: packages/server/src/services/relay.factory.ts

구현 내용:
- createRelayService(): 환경 변수에 따라 Relay 서비스 선택
- USE_MOCK_DEFENDER=true: MockDefender 반환
- USE_MOCK_DEFENDER=false: OZ Defender SDK 반환
- 동일한 인터페이스 보장

#### Task 3.2: DefenderService 수정

파일 위치: packages/server/src/services/defender.service.ts

구현 내용:
- Forwarder를 통한 트랜잭션 제출 로직 추가
- 기존 Direct Relay 로직 유지 (백워드 호환)
- EIP-712 서명 검증 통합

### Milestone 4: API 엔드포인트 업데이트 (Integration)

목표: gasless 라우트를 환경별 Relay 서비스 기반으로 변경

#### Task 4.1: nonce 조회 엔드포인트 추가

파일 위치: packages/server/src/routes/gasless.routes.ts

구현 내용:
- GET /api/relay/nonce/:address 엔드포인트 추가
- NonceService.getNonce() 호출
- 응답 형식: { nonce: string }

#### Task 4.2: gasless 결제 엔드포인트 수정

파일 위치: packages/server/src/routes/gasless.routes.ts

구현 내용:
- POST /api/payments/gasless 요청 형식 변경
- ForwardRequest와 signature를 요청 본문으로 수신
- Relay 서비스 팩토리를 통해 적절한 서비스 사용
- 응답 형식 업데이트

#### Task 4.3: Docker Compose 환경 변수 업데이트

파일 위치: docker/docker-compose.yml

구현 내용:
- USE_MOCK_DEFENDER=true 환경 변수 추가
- FORWARDER_ADDRESS 환경 변수 추가
- CHAIN_ID 환경 변수 추가
- Local 환경용 RELAYER_PRIVATE_KEY 설정

### Milestone 5: 테스트 (Quality Gate)

목표: 환경별 Relay 서비스의 안정성 검증을 위한 테스트 코드 작성

#### Task 5.1: MockDefender 단위 테스트

파일 위치: packages/mock-defender/tests/mock-defender.test.ts

테스트 케이스:
- MockDefender 초기화 검증
- MockRelaySigner.sendTransaction() 동작 검증
- MockRelaySigner.getTransaction() 동작 검증
- OZ Defender SDK 인터페이스 호환성 검증

#### Task 5.2: 서명 검증 테스트

파일 위치: packages/server/src/services/tests/signature.service.test.ts

테스트 케이스:
- 유효한 서명 검증 성공
- 무효한 서명 검증 실패
- 도메인 해시 일관성
- ForwardRequest 타입 해시

#### Task 5.3: 환경별 통합 테스트

테스트 케이스:
- Local 환경: MockDefender를 통한 전체 플로우
- Testnet 환경: OZ Defender SDK를 통한 전체 플로우 (mock)
- 환경 전환 테스트

#### Task 5.4: Docker Compose E2E 테스트

테스트 케이스:
- 전체 플로우 E2E 테스트
- Hardhat 노드와 MockDefender 통신 확인
- Forwarder 컨트랙트 execute() 성공 확인
- PaymentGatewayV1에서 _msgSender() 정상 동작 확인

## 아키텍처 설계

### 패키지 구조

```
packages/
├── mock-defender/                    # MockDefender 패키지 (신규)
│   ├── package.json
│   ├── tsconfig.json
│   ├── vitest.config.ts
│   ├── src/
│   │   ├── index.ts                  # MockDefender export
│   │   ├── mock-defender.ts          # MockDefender 클래스
│   │   ├── relay-signer.ts           # MockRelaySigner 클래스
│   │   └── types.ts                  # 타입 정의
│   └── tests/
│       └── mock-defender.test.ts
│
└── server/src/services/
    ├── defender.service.ts           # DefenderService (OZ Defender SDK)
    ├── relay.factory.ts              # 환경별 Relay 서비스 팩토리 (신규)
    ├── signature.service.ts          # EIP-712 서명 검증 (신규)
    ├── nonce.service.ts              # Nonce 관리 (신규)
    ├── status.service.ts             # 트랜잭션 상태 (신규)
    └── tests/
        ├── relay.factory.test.ts     # (신규)
        └── signature.service.test.ts # (신규)
```

### 데이터 흐름 (Local 환경)

```
클라이언트
    │
    │ 1. GET /api/relay/nonce/:address
    ▼
NonceService.getNonce()
    │
    │ 2. nonce 반환
    ▼
클라이언트 (EIP-712 서명 생성)
    │
    │ 3. POST /api/payments/gasless { request, signature }
    ▼
SignatureService.verifySignature()
    │
    │ 4. 서명 검증 성공
    ▼
RelayFactory.createRelayService() → MockDefender
    │
    │ 5. MockRelaySigner.sendTransaction()
    ▼
ERC2771Forwarder.execute(request, signature)
    │
    │ 6. PaymentGatewayV1.processPayment()
    ▼
PaymentGatewayV1 (_msgSender() = 사용자 주소)
```

### 데이터 흐름 (Testnet/Mainnet)

```
클라이언트
    │
    │ 1. GET /api/relay/nonce/:address
    ▼
NonceService.getNonce()
    │
    │ 2. nonce 반환
    ▼
클라이언트 (EIP-712 서명 생성)
    │
    │ 3. POST /api/payments/gasless { request, signature }
    ▼
SignatureService.verifySignature()
    │
    │ 4. 서명 검증 성공
    ▼
RelayFactory.createRelayService() → OZ Defender SDK
    │
    │ 5. Defender.relaySigner.sendTransaction()
    ▼
OZ Defender Relay → ERC2771Forwarder.execute()
    │
    │ 6. PaymentGatewayV1.processPayment()
    ▼
PaymentGatewayV1 (_msgSender() = 사용자 주소)
```

### 의존성 관계

```
gasless.routes.ts
    └── RelayFactory
            ├── MockDefender (Local)
            │       └── viem (walletClient, publicClient)
            │
            └── OZ Defender SDK (Testnet/Mainnet)
                    └── @openzeppelin/defender-sdk

SignatureService
    └── viem (verifyTypedData)

NonceService
    └── viem (publicClient) + Forwarder ABI

StatusService
    └── viem (publicClient)
```

## 환경 변수

### Local 환경 (Docker Compose)

```
USE_MOCK_DEFENDER=true
FORWARDER_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
RELAYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
RELAYER_ADDRESS=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
RPC_URL=http://hardhat:8545
CHAIN_ID=31337
```

### Testnet/Mainnet

```
USE_MOCK_DEFENDER=false
FORWARDER_ADDRESS=<배포된 Forwarder 주소>
DEFENDER_API_KEY=<OZ Defender API 키>
DEFENDER_API_SECRET=<OZ Defender API 시크릿>
DEFENDER_RELAYER_ADDRESS=<OZ Defender Relayer 주소>
RPC_URL=<Polygon RPC URL>
CHAIN_ID=80002 (Amoy) 또는 137 (Mainnet)
```

## 리스크 및 대응 방안

### 리스크 1: OZ SDK 인터페이스 변경

위험: OZ Defender SDK 버전 업데이트 시 인터페이스 변경 가능
대응:
- MockDefender 인터페이스를 OZ SDK 타입에서 직접 추출
- 버전 고정 및 정기적 호환성 테스트

### 리스크 2: 환경 전환 오류

위험: 환경 변수 설정 오류로 인한 잘못된 Relay 서비스 사용
대응:
- 서버 시작 시 환경 검증 로그 출력
- 헬스체크 엔드포인트에 현재 Relay 서비스 타입 포함

### 리스크 3: 가스 비용 증가

위험: Forwarder를 통한 호출은 약 35,000-55,000 가스 추가
대응:
- 문서화를 통한 트레이드오프 명시
- 향후 가스 최적화 SPEC 분리

### 리스크 4: Testnet/Mainnet Forwarder 배포

위험: 각 네트워크에 Forwarder 컨트랙트 배포 필요
대응:
- OpenZeppelin 공식 ERC2771Forwarder 사용
- 배포 스크립트 및 가이드 제공

## 구현 순서 권장사항

권장 구현 순서:
1. Task 1.1~1.4: MockDefender 패키지 생성 (기반 작업)
2. Task 2.1~2.3: EIP-712 서명 및 공통 서비스 (핵심 기능)
3. Task 3.1~3.2: Relay 서비스 팩토리 및 DefenderService 수정 (통합)
4. Task 4.1~4.3: API 엔드포인트 및 환경 설정 (적용)
5. Task 5.1~5.4: 테스트 작성 (품질 검증)

## 검증 체크리스트

기능 검증:
- MockDefender가 OZ Defender SDK와 동일한 인터페이스 제공
- 환경 변수에 따라 올바른 Relay 서비스 선택
- EIP-712 서명 검증 정상 동작
- Forwarder 컨트랙트를 통한 트랜잭션 제출 성공
- PaymentGatewayV1에서 _msgSender()가 사용자 주소 반환

통합 검증:
- Local 환경: MockDefender + Hardhat 노드 전체 플로우
- Testnet 환경: OZ Defender SDK 전체 플로우 (mock)
- 환경 전환 시 정상 동작

보안 검증:
- 무효한 서명 거부 확인
- 만료된 deadline 거부 확인
- 잘못된 nonce 거부 확인
