[English](contribute.md) | [한국어](contribute.ko.md)

# 코드 기여하기

MSQPay 프로젝트에 기여하는 방법입니다.

## 로컬 개발 환경 셋업

### 1. 저장소 클론

```bash
git clone https://github.com/globalmsq/msqpay-monorepo.git
cd msqpay-monorepo
```

### 2. 의존성 설치

```bash
# pnpm 설치 (없으면)
npm install -g pnpm

# 의존성 설치
pnpm install
```

### 3. Docker 환경 시작

```bash
cd docker
docker-compose up -d

# 서비스 상태 확인
docker-compose ps
```

### 4. 빌드 확인

```bash
# 모든 패키지 빌드
pnpm build

# TypeScript 검사
pnpm exec tsc --noEmit
```

### 5. 테스트 실행

```bash
# 전체 테스트
pnpm test

# 커버리지
pnpm test:coverage
```

## 코드 작성 가이드

### 코드 스타일

- **언어**: TypeScript
- **린트**: ESLint
- **포맷터**: Prettier
- **테스트**: Vitest
- **커버리지**: 최소 85%

### 커밋 메시지

```bash
# 형식
<type>: <subject>

# 예시
feat: add payment history API
fix: resolve nonce conflict in gasless payment
docs: update SDK installation guide
test: add unit tests for createPayment
```

**Type**:

- `feat`: 새 기능
- `fix`: 버그 수정
- `docs`: 문서 변경
- `test`: 테스트 추가/수정
- `refactor`: 리팩토링
- `chore`: 기타 변경

### 브랜치 전략

```bash
# 기능 개발
git checkout -b feature/payment-history

# 버그 수정
git checkout -b fix/nonce-conflict

# 문서 수정
git checkout -b docs/sdk-readme
```

## PR 프로세스

### 1. 브랜치 생성

```bash
git checkout -b feature/your-feature
```

### 2. 코드 작성

```typescript
// 코드 작성
// 테스트 작성
// 문서 업데이트
```

### 3. 린트 및 테스트

```bash
# 린트
pnpm lint

# 테스트
pnpm test

# 빌드
pnpm build
```

### 4. 커밋

```bash
git add .
git commit -m "feat: add payment history API"
```

### 5. Push 및 PR 생성

```bash
git push origin feature/your-feature

# GitHub에서 PR 생성
# 템플릿에 따라 작성:
# - 변경 사항 설명
# - 테스트 방법
# - 체크리스트 확인
```

### 6. 코드 리뷰

- PR 생성 후 리뷰 대기
- 리뷰어 피드백 반영
- CI 테스트 통과 확인

### 7. 머지

- 리뷰 승인 후 머지
- Squash and Merge 사용

## 디렉토리 구조

```
msqpay-monorepo/
├── contracts/             # Smart Contracts (Hardhat)
├── packages/
│   ├── sdk/              # TypeScript SDK
│   ├── pay-server/       # Payment Server (Fastify)
│   └── simple-relayer/   # Local Relayer
├── apps/
│   └── demo/             # Demo Web App
├── subgraph/             # The Graph Subgraph
└── docs/                 # Documentation
```

## 개발 워크플로우

### 결제서버 개발

```bash
cd packages/pay-server
pnpm dev

# 테스트
pnpm test

# 빌드
pnpm build
```

### SDK 개발

```bash
cd packages/sdk
pnpm dev

# 테스트
pnpm test

# 빌드
pnpm build
```

### Demo 앱 개발

```bash
cd apps/demo
pnpm dev

# 브라우저: http://localhost:3000
```

## 테스트 작성

### Unit 테스트

```typescript
import { describe, it, expect } from 'vitest';
import { MSQPayClient } from '../src';

describe('MSQPayClient', () => {
  it('should create payment', async () => {
    const client = new MSQPayClient({
      environment: 'development',
      apiKey: 'test-key',
    });

    const payment = await client.createPayment({
      merchantId: 'merchant_001',
      amount: 100,
      chainId: 31337,
      tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
    });

    expect(payment.paymentId).toBeDefined();
  });
});
```

### E2E 테스트

```typescript
import { test, expect } from '@playwright/test';

test('should process payment', async ({ page }) => {
  await page.goto('http://localhost:3000');

  await page.click('[data-testid="pay-button"]');

  await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
});
```

## 문서 업데이트

### 문서 구조

```
docs/
├── getting-started.md              # 시작하기
├── guides/                         # 사용 가이드
│   ├── integrate-payment.ko.md
│   ├── deploy-server.md
│   └── contribute.md (이 문서)
├── reference/                      # 참고 자료
│   ├── api.md
│   ├── sdk.md
│   ├── errors.md
│   └── architecture.md
└── releases/                       # 릴리스 정보
    ├── changelog.md
    └── migration-v2.md
```

### 문서 작성 가이드

- Markdown 형식 사용
- 코드 예제 포함
- 명확한 단계별 설명
- 스크린샷 추가 (필요시)

## 도움이 필요하신가요?

- **Issue**: https://github.com/globalmsq/msqpay-monorepo/issues
- **Discussions**: https://github.com/globalmsq/msqpay-monorepo/discussions
- **Email**: support@msq.com

## 관련 문서

- [시작하기](../getting-started.ko.md) - 로컬 환경 셋업
- [결제 통합하기](integrate-payment.ko.md) - SDK 사용법
- [API 레퍼런스](../reference/api.ko.md) - API 문서
