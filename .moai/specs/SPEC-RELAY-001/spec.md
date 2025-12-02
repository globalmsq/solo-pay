# SPEC-RELAY-001: 환경별 하이브리드 Gasless 트랜잭션 시스템

## TAG BLOCK

- SPEC-ID: SPEC-RELAY-001
- Title: 환경별 하이브리드 Gasless 트랜잭션 시스템 구현
- Status: Draft
- Priority: High
- Version: 3.0.0
- Created: 2025-12-01
- Updated: 2025-12-02
- Author: System Architect

## 개요

ERC2771Forwarder 컨트랙트와 EIP-712 서명을 활용한 Gasless 트랜잭션 시스템을 구현합니다. 환경에 따라 Relay 제출자를 선택적으로 사용하되, 모든 환경에서 Forwarder를 통해 트랜잭션을 실행합니다.

### 환경별 아키텍처

| 환경 | Relay 제출자 | Forwarder | 특징 |
|------|-------------|-----------|------|
| Local (Docker Compose) | MockDefender | ERC2771Forwarder | OZ SDK 호환, 자체 호스팅 |
| Testnet/Mainnet | OZ Defender SDK | ERC2771Forwarder | 외부 서비스, 프로덕션 안정성 |

## 배경 및 동기

### 이전 아키텍처 (Direct Relay)

- User → API Server → OZ Defender SDK → Blockchain
- Server가 calldata 생성, Relayer가 서명 및 제출
- msg.sender = Relayer 주소 (사용자 주소가 아님)
- 보안 문제: 서버 신뢰 필요, 사용자 서명 검증 없음

### 새로운 아키텍처 (Forwarder-based with EIP-712)

- User가 EIP-712 typed data 서명 → API Server 검증 → Relay 서비스 → Forwarder 컨트랙트 실행 → PaymentGateway
- _msgSender() = User 주소 (ERC2771Context를 통해)
- 사용자 의도의 암호화적 증명
- 환경별 Relay 서비스 선택 (Local: MockDefender, Production: OZ Defender)

### 해결 목표

- 모든 환경에서 ERC2771Forwarder를 통한 트랜잭션 실행
- Local 환경: MockDefender 패키지 (OZ SDK 호환) 구현
- Testnet/Mainnet: 기존 OZ Defender SDK 활용
- EIP-712 typed data 서명 검증 구현
- 사용자 서명 기반의 안전한 메타트랜잭션 처리

## Environment (환경)

### 시스템 환경

- Runtime: Node.js 20 LTS
- Framework: Fastify
- Blockchain:
  - Local: Hardhat Node (chainId: 31337)
  - Testnet: Polygon Amoy (chainId: 80002)
  - Mainnet: Polygon (chainId: 137)
- Container: Docker Compose

### 기술 스택

- viem: Ethereum 클라이언트 및 EIP-712 서명 검증
- TypeScript: 타입 안전성 보장
- Hardhat: 로컬 블록체인 및 ERC2771Forwarder 배포
- @openzeppelin/defender-sdk: Testnet/Mainnet Relay 서비스

### 스마트 컨트랙트

- ERC2771Forwarder: OpenZeppelin 표준 Forwarder 컨트랙트
- PaymentGatewayV1: ERC2771ContextUpgradeable 상속 (_msgSender() 사용)

### 의존성

- viem ^2.x (signTypedData, verifyTypedData, walletClient, publicClient)
- @openzeppelin/contracts (ERC2771Forwarder ABI)
- @openzeppelin/defender-sdk (Testnet/Mainnet Relay)

## Assumptions (가정)

### 기술적 가정

- ERC2771Forwarder 컨트랙트가 각 네트워크에 배포되어 있습니다
  - Local: Hardhat 배포 (주소: 0x5FbDB2315678afecb367f032d93F642f64180aa3)
  - Testnet/Mainnet: 별도 배포 필요
- PaymentGatewayV1이 ERC2771ContextUpgradeable을 상속하고 trustedForwarder가 설정되어 있습니다
- 클라이언트(프론트엔드)가 EIP-712 서명을 생성할 수 있습니다

### 운영 가정

- 환경별 Relay 서비스 선택:
  - Local: MockDefender (OZ SDK 인터페이스 호환)
  - Testnet/Mainnet: OZ Defender SDK
- Relayer 지갑에 가스비 지불을 위한 충분한 ETH/MATIC이 있습니다
- EIP-712 도메인 정보가 네트워크별로 올바르게 설정됩니다

### 가스 비용 고려사항

- Forwarder를 통한 트랜잭션은 약 35,000-55,000 가스가 추가됩니다
- 직접 호출 대비 약 56% 증가
- 트레이드오프: 보안성 (사용자 서명 검증) vs 가스 비용

## Requirements (요구사항)

### REQ-001: 환경별 Relay 서비스 선택

EARS 형식: **When** 서버가 시작될 때, **the system shall** 환경 변수에 따라 MockDefender 또는 OZ Defender SDK를 선택하여 **so that** 동일한 코드베이스로 모든 환경을 지원할 수 있습니다.

환경 전환 방식:
- USE_MOCK_DEFENDER=true: MockDefender 사용 (Local)
- USE_MOCK_DEFENDER=false 또는 미설정: OZ Defender SDK 사용 (Testnet/Mainnet)

### REQ-002: MockDefender 패키지 구현 (Local 환경)

EARS 형식: **When** Local 환경에서 Gasless 트랜잭션이 요청될 때, **the system shall** MockDefender를 통해 Forwarder.execute()를 호출하여 **so that** OZ Defender API 없이도 개발 및 테스트가 가능합니다.

MockDefender 구조:
- OZ Defender SDK와 100% 동일한 인터페이스
- relaySigner.sendTransaction(): Forwarder.execute() 호출
- relaySigner.getTransaction(): 트랜잭션 상태 조회
- 내부적으로 viem walletClient 사용

### REQ-003: DefenderService 통합 (Testnet/Mainnet)

EARS 형식: **When** Testnet/Mainnet 환경에서 Gasless 트랜잭션이 요청될 때, **the system shall** OZ Defender SDK를 통해 트랜잭션을 제출하여 **so that** 프로덕션급 안정성과 모니터링을 활용할 수 있습니다.

DefenderService 구조:
- 기존 OZ Defender SDK 활용
- Forwarder를 통한 트랜잭션 제출
- 트랜잭션 상태 추적

### REQ-004: EIP-712 서명 검증

EARS 형식: **When** 클라이언트로부터 서명된 요청이 수신될 때, **the system shall** EIP-712 typed data 서명을 검증하여 **so that** 사용자의 의도가 암호화적으로 증명됩니다.

EIP-712 도메인 구조:
- name: "MSQPayForwarder"
- version: "1"
- chainId: 네트워크 체인 ID
- verifyingContract: Forwarder 컨트랙트 주소

ForwardRequest 타입 구조:
- from: 사용자 주소 (address)
- to: 대상 컨트랙트 주소 (address)
- value: 전송할 ETH 양 (uint256)
- gas: 가스 한도 (uint256)
- nonce: 재생 공격 방지용 (uint256)
- deadline: 요청 만료 시간 (uint48)
- data: 인코딩된 함수 호출 데이터 (bytes)

### REQ-005: Nonce 관리

EARS 형식: **When** 새로운 ForwardRequest가 생성될 때, **the system shall** Forwarder 컨트랙트에서 현재 nonce를 조회하고 검증하여 **so that** 재생 공격이 방지됩니다.

Nonce 관리 방식:
- Forwarder.nonces(address) 함수를 통해 현재 nonce 조회
- 각 성공적인 execute() 호출 후 nonce 자동 증가
- 클라이언트에게 현재 nonce 제공 API

### REQ-006: 트랜잭션 상태 추적

EARS 형식: **When** Forwarder를 통해 트랜잭션이 제출될 때, **the system shall** 블록체인 이벤트를 모니터링하여 트랜잭션 상태를 추적하고 **so that** 사용자에게 실시간 상태 업데이트를 제공할 수 있습니다.

상태 추적 방식:
- 트랜잭션 해시 기반 상태 조회
- 블록 확인(confirmation) 수 모니터링
- ExecutedForwardRequest 이벤트 파싱

### REQ-007: 환경별 설정

EARS 형식: **When** Docker Compose로 서비스를 실행할 때, **the system shall** 환경에 따라 적절한 Relay 서비스와 설정을 사용합니다.

공통 환경 변수:
- FORWARDER_ADDRESS: ERC2771Forwarder 컨트랙트 주소
- RPC_URL: 블록체인 노드 URL
- CHAIN_ID: 네트워크 체인 ID

Local 환경 (MockDefender) 추가 변수:
- USE_MOCK_DEFENDER=true
- RELAYER_PRIVATE_KEY: Relayer 지갑 개인키
- RELAYER_ADDRESS: Relayer 지갑 주소

Testnet/Mainnet (OZ Defender) 추가 변수:
- DEFENDER_API_KEY: OZ Defender API 키
- DEFENDER_API_SECRET: OZ Defender API 시크릿
- DEFENDER_RELAYER_ADDRESS: OZ Defender Relayer 주소

## Specifications (상세 명세)

### 서비스 구조

```
packages/
├── mock-defender/                    # MockDefender 패키지 (신규)
│   ├── package.json
│   ├── tsconfig.json
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
    └── tests/
        └── relay.factory.test.ts
```

### 환경별 Relay 서비스 팩토리

```typescript
// 환경에 따라 MockDefender 또는 OZ Defender SDK 선택
function createRelayService() {
  if (process.env.USE_MOCK_DEFENDER === 'true') {
    return new MockDefender(config);  // Local
  }
  return new Defender(config);         // Testnet/Mainnet
}
```

### EIP-712 도메인 및 타입 정의

도메인 설정:
```
name: "MSQPayForwarder"
version: "1"
chainId: 환경별 체인 ID
verifyingContract: Forwarder 컨트랙트 주소
```

ForwardRequest 타입:
```
from: address (사용자 주소)
to: address (대상 컨트랙트)
value: uint256 (ETH 금액)
gas: uint256 (가스 한도)
nonce: uint256 (재생 방지)
deadline: uint48 (만료 시간)
data: bytes (호출 데이터)
```

### MockDefender 클래스 (Local 환경)

MockDefender 구조:
- OZ Defender SDK와 100% 동일한 인터페이스
- relaySigner 속성: MockRelaySigner 인스턴스

MockRelaySigner 메서드:
- sendTransaction(request): Forwarder.execute() 호출, transactionId 반환
- getTransaction(id): 트랜잭션 상태 조회
- getRelayer(): Relayer 정보 반환

### DefenderService (Testnet/Mainnet)

기존 OZ Defender SDK 활용:
- Defender 클래스 인스턴스화
- relaySigner.sendTransaction(): OZ Relay를 통해 Forwarder.execute() 호출
- relaySigner.getTransaction(): 트랜잭션 상태 조회

### 공통 서비스 메서드

verifySignature(request, signature):
- viem의 verifyTypedData 사용
- 복구된 주소와 request.from 비교
- 불일치 시 InvalidSignatureError 발생

getNonce(address):
- Forwarder.nonces(address) 호출
- 현재 nonce 값 반환

getTransactionStatus(hash):
- publicClient.getTransactionReceipt() 호출
- 상태 매핑 (pending, mined, confirmed, failed)

### 상태 매핑

트랜잭션 상태 매핑:
- 트랜잭션 제출 직후: 'pending'
- receipt.status === 'success': 'mined'
- confirmations >= 1: 'confirmed'
- receipt.status === 'reverted': 'failed'

### 에러 처리

공통 에러 시나리오:
- InvalidSignatureError: "서명이 유효하지 않습니다"
- DeadlineExpiredError: "요청 기한이 만료되었습니다"
- InsufficientGasError: "릴레이어 가스 잔액이 부족합니다"
- NonceInvalidError: "nonce가 유효하지 않습니다"
- ForwarderExecutionError: "Forwarder 실행에 실패했습니다"

## API 엔드포인트 변경사항

### GET /api/relay/nonce/:address

새로운 엔드포인트:
- 목적: 사용자의 현재 nonce 조회
- 응답: { nonce: string }

### POST /api/payments/gasless

요청 본문 변경:
- 기존: { to, data, value } (서버가 calldata 생성)
- 신규: { request: ForwardRequest, signature: string } (클라이언트가 서명)

응답 형식:
- transactionHash: 제출된 트랜잭션 해시
- status: 현재 상태
- forwarderTxId: 내부 추적 ID

## 보안 고려사항

### 서명 검증

- 모든 요청에 대해 EIP-712 서명 검증 필수
- 서명자 주소와 request.from 일치 확인
- deadline 만료 확인으로 오래된 서명 거부

### Nonce 기반 재생 공격 방지

- Forwarder 컨트랙트가 nonce 관리
- 각 성공적인 실행 후 nonce 자동 증가
- 이미 사용된 nonce로 인한 중복 실행 방지

### 신뢰할 수 있는 Forwarder

- PaymentGatewayV1이 특정 Forwarder만 신뢰
- isTrustedForwarder() 검증
- _msgSender()를 통한 실제 사용자 식별

## 범위 외 (Out of Scope)

- 프론트엔드 EIP-712 서명 UI 구현 (별도 SPEC)
- 다중 Forwarder 지원
- Relayer 로테이션 및 부하 분산
- 가스 가격 최적화 전략
- 메타트랜잭션 수수료 모델

## 기술적 의존성

### 내부 의존성

- packages/mock-defender: MockDefender 패키지 (신규)
- packages/server/src/services/defender.service.ts: DefenderService
- packages/server/src/services/relay.factory.ts: Relay 서비스 팩토리 (신규)
- packages/server/src/routes/gasless.routes.ts: API 라우트
- packages/contracts/src/ERC2771Forwarder.sol: Forwarder 컨트랙트

### 외부 의존성

- viem: ^2.21.0 이상 (EIP-712 유틸리티 포함)
- @openzeppelin/defender-sdk: Testnet/Mainnet Relay
- Hardhat 노드: 로컬 블록체인 및 컨트랙트 배포

## 관련 문서

- SPEC-API-001: MSQPay API 서버 구현
- SPEC-SERVER-001: Payment Server 초기 설정
- EIP-712: Typed structured data hashing and signing
- ERC-2771: Secure Protocol for Native Meta Transactions
- docker/docker-compose.yml: 컨테이너 오케스트레이션 설정

## Traceability

- REQ-001 → packages/server/src/services/relay.factory.ts
- REQ-002 → packages/mock-defender/src/mock-defender.ts
- REQ-003 → packages/server/src/services/defender.service.ts
- REQ-004 → packages/server/src/services/signature.service.ts
- REQ-005 → packages/server/src/services/nonce.service.ts
- REQ-006 → packages/server/src/services/status.service.ts
- REQ-007 → docker/docker-compose.yml
