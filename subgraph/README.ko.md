# MSQ Pay Subgraph

[English](README.md) | [한국어](README.ko.md)

MSQ Pay Subgraph는 The Graph 프로토콜을 사용하여 PaymentGateway 스마트 컨트랙트의 이벤트를 인덱싱하고 쿼리 가능한 GraphQL API를 제공합니다.

## 개요

Subgraph는 블록체인 이벤트를 실시간으로 인덱싱하여 다음과 같은 데이터를 제공합니다:

- 개별 결제 기록
- 상점별 통계
- 일별 거래량
- 토큰별 통계
- 전체 시스템 통계

## 주요 기능

- ✅ **실시간 인덱싱**: PaymentCompleted 이벤트 자동 수집
- ✅ **통계 집계**: 상점, 토큰, 일별 통계 자동 계산
- ✅ **GraphQL API**: 강력한 쿼리 및 필터링 기능
- ✅ **가스 모드 구분**: Direct vs Gasless 결제 추적
- ✅ **멀티체인 지원**: Polygon Amoy, Polygon Mainnet

## 데이터 스키마

### Payment

개별 결제 기록:

```graphql
type Payment @entity(immutable: true) {
  id: ID! # paymentId (hex string)
  payer: Bytes! # 결제자 주소
  merchant: Bytes! # 상점 주소
  token: Bytes! # 토큰 주소
  amount: BigInt! # 결제 금액
  timestamp: BigInt! # 블록 타임스탬프
  transactionHash: Bytes! # 트랜잭션 해시
  blockNumber: BigInt! # 블록 번호
  gasMode: GasMode! # Direct | MetaTx
}
```

### MerchantStats

상점별 통계:

```graphql
type MerchantStats @entity {
  id: ID! # 상점 주소 (lowercase)
  totalReceived: BigInt! # 총 수령액
  paymentCount: Int! # 결제 건수
  lastPaymentAt: BigInt # 마지막 결제 시간
}
```

### DailyVolume

일별 거래량:

```graphql
type DailyVolume @entity {
  id: ID! # 날짜 (YYYY-MM-DD)
  date: BigInt! # Unix 타임스탬프
  volume: BigInt! # 총 거래량
  count: Int! # 거래 건수
}
```

### TokenStats

토큰별 통계:

```graphql
type TokenStats @entity {
  id: ID! # 토큰 주소 (lowercase)
  symbol: String # 토큰 심볼
  totalVolume: BigInt! # 총 거래량
  transactionCount: Int! # 거래 건수
}
```

### GlobalStats

전체 시스템 통계:

```graphql
type GlobalStats @entity {
  id: ID! # "global"
  totalPayments: Int! # 총 결제 건수
  totalVolume: BigInt! # 총 거래량
  uniqueMerchants: Int! # 고유 상점 수
  uniquePayers: Int! # 고유 결제자 수
}
```

## 시작하기

### 환경 요구사항

- Node.js >= 18.0.0
- The Graph CLI
- IPFS (로컬 배포 시)

### 설치

```bash
cd subgraph
pnpm install
```

### 코드 생성

스키마와 ABI에서 TypeScript 코드 생성:

```bash
pnpm codegen
```

### 빌드

```bash
pnpm build
```

## 배포

### The Graph Studio 배포 (권장)

1. [The Graph Studio](https://thegraph.com/studio/) 계정 생성
2. 새 Subgraph 생성
3. Deploy Key 복사
4. `subgraph.yaml`에서 네트워크 및 주소 업데이트:

```yaml
dataSources:
  - kind: ethereum
    name: PaymentGateway
    network: polygon-amoy # 또는 polygon
    source:
      address: '0xF3a0661743cD5cF970144a4Ed022E27c05b33BB5'
      abi: PaymentGateway
      startBlock: 12345678 # 배포 블록 번호
```

5. 배포:

```bash
# Studio에 배포
pnpm deploy

# 또는 직접 명령어
graph auth --studio <DEPLOY_KEY>
graph deploy --studio msq-pay-polygon-amoy
```

### 로컬 Graph Node 배포

로컬 개발용 Graph Node 실행:

```bash
# Graph Node 시작 (별도 터미널)
docker-compose -f docker-compose-graph.yml up

# Subgraph 생성
pnpm create:local

# Subgraph 배포
pnpm deploy:local

# Subgraph 제거
pnpm remove:local
```

## GraphQL 쿼리 예시

### 최근 결제 조회

```graphql
{
  payments(first: 10, orderBy: timestamp, orderDirection: desc) {
    id
    payer
    merchant
    token
    amount
    timestamp
    gasMode
    transactionHash
  }
}
```

### 특정 상점의 통계

```graphql
{
  merchantStats(id: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8") {
    totalReceived
    paymentCount
    lastPaymentAt
  }
}
```

### 일별 거래량

```graphql
{
  dailyVolumes(first: 30, orderBy: date, orderDirection: desc) {
    id
    date
    volume
    count
  }
}
```

### 토큰별 통계

```graphql
{
  tokenStats {
    id
    symbol
    totalVolume
    transactionCount
  }
}
```

### 전체 통계

```graphql
{
  globalStats(id: "global") {
    totalPayments
    totalVolume
    uniqueMerchants
    uniquePayers
  }
}
```

### 필터 및 페이지네이션

```graphql
{
  payments(
    first: 10
    skip: 0
    where: {
      merchant: "0x70997970c51812dc3a010c7d01b50e0d17dc79c8"
      gasMode: MetaTx
      timestamp_gte: 1704067200 # 2024-01-01 00:00:00 UTC
    }
    orderBy: timestamp
    orderDirection: desc
  ) {
    id
    payer
    amount
    timestamp
  }
}
```

## 프로젝트 구조

```
subgraph/
├── schema.graphql              # GraphQL 스키마 정의
├── subgraph.yaml               # Subgraph 설정
├── src/
│   └── payment-gateway.ts      # 이벤트 핸들러
├── abis/
│   └── PaymentGateway.json     # 컨트랙트 ABI
├── generated/                  # 생성된 코드 (codegen)
├── build/                      # 빌드 결과
├── tests/                      # 테스트 (matchstick)
└── package.json
```

## 이벤트 핸들러

`src/payment-gateway.ts`에서 PaymentCompleted 이벤트 처리:

```typescript
export function handlePaymentCompleted(event: PaymentCompletedEvent): void {
  // 1. Payment 엔티티 생성
  let payment = new Payment(event.params.paymentId.toHexString());
  payment.payer = event.params.payer;
  payment.merchant = event.params.merchant;
  payment.token = event.params.token;
  payment.amount = event.params.amount;
  payment.timestamp = event.params.timestamp;

  // 2. 가스 모드 판단 (Direct vs MetaTx)
  if (event.transaction.from.equals(event.params.payer)) {
    payment.gasMode = 'Direct';
  } else {
    payment.gasMode = 'MetaTx';
  }

  payment.save();

  // 3. 통계 업데이트
  updateMerchantStats(event);
  updateDailyVolume(event);
  updateTokenStats(event);
  updateGlobalStats(event);
}
```

## 지원 네트워크

| 네트워크        | Chain ID | 상태        | Subgraph URL    |
| --------------- | -------- | ----------- | --------------- |
| Polygon Amoy    | 80002    | Testnet     | TBD             |
| Polygon Mainnet | 137      | Production  | TBD             |
| Hardhat Local   | 31337    | Development | 로컬 Graph Node |

## 배포 체크리스트

### Testnet 배포 전

- [ ] PaymentGateway 컨트랙트 배포 완료
- [ ] `subgraph.yaml`에 컨트랙트 주소 업데이트
- [ ] `subgraph.yaml`에 startBlock 업데이트
- [ ] The Graph Studio에서 Subgraph 생성
- [ ] Deploy Key 확보
- [ ] ABI 파일 최신화 (`abis/PaymentGateway.json`)

### Production 배포 전

- [ ] Testnet Subgraph 충분히 테스트
- [ ] Production 컨트랙트 주소로 업데이트
- [ ] Production 네트워크로 변경 (`polygon`)
- [ ] The Graph Studio에서 Production Subgraph 생성

## 모니터링

배포 후 The Graph Studio 대시보드에서 확인:

- 인덱싱 상태
- 동기화 진행률
- 쿼리 성능
- 에러 로그

## 사용 사례

### Demo App에서 사용

```typescript
// apps/demo/src/lib/subgraph.ts
import { SUBGRAPH_URLS } from './wagmi';

async function getPaymentHistory(chainId: number, payer: string) {
  const url = SUBGRAPH_URLS[chainId];
  if (!url) throw new Error('Subgraph not available');

  const query = `
    query GetPayments($payer: Bytes!) {
      payments(
        where: { payer: $payer }
        orderBy: timestamp
        orderDirection: desc
      ) {
        id
        amount
        merchant
        timestamp
        gasMode
      }
    }
  `;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { payer } }),
  });

  return response.json();
}
```

### 대시보드에서 사용

- 실시간 거래량 차트
- 상점별 매출 순위
- 토큰별 사용 통계
- Direct vs Gasless 비율

## 현재 상태

⚠️ **배포 대기 중**: Subgraph는 구현되었지만 아직 배포되지 않았습니다.

**다음 단계**:

1. The Graph Studio에 배포
2. Demo App에서 Subgraph URL 설정
3. 결제 내역 조회 기능 통합

## 문서

- [The Graph 문서](https://thegraph.com/docs/)
- [AssemblyScript API](https://thegraph.com/docs/en/developing/assemblyscript-api/)
- [아키텍처 문서](../docs/reference/architecture.md)

## 라이선스

MIT License
