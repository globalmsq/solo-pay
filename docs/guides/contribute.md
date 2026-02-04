[English](contribute.md) | [한국어](contribute.ko.md)

# Contributing to SoloPay

How to contribute to the SoloPay project.

## Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/globalmsq/solopay-monorepo.git
cd solopay-monorepo
```

### 2. Install Dependencies

```bash
# Install pnpm (if not already installed)
npm install -g pnpm

# Install dependencies
pnpm install
```

### 3. Start Docker Environment

```bash
cd docker
docker-compose up -d

# Check service status
docker-compose ps
```

### 4. Verify Build

```bash
# Build all packages
pnpm build

# Check TypeScript
pnpm exec tsc --noEmit
```

### 5. Run Tests

```bash
# All tests
pnpm test

# Coverage
pnpm test:coverage
```

## Code Guidelines

### Code Style

- **Language**: TypeScript
- **Linter**: ESLint
- **Formatter**: Prettier
- **Testing**: Vitest
- **Coverage**: Minimum 85%

### Commit Messages

```bash
# Format
<type>: <subject>

# Examples
feat: add payment history API
fix: resolve nonce conflict in gasless payment
docs: update SDK installation guide
test: add unit tests for createPayment
```

**Types**:

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `test`: Add/modify tests
- `refactor`: Code refactoring
- `chore`: Other changes

### Branching Strategy

```bash
# Feature development
git checkout -b feature/payment-history

# Bug fixes
git checkout -b fix/nonce-conflict

# Documentation
git checkout -b docs/sdk-readme
```

## Pull Request Process

### 1. Create Branch

```bash
git checkout -b feature/your-feature
```

### 2. Write Code

```typescript
// Write code
// Write tests
// Update documentation
```

### 3. Lint and Test

```bash
# Lint
pnpm lint

# Test
pnpm test

# Build
pnpm build
```

### 4. Commit

```bash
git add .
git commit -m "feat: add payment history API"
```

### 5. Push and Create PR

```bash
git push origin feature/your-feature

# Create PR on GitHub
# Follow template:
# - Describe changes
# - Testing method
# - Check checklist
```

### 6. Code Review

- Wait for review after PR creation
- Address reviewer feedback
- Verify CI tests pass

### 7. Merge

- Merge after review approval
- Use Squash and Merge

## Directory Structure

```
solopay-monorepo/
├── packages/
│   ├── contracts/        # Smart Contracts (Hardhat)
│   ├── demo/             # Demo Web App (Next.js)
│   ├── guide/            # Documentation Site
│   ├── integration-tests/# Integration Tests
│   ├── gateway/          # Pay Gateway (Fastify)
│   ├── gateway-sdk/      # TypeScript SDK
│   ├── simple-relayer/   # Local Relayer
│   └── subgraph/         # The Graph Subgraph
└── docs/                 # Documentation
```

## Development Workflow

### Pay Gateway Development

```bash
cd packages/gateway
pnpm dev

# Test
pnpm test

# Build
pnpm build
```

### SDK Development

```bash
cd packages/gateway-sdk
pnpm dev

# Test
pnpm test

# Build
pnpm build
```

### Demo App Development

```bash
cd packages/demo
pnpm dev

# Browser: http://localhost:3000
```

## Writing Tests

### Unit Tests

```typescript
import { describe, it, expect } from 'vitest';
import { SoloPayClient } from '../src';

describe('SoloPayClient', () => {
  it('should create payment', async () => {
    const client = new SoloPayClient({
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

### E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test('should process payment', async ({ page }) => {
  await page.goto('http://localhost:3000');

  await page.click('[data-testid="pay-button"]');

  await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
});
```

## Documentation Updates

### Documentation Structure

```
docs/
├── getting-started.md              # Getting started
├── guides/                         # User guides
│   ├── integrate-payment.md
│   ├── deploy-server.md
│   └── contribute.md (this document)
├── reference/                      # Reference materials
│   ├── api.md
│   ├── sdk.md
│   ├── errors.md
│   └── architecture.md
└── releases/                       # Release information
    ├── changelog.md
    └── migration-v2.md
```

### Documentation Writing Guide

- Use Markdown format
- Include code examples
- Provide clear step-by-step instructions
- Add screenshots (when necessary)

## Need Help?

- **Issue**: https://github.com/globalmsq/solopay-monorepo/issues
- **Discussions**: https://github.com/globalmsq/solopay-monorepo/discussions
- **Email**: support@msq.com

## Related Documentation

- [Getting Started](../getting-started.md) - Local environment setup
- [Integrate Payment](integrate-payment.md) - SDK usage
- [API Reference](../reference/api.md) - API documentation
