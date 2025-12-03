# Pay-Server 멀티체인 + 멀티토큰 지원 설계 문서

> **Version**: 1.0.0
> **Date**: 2025-12-03
> **Status**: Approved
> **Author**: R2-D2 / Harry님

---

## 개요

Pay-Server에 멀티체인 및 멀티토큰 지원을 추가하여, 단일 서버 인스턴스에서 여러 블록체인 네트워크와 다양한 ERC20 토큰을 동시에 처리할 수 있도록 합니다.

### 핵심 기능
- JSON 기반 체인 설정 (환경별 분리)
- 체인별 멀티토큰 지원
- 토큰 검증 (심볼 + 주소 일치 확인)
- 동적 체인 초기화

---

## 문제 요약

`BlockchainService`에서 Polygon 메인넷이 하드코딩되어 있어 로컬 Hardhat 노드에 연결해도 실제 블록체인 쿼리가 실패합니다.

**근본 원인**: `blockchain.service.ts:84`에서 `chain: polygon` 하드코딩

## 목표

- 멀티체인 동시 지원 (Polygon, BSC, Ethereum 등)
- **멀티토큰 지원** (체인별로 지원하는 토큰 목록 관리)
- 환경별 분리 (프로덕션: 메인넷들, 개발: 테스트넷/로컬)
- 결제 서버가 체인 설정(RPC URL, 서브그래프 URL, 컨트랙트 주소, **토큰 목록**) 보유
- 상점 서버는 `chainId` + `tokenSymbol` + `tokenAddress` + `amount` 전달
- **토큰 검증**: 심볼 존재 여부 + 주소 일치 여부 모두 확인
- 미지원 체인/토큰 요청 시 단순 에러 반환 (보안상 목록 노출 안함)

---

## 수정 파일 목록

### Pay-Server
1. `packages/pay-server/src/config/chains.config.ts` - Zod 스키마 + 설정 로더 (신규)
2. `packages/pay-server/chains.json` - 로컬 개발용 (Hardhat) (신규)
3. `packages/pay-server/chains.testnet.json` - 테스트넷용 (Amoy, BSC Testnet, Sepolia) (신규)
4. `packages/pay-server/chains.production.json` - 프로덕션용 (Polygon, BSC) (신규)
5. `packages/pay-server/.env.example` - CHAINS_CONFIG_PATH 환경변수
6. `packages/pay-server/src/services/blockchain.service.ts` - 멀티체인 + 멀티토큰 지원
7. `packages/pay-server/src/index.ts` - 체인 설정 로드 및 서비스 초기화
8. `packages/pay-server/src/routes/payments/status.ts` - chainId 쿼리 파라미터 추가
9. `packages/pay-server/src/routes/payments/history.ts` - chainId 파라미터 추가
10. `packages/pay-server/src/routes/payments/create.ts` - chainId + 토큰 검증 로직

### Demo App
11. `apps/demo/src/lib/api.ts` - getPaymentStatus()에 chainId 파라미터 추가
12. `apps/demo/src/components/PaymentModal.tsx` - pollPaymentStatus()에 chainId 전달

---

## 상세 구현 계획

### Step 1: 체인 설정 JSON 파일 생성

**파일**: `packages/pay-server/chains.json` (예시: 개발용)

```json
{
  "chains": [
    {
      "chainId": 31337,
      "name": "Hardhat",
      "rpcUrl": "http://localhost:8545",
      "subgraphUrl": "http://localhost:8000/subgraphs/name/msqpay",
      "nativeCurrency": {
        "name": "Ether",
        "symbol": "ETH",
        "decimals": 18
      },
      "contracts": {
        "gateway": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
        "forwarder": "0x5FbDB2315678afecb367f032d93F642f64180aa3"
      },
      "tokens": {
        "TEST": {
          "address": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
          "decimals": 18
        }
      }
    }
  ]
}
```

**파일**: `packages/pay-server/chains.testnet.json` (예시: 테스트넷용)

```json
{
  "chains": [
    {
      "chainId": 80002,
      "name": "Polygon Amoy",
      "rpcUrl": "https://rpc-amoy.polygon.technology",
      "subgraphUrl": "https://api.studio.thegraph.com/query/.../msqpay-amoy/...",
      "nativeCurrency": {
        "name": "POL",
        "symbol": "POL",
        "decimals": 18
      },
      "contracts": {
        "gateway": "0x...",
        "forwarder": "0x..."
      },
      "tokens": {
        "USDC": { "address": "0x...", "decimals": 6 },
        "USDT": { "address": "0x...", "decimals": 6 }
      }
    },
    {
      "chainId": 97,
      "name": "BSC Testnet",
      "rpcUrl": "https://data-seed-prebsc-1-s1.binance.org:8545",
      "subgraphUrl": "https://api.studio.thegraph.com/query/.../msqpay-bsc-testnet/...",
      "nativeCurrency": {
        "name": "tBNB",
        "symbol": "tBNB",
        "decimals": 18
      },
      "contracts": {
        "gateway": "0x...",
        "forwarder": "0x..."
      },
      "tokens": {
        "USDT": { "address": "0x...", "decimals": 18 }
      }
    },
    {
      "chainId": 11155111,
      "name": "Sepolia",
      "rpcUrl": "https://rpc.sepolia.org",
      "subgraphUrl": "https://api.studio.thegraph.com/query/.../msqpay-sepolia/...",
      "nativeCurrency": {
        "name": "Sepolia Ether",
        "symbol": "ETH",
        "decimals": 18
      },
      "contracts": {
        "gateway": "0x...",
        "forwarder": "0x..."
      },
      "tokens": {
        "USDC": { "address": "0x...", "decimals": 6 }
      }
    }
  ]
}
```

**파일**: `packages/pay-server/chains.production.json` (예시: 프로덕션용)

```json
{
  "chains": [
    {
      "chainId": 137,
      "name": "Polygon",
      "rpcUrl": "https://polygon-rpc.com",
      "subgraphUrl": "https://api.thegraph.com/subgraphs/name/msqpay/polygon",
      "nativeCurrency": {
        "name": "POL",
        "symbol": "POL",
        "decimals": 18
      },
      "contracts": {
        "gateway": "0x...",
        "forwarder": "0x..."
      },
      "tokens": {
        "USDC": { "address": "0x...", "decimals": 6 },
        "USDT": { "address": "0x...", "decimals": 6 }
      }
    },
    {
      "chainId": 56,
      "name": "BSC",
      "rpcUrl": "https://bsc-dataseed.binance.org",
      "subgraphUrl": "https://api.thegraph.com/subgraphs/name/msqpay/bsc",
      "nativeCurrency": {
        "name": "BNB",
        "symbol": "BNB",
        "decimals": 18
      },
      "contracts": {
        "gateway": "0x...",
        "forwarder": "0x..."
      },
      "tokens": {
        "USDT": { "address": "0x...", "decimals": 18 }
      }
    }
  ]
}
```

### Step 2: 체인 설정 로더 모듈

**파일**: `packages/pay-server/src/config/chains.config.ts` (신규)

```typescript
import { readFileSync } from 'fs';
import { z } from 'zod';

// Zod 스키마로 설정 검증
const TokenConfigSchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  decimals: z.number().int().min(0).max(18),
});

const NativeCurrencySchema = z.object({
  name: z.string(),
  symbol: z.string(),
  decimals: z.number().int().min(0).max(18),
});

const ChainConfigSchema = z.object({
  chainId: z.number().int().positive(),
  name: z.string(),
  rpcUrl: z.string().url(),
  subgraphUrl: z.string().url().optional(),
  nativeCurrency: NativeCurrencySchema,
  contracts: z.object({
    gateway: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
    forwarder: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  }),
  tokens: z.record(z.string(), TokenConfigSchema),
});

const ChainsConfigSchema = z.object({
  chains: z.array(ChainConfigSchema),
});

export type ChainConfig = z.infer<typeof ChainConfigSchema>;
export type ChainsConfig = z.infer<typeof ChainsConfigSchema>;

export function loadChainsConfig(configPath: string): ChainsConfig {
  const raw = readFileSync(configPath, 'utf-8');
  const parsed = JSON.parse(raw);
  return ChainsConfigSchema.parse(parsed);
}
```

### Step 3: 환경변수 수정

**파일**: `packages/pay-server/.env.example`

```bash
# Chain configuration file path
# Default: ./chains.json
CHAINS_CONFIG_PATH=./chains.json
```

### Step 4: BlockchainService 멀티체인 지원

**파일**: `packages/pay-server/src/services/blockchain.service.ts`

핵심 변경:
- 단일 `publicClient` → `Map<number, PublicClient>`
- JSON 설정에서 체인 정보 로드
- 모든 메서드에 chainId 파라미터 추가

```typescript
import { createPublicClient, http, defineChain, PublicClient, Address } from 'viem';
import { ChainConfig, ChainsConfig } from '../config/chains.config';

export class BlockchainService {
  private clients: Map<number, PublicClient> = new Map();
  private chainConfigs: Map<number, ChainConfig> = new Map();

  constructor(config: ChainsConfig) {
    for (const chainConfig of config.chains) {
      const chain = defineChain({
        id: chainConfig.chainId,
        name: chainConfig.name,
        nativeCurrency: chainConfig.nativeCurrency, // JSON 설정에서 로드
        rpcUrls: {
          default: { http: [chainConfig.rpcUrl] },
        },
      });

      const client = createPublicClient({
        chain,
        transport: http(chainConfig.rpcUrl),
      });

      this.clients.set(chainConfig.chainId, client);
      this.chainConfigs.set(chainConfig.chainId, chainConfig);

      console.log(`🔗 Chain ${chainConfig.name} (${chainConfig.chainId}) initialized: ${chainConfig.rpcUrl}`);
    }
  }

  isChainSupported(chainId: number): boolean {
    return this.clients.has(chainId);
  }

  getSupportedChainIds(): number[] {
    return Array.from(this.clients.keys());
  }

  getChainConfig(chainId: number): ChainConfig {
    const config = this.chainConfigs.get(chainId);
    if (!config) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }
    return config;
  }

  private getClient(chainId: number): PublicClient {
    const client = this.clients.get(chainId);
    if (!client) {
      throw new Error(`Unsupported chain: ${chainId}`);
    }
    return client;
  }

  // 토큰 검증: 심볼 존재 + 주소 일치 확인
  validateToken(chainId: number, tokenSymbol: string, tokenAddress: string): boolean {
    const config = this.getChainConfig(chainId);
    const token = config.tokens[tokenSymbol];

    if (!token) {
      return false; // 심볼 미존재
    }

    if (token.address.toLowerCase() !== tokenAddress.toLowerCase()) {
      return false; // 주소 불일치
    }

    return true;
  }

  getTokenConfig(chainId: number, tokenSymbol: string): TokenConfig | null {
    const config = this.chainConfigs.get(chainId);
    if (!config) return null;
    return config.tokens[tokenSymbol] || null;
  }

  async getPaymentStatus(chainId: number, paymentId: string): Promise<PaymentStatus | null> {
    const client = this.getClient(chainId);
    const config = this.getChainConfig(chainId);
    const contractAddress = config.contracts.gateway as Address;
    // ... 기존 로직 (this.publicClient → client)
  }

  // 다른 메서드들도 동일하게 chainId 파라미터 추가
}
```

### Step 5: 서비스 초기화 수정

**파일**: `packages/pay-server/src/index.ts`

```typescript
import { loadChainsConfig } from './config/chains.config';

// 체인 설정 파일 로드
const configPath = process.env.CHAINS_CONFIG_PATH || './chains.json';
const chainsConfig = loadChainsConfig(configPath);

console.log(`📋 Loading chain config from: ${configPath}`);
console.log(`🔗 Supported chains: ${chainsConfig.chains.map(c => `${c.name}(${c.chainId})`).join(', ')}`);

// 멀티체인 BlockchainService 초기화
const blockchainService = new BlockchainService(chainsConfig);
```

### Step 6: Status API 수정

**파일**: `packages/pay-server/src/routes/payments/status.ts`

클라이언트가 chainId를 함께 전달하는 방식:

```typescript
// 라우트 변경: chainId를 쿼리 파라미터로 받음
// GET /payments/:paymentId/status?chainId=31337

server.get('/payments/:paymentId/status', async (request, reply) => {
  const { paymentId } = request.params;
  const { chainId } = request.query;

  if (!chainId) {
    return reply.status(400).send({ error: 'chainId is required' });
  }

  const status = await blockchainService.getPaymentStatus(Number(chainId), paymentId);
  return reply.send(status);
});
```

**플로우**:
1. 상점 서버 → 결제 서버: 결제 생성 (chainId 포함)
2. 결제 서버 → 상점 서버: paymentId 반환
3. 상점 서버 → 클라이언트: paymentId + chainId + 결제 정보
4. 클라이언트 → 결제 서버: status 조회 시 chainId 함께 전달

**별도 매핑 저장소 불필요** - 상점 서버가 이미 chainId를 알고 클라이언트에게 전달함

### Step 7: Create API 토큰 검증 추가

**파일**: `packages/pay-server/src/routes/payments/create.ts`

결제 생성 시 체인 + 토큰 검증:

```typescript
// POST /payments/create
// Body: { chainId, tokenSymbol, tokenAddress, amount, merchantId, ... }

server.post('/payments/create', async (request, reply) => {
  const { chainId, tokenSymbol, tokenAddress, amount, ...rest } = request.body;

  // 1. 체인 지원 여부 확인
  if (!blockchainService.isChainSupported(chainId)) {
    return reply.status(400).send({ error: 'Unsupported chain' });
  }

  // 2. 토큰 검증: 심볼 존재 + 주소 일치
  if (!blockchainService.validateToken(chainId, tokenSymbol, tokenAddress)) {
    return reply.status(400).send({ error: 'Unsupported token' });
  }

  // 3. 토큰 설정 가져오기 (decimals 등)
  const tokenConfig = blockchainService.getTokenConfig(chainId, tokenSymbol);

  // 4. 결제 생성 로직...
  const payment = await createPayment({
    chainId,
    tokenSymbol,
    tokenAddress,
    tokenDecimals: tokenConfig.decimals,
    amount,
    ...rest
  });

  return reply.send({ paymentId: payment.id, chainId });
});
```

**요청 예시**:
```json
{
  "chainId": 137,
  "tokenSymbol": "USDC",
  "tokenAddress": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
  "amount": "10.00",
  "merchantId": "shop-001"
}
```

**검증 흐름**:
1. chainId 137 (Polygon) 지원 확인
2. USDC 심볼이 Polygon 설정에 존재하는지 확인
3. 요청된 주소와 설정된 USDC 주소가 일치하는지 확인
4. 모두 통과 시 결제 생성

---

## 아키텍처 변경 요약

```
Before:
  BlockchainService (single chain: Polygon)
    └─ publicClient
    └─ contractAddress

After:
  BlockchainService (multi-chain + multi-token)
    └─ clients: Map<chainId, PublicClient>
    └─ chainConfigs: Map<chainId, ChainConfig>
    │     └─ tokens: { USDC: {...}, USDT: {...} }
    ├─ isChainSupported(chainId)
    ├─ validateToken(chainId, symbol, address)
    ├─ getTokenConfig(chainId, symbol)
    └─ getPaymentStatus(chainId, paymentId)
```

**결제 요청 플로우**:
```
상점 서버 → Pay Server
  POST /payments/create
  Body: { chainId, tokenSymbol, tokenAddress, amount, ... }

Pay Server 검증:
  1. isChainSupported(chainId) → Unsupported chain
  2. validateToken(chainId, symbol, address) → Unsupported token
  3. 통과 시 결제 생성
```

---

## 테스트 검증

### 설정 파일 (로컬 개발)

`packages/pay-server/chains.json` 파일에 Hardhat 체인 설정이 포함되어야 함

### 환경변수
```bash
CHAINS_CONFIG_PATH=./chains.json
```

### 검증 항목

**체인 검증**:
1. 서버 시작 시 체인 초기화 로그: `🔗 Chain Hardhat (31337) initialized: http://localhost:8545`
2. 미지원 체인 요청: `chainId: 999` → `400 Unsupported chain`

**토큰 검증**:
3. 유효한 토큰: `{ chainId: 31337, tokenSymbol: "TEST", tokenAddress: "0xe7f..." }` → 성공
4. 미존재 심볼: `{ chainId: 31337, tokenSymbol: "FAKE", tokenAddress: "0x..." }` → `400 Unsupported token`
5. 주소 불일치: `{ chainId: 31337, tokenSymbol: "TEST", tokenAddress: "0xWRONG..." }` → `400 Unsupported token`

**결제 플로우**:
6. 결제 생성: `POST /payments/create` with 유효한 chain + token → paymentId 반환
7. 상태 조회: `GET /payments/:id/status?chainId=31337` → 실제 블록체인 상태 반환

---

## 환경별 설정 가이드

| 환경 | 설정 파일 | 체인 목록 | 사용 시점 |
|------|----------|----------|----------|
| 로컬 개발 | `chains.json` | Hardhat (31337) | 로컬 테스트, E2E 테스트 |
| 테스트넷 | `chains.testnet.json` | Amoy (80002), BSC Testnet (97), Sepolia (11155111) | 스테이징, QA |
| 프로덕션 | `chains.production.json` | Polygon (137), BSC (56) | 라이브 서비스 |

### 환경변수 설정 예시

```bash
# 로컬 개발
export CHAINS_CONFIG_PATH=./chains.json

# 테스트넷 (CI/CD)
export CHAINS_CONFIG_PATH=./chains.testnet.json

# 프로덕션 (Docker/K8s)
export CHAINS_CONFIG_PATH=./chains.production.json
```

---

## 구현 우선순위

1. **Phase 1**: 핵심 인프라 (Step 1-5)
   - chains.config.ts 로더 모듈
   - chains.json 설정 파일들
   - BlockchainService 멀티체인 리팩토링
   - 서비스 초기화 수정

2. **Phase 2**: API 수정 (Step 6-7)
   - status API에 chainId 파라미터 추가
   - create API에 토큰 검증 로직 추가

3. **Phase 3**: 클라이언트 수정
   - Demo App API 호출에 chainId 전달

---

## 참조 파일

- 현재 chains.ts: `packages/pay-server/src/config/chains.ts`
- 현재 BlockchainService: `packages/pay-server/src/services/blockchain.service.ts`
- 패턴 참조: `packages/simple-defender/src/services/relay.service.ts:123-137`

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|----------|
| 1.0.0 | 2025-12-03 | 초기 설계 문서 작성 |
