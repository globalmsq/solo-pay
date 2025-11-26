# Product Requirements Document (PRD)
## MSQ Pay Onchain - Multi-Service Blockchain Payment Gateway

### Document Information
- **Version**: 0.2 (MVP)
- **Date**: 2025-11-26
- **Status**: In Development

---

## 1. 제품 개요

### 1.1 목적
여러 서비스가 직접 통합할 수 있는 ERC-20 토큰 결제 컨트랙트 및 SDK 제공

### 1.2 핵심 특징
- **직접 통합 방식**: 별도의 API 서비스 없이 SDK를 통해 서비스에 직접 통합
- **가스비 선택**: 사용자 직접 지불 또는 서비스 대납 (Meta Transaction)
- **이벤트 모니터링**: Subgraph를 통한 결제 이벤트 인덱싱 및 조회
- **확장 가능**: 멀티체인 지원을 위한 설계 (MVP는 Polygon Testnet)

---

## 2. MVP 범위

### 2.1 포함 사항
- [x] 결제 스마트 컨트랙트 (PaymentGateway)
- [x] 두 가지 결제 방식 지원 (Direct / Meta-tx)
- [x] TypeScript SDK
- [x] Subgraph를 통한 결제 이벤트 모니터링
- [x] 테스트용 데모 웹앱
- [x] Polygon Amoy Testnet 지원

### 2.2 제외 사항
- [ ] 관리자 대시보드
- [ ] 정산 시스템
- [ ] Multi-chain 동시 지원
- [ ] 복잡한 모니터링/알림 시스템
- [ ] 별도의 API 서비스

---

## 3. 결제 플로우

### 3.1 Direct Payment (사용자 가스비 지불)

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌───────────┐
│  User   │────▶│ Service │────▶│   SDK   │────▶│  Contract │
│ Wallet  │     │  (App)  │     │         │     │           │
└─────────┘     └─────────┘     └─────────┘     └───────────┘
     │                               │                │
     │  1. 구매 요청                 │                │
     │──────────────────────────────▶│                │
     │                               │                │
     │  2. TX 데이터 생성            │                │
     │◀──────────────────────────────│                │
     │                               │                │
     │  3. 서명 & 전송 (가스비 지불) │                │
     │───────────────────────────────────────────────▶│
     │                               │                │
     │  4. PaymentCompleted 이벤트   │                │
     │◀──────────────────────────────────────────────│
```

**필요 자산**: ERC-20 토큰 + MATIC (가스비)
**처리 시간**: 10-30초
**사용자 경험**: 기존 Web3 방식과 동일

### 3.2 Meta Transaction (서비스 가스비 대납)

```
┌─────────┐     ┌─────────┐     ┌─────────┐     ┌───────────┐     ┌──────────┐
│  User   │────▶│ Service │────▶│   SDK   │────▶│OZ Defender│────▶│ Contract │
│ Wallet  │     │  (App)  │     │         │     │  Relay    │     │          │
└─────────┘     └─────────┘     └─────────┘     └───────────┘     └──────────┘
     │                               │                │                │
     │  1. 구매 요청                 │                │                │
     │──────────────────────────────▶│                │                │
     │                               │                │                │
     │  2. EIP-712 서명 요청         │                │                │
     │◀──────────────────────────────│                │                │
     │                               │                │                │
     │  3. 서명만 (가스비 없음)      │                │                │
     │──────────────────────────────▶│                │                │
     │                               │                │                │
     │                               │  4. 서명 제출  │                │
     │                               │───────────────▶│                │
     │                               │                │                │
     │                               │                │  5. TX 실행    │
     │                               │                │───────────────▶│
     │                               │                │                │
     │  6. PaymentCompleted 이벤트   │                │                │
     │◀──────────────────────────────────────────────────────────────│
```

**필요 자산**: ERC-20 토큰만 (가스비 불필요)
**처리 시간**: 5-15초
**사용자 경험**: 서명만으로 결제 완료

---

## 4. 시스템 구성요소

### 4.1 Smart Contract
- **PaymentGatewayV1**: UUPS Proxy 패턴으로 업그레이드 가능
- **ERC2771Context**: Meta Transaction 지원
- **지원 기능**:
  - Direct payment (`pay()`)
  - 중복 결제 방지 (`processedPayments` mapping)
  - 지원 토큰 관리

### 4.2 TypeScript SDK (`@msq/pay-sdk`)
- Direct payment TX 데이터 생성
- Meta-tx EIP-712 서명 요청 생성
- OZ Defender Relay 제출
- Subgraph 쿼리
- 이벤트 리스닝

### 4.3 Subgraph
- 결제 이벤트 인덱싱
- 머천트별 결제 내역 조회
- 일별/전체 통계

### 4.4 Demo App (Next.js)
- 샘플 상품 목록
- 결제 모달 (Direct / Meta-tx 선택)
- 결제 내역 조회

---

## 5. 기술 스택

| 구성요소 | 기술 | 버전 |
|----------|------|------|
| Blockchain | Polygon Amoy (Testnet) | - |
| Smart Contract | Solidity | 0.8.24 |
| Contract Framework | Hardhat + OpenZeppelin | 2.22+ / 5.0+ |
| SDK | TypeScript + viem | 5.0+ / 2.0+ |
| Relay | OpenZeppelin Defender | - |
| Indexer | The Graph | - |
| Demo Frontend | Next.js 14 + wagmi | 14+ / 2.5+ |
| Package Manager | pnpm | 8.0+ |

---

## 6. MVP 제약사항

| 항목 | 제한 |
|------|------|
| 지원 네트워크 | Polygon Amoy Testnet |
| 지원 토큰 | SUT (0xE4C687167705Abf55d709395f92e254bdF5825a2) |
| 결제 한도 | 없음 (Testnet) |
| API Rate Limit | Subgraph: 1000 req/day (무료 티어) |

---

## 7. 성공 지표

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| Direct Payment | 100% 성공률 | 테스트 |
| Meta-tx Payment | 100% 성공률 | 테스트 |
| Subgraph 동기화 | < 30초 지연 | 이벤트 발생 ~ 쿼리 가능 |
| SDK 통합 시간 | < 1시간 | 개발자 피드백 |

---

## 8. 향후 계획 (Post-MVP)

### Phase 2
- [ ] Polygon Mainnet 배포
- [ ] 다중 토큰 지원 (MSQ, USDT, USDC)
- [ ] Webhook 알림 시스템

### Phase 3
- [ ] Multi-chain 지원 (BSC, Ethereum)
- [ ] 관리자 대시보드
- [ ] 실시간 모니터링

### Phase 4
- [ ] 정산 시스템
- [ ] 분석/리포팅
- [ ] SLA 보장

---

## 9. 용어 정의

| 용어 | 설명 |
|------|------|
| Direct Payment | 사용자가 직접 가스비를 지불하는 일반 블록체인 트랜잭션 |
| Meta Transaction | 제3자(서비스)가 가스비를 대납하는 방식 |
| EIP-2771 | Meta Transaction을 위한 Ethereum 표준 (Trusted Forwarder) |
| EIP-712 | 구조화된 데이터 서명을 위한 Ethereum 표준 |
| Subgraph | The Graph 프로토콜의 인덱싱 단위 |
| UUPS Proxy | Universal Upgradeable Proxy Standard - 업그레이드 가능한 컨트랙트 패턴 |

---

**예상 개발 기간**: 10일
**필요 리소스**: 개발자 1명
**예산**: Testnet only (무료, OZ Defender Testnet 무료)
