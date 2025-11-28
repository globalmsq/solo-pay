---
id: SPEC-SERVER-001
title: MSQPay 결제 서버 구현 계획 (Implementation Plan)
created_at: 2025-11-28
updated_at: 2025-11-28
status: draft
---

# SPEC-SERVER-001 구현 계획 (Implementation Plan)

## 1. 개요 (Overview)

이 문서는 SPEC-SERVER-001 (MSQPay 결제 서버)의 TDD 기반 구현 계획을 정의합니다. RED-GREEN-REFACTOR 사이클을 따르며, 테스트 커버리지 90% 이상을 목표로 합니다.

---

## 2. 구현 전략 (Implementation Strategy)

### 2.1 TDD 사이클 (RED-GREEN-REFACTOR)

```
1. RED Phase: 실패하는 테스트 작성
   ├─ 단위 테스트 (Unit Tests)
   ├─ 통합 테스트 (Integration Tests)
   └─ E2E 테스트 (End-to-End Tests)

2. GREEN Phase: 테스트 통과를 위한 최소 구현
   ├─ 핵심 로직 구현
   ├─ 에러 처리
   └─ 테스트 통과 확인

3. REFACTOR Phase: 코드 품질 개선
   ├─ 중복 제거
   ├─ 가독성 향상
   ├─ 성능 최적화
   └─ 문서화
```

### 2.2 구현 우선순위

**우선순위 1 (Primary Goals)**: 핵심 API 엔드포인트 및 블록체인 통합
- 결제 생성 API (POST /api/payments)
- 결제 조회 API (GET /api/payments/:paymentId)
- Gasless 결제 실행 API (POST /api/payments/:paymentId/execute)
- 데이터베이스 연동 (PostgreSQL)
- 블록체인 클라이언트 (viem)

**우선순위 2 (Secondary Goals)**: 캐싱 및 목록 조회
- Redis 캐싱 통합
- 결제 목록 API (GET /api/payments)
- 상점 통계 API (GET /api/stores/:storeAddress/stats)

**우선순위 3 (Tertiary Goals)**: 보안 및 성능 최적화
- Rate Limiting
- CORS 설정
- 성능 모니터링
- 로깅 및 에러 트래킹

---

## 3. 파일 구조 (File Structure)

```
packages/server/
├── src/
│   ├── routes/
│   │   ├── payments/
│   │   │   ├── create.ts          # POST /api/payments
│   │   │   ├── get.ts             # GET /api/payments/:paymentId
│   │   │   ├── execute.ts         # POST /api/payments/:paymentId/execute
│   │   │   ├── list.ts            # GET /api/payments
│   │   │   └── index.ts           # 라우트 등록
│   │   └── stores/
│   │       ├── stats.ts           # GET /api/stores/:storeAddress/stats
│   │       └── index.ts
│   ├── services/
│   │   ├── blockchain/
│   │   │   ├── viem-client.ts     # viem 블록체인 클라이언트
│   │   │   ├── gasless-executor.ts # OZ Defender Relayer
│   │   │   └── signature-verifier.ts # EIP-712 검증
│   │   ├── database/
│   │   │   ├── payment-repository.ts # PostgreSQL CRUD
│   │   │   └── migrations/
│   │   │       └── 001_create_payment_intents.sql
│   │   └── cache/
│   │       └── redis-client.ts    # Redis 캐싱
│   ├── middleware/
│   │   ├── validation.ts          # Zod 스키마 검증
│   │   ├── security.ts            # Rate Limiting, CORS
│   │   └── error-handler.ts       # 전역 에러 핸들러
│   ├── schemas/
│   │   ├── payment.schema.ts      # Zod 스키마 정의
│   │   └── eip712.schema.ts       # EIP-712 타입 정의
│   ├── types/
│   │   ├── payment.types.ts       # Payment 인터페이스
│   │   └── blockchain.types.ts    # 블록체인 타입
│   ├── config/
│   │   └── environment.ts         # 환경 변수 관리
│   └── server.ts                  # Fastify 서버 초기화
├── .env.example                    # 환경 변수 샘플
├── tests/
│   ├── routes/
│   │   ├── payments/
│   │   │   ├── create.test.ts
│   │   │   ├── get.test.ts
│   │   │   ├── execute.test.ts
│   │   │   └── list.test.ts
│   │   └── stores/
│   │       └── stats.test.ts
│   ├── services/
│   │   ├── blockchain/
│   │   │   ├── viem-client.test.ts
│   │   │   ├── gasless-executor.test.ts
│   │   │   └── signature-verifier.test.ts
│   │   ├── database/
│   │   │   └── payment-repository.test.ts
│   │   └── cache/
│   │       └── redis-client.test.ts
│   ├── middleware/
│   │   ├── validation.test.ts
│   │   └── security.test.ts
│   ├── integration/
│   │   ├── payment-flow.test.ts   # E2E: 결제 생성 → 실행 → 완료
│   │   └── gasless-flow.test.ts   # E2E: Gasless 트랜잭션 플로우
│   └── performance/
│       └── load.test.ts           # 성능 테스트 (100 req/s)
├── package.json
├── tsconfig.json
└── .env.example
```

---

## 4. TDD 구현 단계 (TDD Implementation Phases)

### Phase 1: 프로젝트 설정 및 인프라 (Infrastructure Setup)

**목표**: Fastify 서버, 데이터베이스, 블록체인 클라이언트 초기화

#### Step 1.1: Fastify 서버 초기화

**RED**:
```typescript
// tests/server.test.ts
describe('Fastify Server', () => {
  it('should start server on port 3000', async () => {
    const server = await createServer();
    await server.listen({ port: 3000 });
    expect(server.server.listening).toBe(true);
    await server.close();
  });
});
```

**GREEN**:
```typescript
// src/server.ts
import Fastify from 'fastify';

export async function createServer() {
  const fastify = Fastify({ logger: true });
  return fastify;
}
```

**REFACTOR**: 환경 변수 기반 설정, 로깅 개선

**환경 변수 설정 (.env.example)**:
```bash
# Server Configuration
PORT=3000
NODE_ENV=development

# Blockchain Configuration
POLYGON_RPC_URL=https://rpc-amoy.polygon.technology
CHAIN_ID=80002
PAYMENT_PROCESSOR_ADDRESS=0x...

# OpenZeppelin Defender
DEFENDER_API_KEY=your_defender_api_key
DEFENDER_SECRET_KEY=your_defender_secret_key
RELAYER_ADDRESS=0x...

# Database Configuration
DATABASE_URL=mysql://user:password@localhost:3306/msqpay
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis Configuration
REDIS_URL=redis://localhost:6379
REDIS_TTL_PAYMENT=60
REDIS_TTL_STATS=300

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_TIMEWINDOW=60000

# Payment Configuration
PAYMENT_EXPIRATION_MINUTES=15
MAX_GASLESS_CONCURRENT=10
```

#### Step 1.2: MySQL 연결 및 Migration

**RED**:
```typescript
// tests/services/database/payment-repository.test.ts
describe('PaymentRepository', () => {
  it('should connect to MySQL', async () => {
    const repo = new PaymentRepository();
    await repo.connect();
    expect(repo.isConnected()).toBe(true);
    await repo.disconnect();
  });
});
```

**GREEN**: MySQL 클라이언트 초기화 (mysql2 또는 Prisma)

**Migration SQL (src/services/database/migrations/001_create_payment_intents.sql)**:
```sql
-- Create payment_intents table
CREATE TABLE IF NOT EXISTS payment_intents (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  payment_id VARCHAR(36) UNIQUE NOT NULL,
  store_address VARCHAR(42) NOT NULL,
  token_address VARCHAR(42) NOT NULL,
  amount DECIMAL(78, 0) NOT NULL,
  customer_email VARCHAR(255),
  customer_address VARCHAR(42),
  metadata JSON,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  tx_hash VARCHAR(66),
  expires_at DATETIME(3) NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  completed_at DATETIME(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  CONSTRAINT check_amount_positive CHECK (amount > 0),
  CONSTRAINT check_status_valid CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'expired'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create indexes
CREATE INDEX idx_payment_intents_payment_id ON payment_intents(payment_id);
CREATE INDEX idx_payment_intents_store_address ON payment_intents(store_address);
CREATE INDEX idx_payment_intents_status ON payment_intents(status);
CREATE INDEX idx_payment_intents_created_at ON payment_intents(created_at DESC);
-- MySQL 8.0.13+ 지원 partial index (WHERE 조건)
-- ALTER TABLE payment_intents ADD INDEX idx_payment_intents_expires_at_pending (expires_at) WHERE status = 'pending';

-- 테이블 및 컬럼 설명
ALTER TABLE payment_intents COMMENT = 'MSQPay 결제 의도 저장 테이블 (Payment Intents)';
ALTER TABLE payment_intents MODIFY payment_id VARCHAR(36) COMMENT '서버 발급 UUID (클라이언트에 노출되는 ID)';
ALTER TABLE payment_intents MODIFY amount DECIMAL(78, 0) COMMENT 'Wei 단위 결제 금액 (uint256 compatible)';
ALTER TABLE payment_intents MODIFY status VARCHAR(20) COMMENT '결제 상태: pending, processing, completed, failed, expired';
ALTER TABLE payment_intents MODIFY expires_at DATETIME(3) COMMENT '결제 만료 시간 (생성 시간 + 15분)';
```

**REFACTOR**: 연결 풀 설정, 재연결 로직, migration runner 구현

#### Step 1.3: Redis 연결

**RED**:
```typescript
// tests/services/cache/redis-client.test.ts
describe('RedisClient', () => {
  it('should connect to Redis', async () => {
    const redis = new RedisClient();
    await redis.connect();
    expect(redis.isReady()).toBe(true);
    await redis.disconnect();
  });
});
```

**GREEN**: Redis 클라이언트 초기화 (ioredis)

**REFACTOR**: TTL 설정, 에러 처리

#### Step 1.4: viem 블록체인 클라이언트

**RED**:
```typescript
// tests/services/blockchain/viem-client.test.ts
describe('ViemClient', () => {
  it('should connect to Polygon Amoy', async () => {
    const client = new ViemClient();
    const chainId = await client.getChainId();
    expect(chainId).toBe(80002);
  });
});
```

**GREEN**: viem 클라이언트 초기화 (publicClient)

**REFACTOR**: RPC 엔드포인트 설정, 재시도 로직

---

### Phase 2: 결제 생성 API (POST /api/payments)

**목표**: 결제 생성 요청 수신 및 payment_intents 테이블 저장

#### Step 2.1: 입력 검증 (Zod)

**RED**:
```typescript
// tests/middleware/validation.test.ts
describe('Payment Creation Validation', () => {
  it('should reject invalid storeAddress', () => {
    const data = { storeAddress: 'invalid', tokenAddress: '0x123', amount: '1000' };
    expect(() => createPaymentSchema.parse(data)).toThrow();
  });

  it('should accept valid input', () => {
    const data = { storeAddress: '0x123...', tokenAddress: '0x456...', amount: '1000' };
    expect(createPaymentSchema.parse(data)).toEqual(data);
  });
});
```

**GREEN**:
```typescript
// src/schemas/payment.schema.ts
import { z } from 'zod';

export const createPaymentSchema = z.object({
  storeAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  amount: z.string().regex(/^\d+$/),
  customerEmail: z.string().email().optional(),
  metadata: z.record(z.any()).optional()
});
```

**REFACTOR**: 에러 메시지 개선, 재사용 가능한 검증 유틸

#### Step 2.2: 결제 생성 로직

**RED**:
```typescript
// tests/routes/payments/create.test.ts
describe('POST /api/payments', () => {
  it('should create payment and return paymentId', async () => {
    const response = await server.inject({
      method: 'POST',
      url: '/api/payments',
      payload: {
        storeAddress: '0x123...',
        tokenAddress: '0x456...',
        amount: '1000000000000000000'
      }
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toHaveProperty('paymentId');
    expect(response.json().status).toBe('pending');
  });
});
```

**GREEN**:
```typescript
// src/routes/payments/create.ts
import { v4 as uuidv4 } from 'uuid';

export async function createPayment(fastify: FastifyInstance) {
  fastify.post('/api/payments', async (request, reply) => {
    const data = createPaymentSchema.parse(request.body);
    const paymentId = uuidv4();
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15분

    await paymentRepository.create({
      paymentId,
      ...data,
      status: 'pending',
      expiresAt,
      createdAt: Date.now()
    });

    return reply.code(201).send({ paymentId, ...data, status: 'pending', expiresAt });
  });
}
```

**REFACTOR**: 트랜잭션 처리, 에러 핸들링

---

### Phase 3: 결제 조회 API (GET /api/payments/:paymentId)

**목표**: 결제 상태 조회 (Redis 캐시 활용)

#### Step 3.1: Redis 캐싱 조회

**RED**:
```typescript
// tests/routes/payments/get.test.ts
describe('GET /api/payments/:paymentId', () => {
  it('should return payment from cache', async () => {
    const paymentId = 'test-uuid';
    await redisClient.set(`payment:${paymentId}`, JSON.stringify({ paymentId, status: 'pending' }), 60);

    const response = await server.inject({
      method: 'GET',
      url: `/api/payments/${paymentId}`
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().paymentId).toBe(paymentId);
  });
});
```

**GREEN**:
```typescript
// src/routes/payments/get.ts
export async function getPayment(fastify: FastifyInstance) {
  fastify.get('/api/payments/:paymentId', async (request, reply) => {
    const { paymentId } = request.params;

    // Redis 캐시 조회
    const cached = await redisClient.get(`payment:${paymentId}`);
    if (cached) {
      return reply.send(JSON.parse(cached));
    }

    // DB 조회
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      return reply.code(404).send({ error: 'Payment not found' });
    }

    // Redis 캐싱
    await redisClient.set(`payment:${paymentId}`, JSON.stringify(payment), 60);
    return reply.send(payment);
  });
}
```

**REFACTOR**: 캐시 무효화 로직, TTL 최적화

---

### Phase 4: Gasless 결제 실행 API (POST /api/payments/:paymentId/execute)

**목표**: EIP-712 서명 검증 및 OpenZeppelin Defender Relayer를 통한 메타 트랜잭션 실행

#### Step 4.1: EIP-712 서명 검증

**RED**:
```typescript
// tests/services/blockchain/signature-verifier.test.ts
describe('SignatureVerifier', () => {
  it('should verify valid EIP-712 signature', async () => {
    const message = { paymentId: 'test', storeAddress: '0x123', amount: '1000', customerAddress: '0x456' };
    const signature = await wallet.signTypedData({ domain: EIP712_DOMAIN, types: PAYMENT_TYPE, message });

    const isValid = await signatureVerifier.verify(message, signature, '0x456');
    expect(isValid).toBe(true);
  });

  it('should reject invalid signature', async () => {
    const message = { paymentId: 'test', storeAddress: '0x123', amount: '1000', customerAddress: '0x456' };
    const signature = 'invalid-signature';

    const isValid = await signatureVerifier.verify(message, signature, '0x456');
    expect(isValid).toBe(false);
  });
});
```

**GREEN**:
```typescript
// src/services/blockchain/signature-verifier.ts
import { verifyTypedData } from 'viem';

export class SignatureVerifier {
  async verify(message: any, signature: string, customerAddress: string): Promise<boolean> {
    const recoveredAddress = await verifyTypedData({
      domain: EIP712_DOMAIN,
      types: PAYMENT_TYPE,
      message,
      signature
    });
    return recoveredAddress.toLowerCase() === customerAddress.toLowerCase();
  }
}
```

**REFACTOR**: 타입 안정성, 에러 처리

#### Step 4.2: OpenZeppelin Defender Relayer 통합

**RED**:
```typescript
// tests/services/blockchain/gasless-executor.test.ts
describe('GaslessExecutor', () => {
  it('should execute gasless transaction via OZ Defender', async () => {
    const payment = { paymentId: 'test', storeAddress: '0x123', tokenAddress: '0x456', amount: '1000', customerAddress: '0x789' };
    const txHash = await gaslessExecutor.execute(payment);

    expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });
});
```

**GREEN**:
```typescript
// src/services/blockchain/gasless-executor.ts
import { Defender } from '@openzeppelin/defender-sdk';

export class GaslessExecutor {
  private defender: Defender;

  constructor() {
    this.defender = new Defender({ apiKey: process.env.DEFENDER_API_KEY, apiSecret: process.env.DEFENDER_API_SECRET });
  }

  async execute(payment: Payment): Promise<string> {
    const tx = await this.defender.relaySigner.sendTransaction({
      to: PAYMENT_PROCESSOR_ADDRESS,
      data: encodeFunctionData({
        abi: PAYMENT_PROCESSOR_ABI,
        functionName: 'executePayment',
        args: [payment.storeAddress, payment.tokenAddress, payment.amount, payment.customerAddress]
      })
    });
    return tx.hash;
  }
}
```

**REFACTOR**: 재시도 로직, 동시 실행 제한 (최대 10개)

#### Step 4.3: 결제 실행 API 통합

**RED**:
```typescript
// tests/routes/payments/execute.test.ts
describe('POST /api/payments/:paymentId/execute', () => {
  it('should execute gasless payment and return txHash', async () => {
    const paymentId = 'test-uuid';
    const signature = await wallet.signTypedData({ domain: EIP712_DOMAIN, types: PAYMENT_TYPE, message: { paymentId, ... } });

    const response = await server.inject({
      method: 'POST',
      url: `/api/payments/${paymentId}/execute`,
      payload: { customerAddress: '0x123', signature }
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().status).toBe('processing');
    expect(response.json()).toHaveProperty('txHash');
  });

  it('should reject expired payment', async () => {
    const expiredPaymentId = 'expired-uuid';
    await paymentRepository.create({ paymentId: expiredPaymentId, expiresAt: Date.now() - 1000, ... });

    const response = await server.inject({
      method: 'POST',
      url: `/api/payments/${expiredPaymentId}/execute`,
      payload: { customerAddress: '0x123', signature: 'valid-signature' }
    });

    expect(response.statusCode).toBe(410);
  });
});
```

**GREEN**: API 엔드포인트 구현 (검증 → 실행 → 상태 업데이트)

**REFACTOR**: 트랜잭션 모니터링, 상태 전환 로직

---

### Phase 5: 결제 목록 및 통계 API

**목표**: 결제 목록 조회 및 상점 통계 제공

#### Step 5.1: 결제 목록 API (GET /api/payments)

**RED**:
```typescript
// tests/routes/payments/list.test.ts
describe('GET /api/payments', () => {
  it('should return paginated payments', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/payments?limit=10&offset=0'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('payments');
    expect(response.json().payments.length).toBeLessThanOrEqual(10);
  });
});
```

**GREEN**: 페이지네이션 쿼리 구현

**REFACTOR**: 필터링 최적화, 인덱스 활용

#### Step 5.2: 상점 통계 API (GET /api/stores/:storeAddress/stats)

**RED**:
```typescript
// tests/routes/stores/stats.test.ts
describe('GET /api/stores/:storeAddress/stats', () => {
  it('should return store statistics', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/stores/0x123.../stats'
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty('totalPayments');
    expect(response.json()).toHaveProperty('successRate');
  });
});
```

**GREEN**: 통계 집계 쿼리 구현 (PostgreSQL)

**REFACTOR**: Redis 캐싱 (TTL: 300초)

---

### Phase 6: 보안 및 성능 최적화

**목표**: Rate Limiting, CORS, 성능 테스트

#### Step 6.1: Rate Limiting

**RED**:
```typescript
// tests/middleware/security.test.ts
describe('Rate Limiting', () => {
  it('should block requests exceeding 100/min', async () => {
    for (let i = 0; i < 101; i++) {
      await server.inject({ method: 'GET', url: '/api/payments' });
    }

    const response = await server.inject({ method: 'GET', url: '/api/payments' });
    expect(response.statusCode).toBe(429);
  });
});
```

**GREEN**: @fastify/rate-limit 플러그인 적용

**REFACTOR**: IP별 제한 설정

#### Step 6.2: 성능 테스트

**RED**:
```typescript
// tests/performance/load.test.ts
describe('Performance Test', () => {
  it('should handle 100 concurrent requests', async () => {
    const requests = Array(100).fill(null).map(() =>
      server.inject({ method: 'POST', url: '/api/payments', payload: validPayload })
    );

    const responses = await Promise.all(requests);
    const successRate = responses.filter(r => r.statusCode === 201).length / 100;
    expect(successRate).toBeGreaterThan(0.95);
  });
});
```

**GREEN**: 최적화 (연결 풀, 캐싱, 인덱스)

**REFACTOR**: 모니터링 대시보드

---

## 5. 테스트 전략 (Testing Strategy)

### 5.1 테스트 분류

| 테스트 타입 | 비중 | 도구 | 커버리지 목표 |
|------------|------|------|--------------|
| **단위 테스트** (Unit) | 60% | Vitest | 95% |
| **통합 테스트** (Integration) | 30% | Vitest + Testcontainers | 85% |
| **E2E 테스트** (End-to-End) | 10% | Playwright | 핵심 플로우 100% |

### 5.2 테스트 환경

**로컬 개발**:
- PostgreSQL: Docker container (testcontainers)
- Redis: Docker container (testcontainers)
- Blockchain: Hardhat local node 또는 Polygon Amoy Testnet

**CI/CD**:
- GitHub Actions
- 테스트 DB: Ephemeral containers
- 블록체인: Fork된 Polygon Amoy

### 5.3 Mocking 전략

**Mock 사용**:
- OpenZeppelin Defender API (단위 테스트)
- viem RPC 호출 (단위 테스트)

**실제 연동**:
- PostgreSQL (통합 테스트)
- Redis (통합 테스트)
- 블록체인 (E2E 테스트 - Testnet)

---

## 6. 기술 스택 (Technology Stack)

### 6.1 백엔드 프레임워크

| 구분 | 라이브러리 | 버전 | 용도 |
|------|-----------|------|------|
| **Web Framework** | Fastify | ^4.26.0 | HTTP 서버 |
| **Validation** | Zod | ^3.22.0 | 스키마 검증 |
| **Blockchain** | viem | ^2.0.0 | Ethereum 클라이언트 |
| **Gasless TX** | @openzeppelin/defender-sdk | ^1.12.0 | Relayer 통합 |
| **Database** | mysql2 | ^3.9.0 | MySQL 드라이버 |
| **Cache** | ioredis | ^5.3.0 | Redis 클라이언트 |
| **Testing** | Vitest | ^1.3.0 | 테스트 프레임워크 |
| **E2E Testing** | Playwright | ^1.42.0 | 브라우저 테스트 |

### 6.2 개발 도구

- **TypeScript**: 5.9+
- **ESLint**: 코드 품질
- **Prettier**: 코드 포맷팅
- **Husky**: Git hooks (pre-commit 테스트)

---

## 7. 마일스톤 (Milestones)

### 마일스톤 1: 인프라 설정 완료
- Fastify 서버 초기화
- MySQL 연결
- Redis 연결
- viem 클라이언트 초기화

### 마일스톤 2: 핵심 API 구현
- 결제 생성 API
- 결제 조회 API
- Gasless 결제 실행 API

### 마일스톤 3: 추가 기능 구현
- 결제 목록 API
- 상점 통계 API

### 마일스톤 4: 보안 및 성능 최적화
- Rate Limiting
- CORS 설정
- 성능 테스트 통과 (100 req/s)

### 마일스톤 5: 테스트 커버리지 달성
- 단위 테스트 커버리지 95%
- 통합 테스트 커버리지 85%
- E2E 테스트 핵심 플로우 100%

---

## 8. 리스크 및 대응 방안 (Risks & Mitigation)

### 리스크 1: OpenZeppelin Defender Relayer 제한 (최대 10 동시 트랜잭션)

**영향**: 높은 트래픽 시 Gasless 트랜잭션 대기 발생

**대응**:
- 큐 시스템 도입 (Bull Queue)
- 우선순위 기반 처리
- Direct Payment 우회 옵션 제공

### 리스크 2: 블록체인 트랜잭션 지연

**영향**: 결제 상태 업데이트 지연

**대응**:
- 트랜잭션 모니터링 (viem watchTransaction)
- 상태 업데이트 Webhook
- 사용자에게 예상 확인 시간 표시

### 리스크 3: 데이터베이스 성능 저하

**영향**: API 응답 시간 증가

**대응**:
- Redis 캐싱 강화
- PostgreSQL 인덱스 최적화
- 읽기 전용 복제본 활용

---

## 9. 다음 단계 (Next Steps)

1. **/moai:2-run SPEC-SERVER-001** 실행 → TDD 구현 시작
2. 각 Phase별 RED-GREEN-REFACTOR 사이클 진행
3. 테스트 커버리지 90% 달성 확인
4. **/moai:3-sync SPEC-SERVER-001** 실행 → API 문서 생성

---

**작성 도구**: MoAI-ADK workflow-spec
**준수 프레임워크**: TRUST 5, SPEC-First TDD
**구현 방법론**: Test-Driven Development (RED-GREEN-REFACTOR)
