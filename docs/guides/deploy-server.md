[English](deploy-server.md) | [한국어](deploy-server.ko.md)

# Payment API Deployment Guide

A step-by-step guide to deploying the MSQPay Payment API to various environments. Includes hybrid Relay architecture for each environment, ERC2771Forwarder-based Meta-Transaction, Polygon RPC, and environment configuration.

## Environment Architecture Overview (v4.0.0)

MSQPay uses the same HTTP API-based architecture across all environments. Environment switching is controlled solely through the `RELAY_API_URL` environment variable:

| Environment                | Relay Service               | API URL                               | Forwarder        |
| -------------------------- | --------------------------- | ------------------------------------- | ---------------- |
| **Local (Docker Compose)** | Simple Relayer HTTP Service | http://simple-relayer:3001            | ERC2771Forwarder |
| **Testnet (Polygon Amoy)** | OZ Defender API             | https://api.defender.openzeppelin.com | ERC2771Forwarder |
| **Mainnet (Polygon)**      | OZ Defender API             | https://api.defender.openzeppelin.com | ERC2771Forwarder |

**Environment Switching**: Controlled via `RELAY_API_URL` environment variable

- `http://simple-relayer:3001` → Local development environment (Simple Relayer Docker container)
- `https://api.defender.openzeppelin.com` → Production environment (OZ Defender API)

## Pre-Deployment Checklist

- [ ] Polygon network smart contracts deployed
- [ ] ERC2771Forwarder contract deployed
- [ ] PaymentGateway contract deployed (with Forwarder set as trustedForwarder)
- [ ] Relayer wallet created and funded with gas
- [ ] RPC provider selected and endpoint secured
- [ ] Environment variables prepared (.env.production)
- [ ] Test coverage >= 85%
- [ ] TypeScript compilation successful
- [ ] Security audit completed

---

## Step 1: Environment Configuration

### 1.1 Environment Variables by Environment

#### Local Environment (Docker Compose)

```bash
# ============================================
# Relay Configuration (Simple Relayer HTTP Service)
# ============================================
RELAY_API_URL=http://simple-relayer:3001
# Simple Relayer HTTP service URL (Docker container)

# ============================================
# Blockchain Configuration
# ============================================
FORWARDER_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
# ERC2771Forwarder contract address (Hardhat deployment)

GATEWAY_ADDRESS=0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9
BLOCKCHAIN_RPC_URL=http://hardhat:8545
CHAIN_ID=31337

# ============================================
# Server Configuration
# ============================================
PORT=3000
NODE_ENV=development
```

**Simple Relayer Service Environment Variables** (simple-relayer container):

```bash
RELAYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
# Hardhat default account #0 private key

RPC_URL=http://hardhat:8545
CHAIN_ID=31337
FORWARDER_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
```

#### Testnet/Mainnet Environment (OZ Defender API)

```bash
# ============================================
# Relay Configuration (OZ Defender API)
# ============================================
RELAY_API_URL=https://api.defender.openzeppelin.com
# OZ Defender API URL

RELAY_API_KEY=your_defender_api_key_here
# OZ Defender API key

# ============================================
# Blockchain Configuration (Required)
# ============================================
GATEWAY_ADDRESS=0x1234567890123456789012345678901234567890
# PaymentGateway contract address (required)

FORWARDER_ADDRESS=0x...
# ERC2771Forwarder contract address (Testnet/Mainnet deployment)

BLOCKCHAIN_RPC_URL=https://polygon-rpc.com
# Or dedicated RPC:
# BLOCKCHAIN_RPC_URL=https://mainnet.infura.io/v3/YOUR-PROJECT-ID
# BLOCKCHAIN_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR-API-KEY

CHAIN_ID=80002
# Polygon Amoy Testnet: 80002
# Polygon Mainnet: 137

# ============================================
# Server Configuration
# ============================================
PORT=3000
NODE_ENV=production

# ============================================
# Logging Configuration (Optional)
# ============================================
LOG_LEVEL=info
# Choose from debug, info, warn, error

# ============================================
# CORS Configuration (Optional)
# ============================================
CORS_ORIGIN=https://app.msqpay.io
# Client domain
```

### 1.2 Multi-Chain Configuration (chains.json)

Pay Server supports multi-chain through the `chains.json` configuration file. Different configuration files can be used for different environments.

#### Configuration File Types

| File                     | Environment | Description               |
| ------------------------ | ----------- | ------------------------- |
| `chains.json`            | Local       | Hardhat local development |
| `chains.testnet.json`    | Testnet     | Polygon Amoy testnet      |
| `chains.production.json` | Production  | Polygon Mainnet           |

#### Configuration File Structure

```json
{
  "31337": {
    "name": "Hardhat",
    "rpcUrl": "http://hardhat:8545",
    "gateway": "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
    "forwarder": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "tokens": {
      "TEST": {
        "address": "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
        "decimals": 18
      }
    }
  }
}
```

#### Specify Configuration File via Environment Variable

```bash
# Local development (default)
CHAINS_CONFIG_PATH=chains.json

# Testnet
CHAINS_CONFIG_PATH=chains.testnet.json

# Production
CHAINS_CONFIG_PATH=chains.production.json
```

### 1.3 Create .env.production File

```bash
# Linux/macOS
touch .env.production
chmod 600 .env.production
# Add environment variables from above to this file
```

### 1.3 Security Considerations

```bash
# ❌ Never commit this
git add .env.production  # Prohibited!

# ✅ Add to .gitignore
echo ".env.production" >> .gitignore
echo ".env.*.local" >> .gitignore
git add .gitignore
git commit -m "chore: add .env files to gitignore"
```

---

## Step 2: Forwarder and Relayer Setup

### 2.1 Deploy ERC2771Forwarder Contract

ERC2771Forwarder is the core contract for processing Meta-Transactions.

**Deploy with Hardhat Ignition**:

```bash
cd contracts
npx hardhat ignition deploy ignition/modules/Forwarder.ts --network amoy
```

**Post-Deployment Verification**:

1. Record deployed Forwarder address
2. Verify contract on Polygonscan
3. Set `FORWARDER_ADDRESS` environment variable

### 2.2 Deploy PaymentGateway Contract

PaymentGateway must set Forwarder as trustedForwarder.

**Specify Forwarder address in deployment script**:

```typescript
// ignition/modules/PaymentGateway.ts
const forwarderAddress = '0x...'; // Address from 2.1
await gateway.initialize(owner, forwarderAddress);
```

### 2.3 Relayer Wallet Setup

Relayer is the server wallet that submits Meta-Transactions.

**Create Relayer Wallet**:

1. Generate new Ethereum wallet (secure private key storage)
2. Set private key as environment variable (`RELAYER_PRIVATE_KEY`)

### 2.4 Fund Relayer

1. Send POL to relayer wallet (for gas costs)
2. Recommended minimum balance: 0.5 POL (testnet), 5 POL (mainnet)
3. Set up balance monitoring (optional)

---

## Step 3: RPC Provider Selection

### 3.1 Public RPC Comparison

| Provider        | URL                                                    | Speed     | Reliability | Cost |
| --------------- | ------------------------------------------------------ | --------- | ----------- | ---- |
| **Polygon RPC** | `https://polygon-rpc.com`                              | Medium    | High        | Free |
| **Infura**      | `https://mainnet.infura.io/v3/{PROJECT_ID}`            | Fast      | High        | Paid |
| **Alchemy**     | `https://polygon-mainnet.g.alchemy.com/v2/{API_KEY}`   | Very Fast | Very High   | Paid |
| **QuickNode**   | `https://polished-responsive-diagram.quiknode.pro/...` | Fast      | High        | Paid |
| **Ankr**        | `https://rpc.ankr.com/polygon`                         | Medium    | Medium      | Free |

### 3.2 RPC Selection Criteria

```bash
# Development/Testing: Use public RPC (free)
BLOCKCHAIN_RPC_URL=https://polygon-rpc.com

# Production (Low Volume): Public RPC or Infura
BLOCKCHAIN_RPC_URL=https://mainnet.infura.io/v3/YOUR-PROJECT-ID

# Production (High Volume): Alchemy or QuickNode (recommended)
BLOCKCHAIN_RPC_URL=https://polygon-mainnet.g.alchemy.com/v2/YOUR-API-KEY
```

### 3.3 RPC Health Check

```bash
# Test RPC connection
curl -X POST https://polygon-rpc.com \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "web3_clientVersion",
    "params": [],
    "id": 1
  }'

# Success response example:
# {"jsonrpc":"2.0","result":"Geth/v1.11.0-stable","id":1}
```

---

## Step 4: Build and Test

### 4.1 Build and Test

```bash
# 1. Install dependencies
pnpm install --frozen-lockfile

# 2. Check TypeScript compilation
pnpm exec tsc --noEmit

# 3. Run linter
pnpm lint

# 4. Run tests
pnpm test

# 5. Check test coverage (minimum 85%)
pnpm test:coverage
# Results:
# Lines       : 82.89% ( 65/78 )
# Functions   : 85% ( 34/40 )
# Branches    : 75% ( 18/24 )
# Statements  : 82.89% ( 65/78 )
```

### 4.2 Production Build

```bash
# Create production build
pnpm build

# Check build output
ls -la dist/

# Or run directly
NODE_ENV=production pnpm start
```

### 4.3 Pre-Deployment Validation

```bash
# Validate environment variables
cat > check-env.js << 'EOF'
const required = [
  'BLOCKCHAIN_RPC_URL',
  'GATEWAY_ADDRESS',
  'FORWARDER_ADDRESS',
  'RELAYER_PRIVATE_KEY',
  'PORT',
  'NODE_ENV'
];

const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('Missing environment variables:', missing);
  process.exit(1);
}

console.log('All required environment variables are set');
EOF

node check-env.js
rm check-env.js
```

---

## Step 5: Docker Deployment (Optional)

### 5.1 Create Dockerfile

```dockerfile
# /Dockerfile
FROM node:20-alpine

WORKDIR /app

# Install dependencies
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build
RUN pnpm build

# Expose port
EXPOSE 3000

# Environment variables
ENV NODE_ENV=production

# Run
CMD ["pnpm", "start"]
```

### 5.2 Build Docker Image

```bash
# Build image
docker build -t msqpay-api:latest .

# Test image (local)
docker run -p 3000:3000 \
  -e BLOCKCHAIN_RPC_URL=https://polygon-rpc.com \
  -e GATEWAY_ADDRESS=0x... \
  -e FORWARDER_ADDRESS=0x... \
  -e RELAYER_PRIVATE_KEY=xxx \
  msqpay-api:latest

# Test connection
curl http://localhost:3000/health
```

### 5.3 Docker Compose (Multi-Service)

```yaml
# docker-compose.yml
version: '3.8'

services:
  api:
    build: .
    ports:
      - '3000:3000'
    environment:
      BLOCKCHAIN_RPC_URL: https://polygon-rpc.com
      GATEWAY_ADDRESS: 0x...
      FORWARDER_ADDRESS: 0x...
      RELAYER_PRIVATE_KEY: ${RELAYER_PRIVATE_KEY}
      NODE_ENV: production
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/health']
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## Step 6: Cloud Deployment

### 6.1 Railway Deployment

```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login
railway login

# 3. Create project
railway init

# 4. Set environment variables
railway variable set BLOCKCHAIN_RPC_URL https://polygon-rpc.com
railway variable set GATEWAY_ADDRESS 0x...
railway variable set FORWARDER_ADDRESS 0x...
railway variable set RELAYER_PRIVATE_KEY xxx

# 5. Deploy
railway up
```

### 6.2 Vercel Deployment (Functions API)

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Login
vercel login

# 3. Deploy
vercel

# 4. Set environment variables
# In Vercel Dashboard > Settings > Environment Variables:
# - BLOCKCHAIN_RPC_URL
# - GATEWAY_ADDRESS
# - FORWARDER_ADDRESS
# - RELAYER_PRIVATE_KEY
```

### 6.3 AWS Lambda Deployment

```bash
# 1. Install Serverless Framework
npm install -g serverless

# 2. Configure AWS credentials
aws configure

# 3. Create serverless.yml
cat > serverless.yml << 'EOF'
service: msqpay-api

provider:
  name: aws
  runtime: nodejs20.x
  region: us-east-1
  environment:
    BLOCKCHAIN_RPC_URL: ${env:BLOCKCHAIN_RPC_URL}
    GATEWAY_ADDRESS: ${env:GATEWAY_ADDRESS}
    FORWARDER_ADDRESS: ${env:FORWARDER_ADDRESS}
    RELAYER_PRIVATE_KEY: ${env:RELAYER_PRIVATE_KEY}

functions:
  api:
    handler: dist/index.handler
    events:
      - http:
          path: /{proxy+}
          method: ANY

package:
  exclude:
    - node_modules/**
    - .env*
EOF

# 4. Deploy
serverless deploy
```

---

## Step 7: Monitoring and Logging

### 7.1 Log Collection

```typescript
// src/logger.ts
import pino from 'pino';

const isDev = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: isDev ? { target: 'pino-pretty' } : undefined,
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// Usage
logger.info('Payment created', { paymentId: 'payment_123' });
logger.error('RPC error', { error: 'Connection refused' });
```

### 7.2 Error Tracking (Sentry)

````bash
# Install Sentry client
npm install @sentry/node

# Initialize
```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

// Capture errors
try {
  // ... code
} catch (error) {
  Sentry.captureException(error);
}
````

### 7.3 Metrics Collection (Prometheus)

```typescript
import client from 'prom-client';

// Define metrics
const paymentCounter = new client.Counter({
  name: 'payments_created_total',
  help: 'Total payments created',
  labelNames: ['currency'],
});

// Use metrics
paymentCounter.inc({ currency: 'USD' });

// Provide Prometheus endpoint
app.get('/metrics', (request, reply) => {
  reply.type('text/plain');
  return client.register.metrics();
});
```

---

## Step 8: Security Hardening

### 8.1 HTTPS Configuration

```typescript
import fs from 'fs';
import https from 'https';

const options = {
  key: fs.readFileSync('/path/to/key.pem'),
  cert: fs.readFileSync('/path/to/cert.pem'),
};

if (process.env.NODE_ENV === 'production') {
  https.createServer(options, app).listen(3000);
} else {
  app.listen({ port: 3000 });
}
```

### 8.2 Request Validation

```typescript
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';

app.register(helmet);
app.register(cors, {
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
});
```

### 8.3 Rate Limiting

```typescript
import rateLimit from '@fastify/rate-limit';

app.register(rateLimit, {
  max: 100,
  timeWindow: '15 minutes',
});
```

---

## Step 9: Post-Deployment Verification

### 9.1 Health Check

```bash
# Health check endpoint
curl https://api.msqpay.io/health

# Expected response:
# {"status":"ok","timestamp":"2024-11-29T10:00:00.000Z"}
```

### 9.2 API Testing

```bash
# Test payment creation
curl -X POST https://api.msqpay.io/payments/create \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user",
    "amount": 1000000,
    "currency": "USD",
    "tokenAddress": "0x...",
    "recipientAddress": "0x..."
  }'
```

### 9.3 Monitoring Dashboard Setup

- Sentry: Error tracking
- Prometheus + Grafana: Metrics visualization
- DataDog/New Relic: APM (Application Performance Monitoring)

---

## Production Checklist (Final)

- [ ] All environment variables configured
- [ ] ERC2771Forwarder contract deployed and verified
- [ ] PaymentGateway contract deployed and verified
- [ ] Relayer wallet funded with gas
- [ ] RPC endpoint tested
- [ ] HTTPS configured
- [ ] Logging/monitoring configured
- [ ] Backup/recovery plan established
- [ ] Error handling verified
- [ ] Security audit completed
- [ ] Performance testing completed
- [ ] Post-deployment health checks passed

---

## Troubleshooting

### RPC Connection Error

```
Error: Connection refused at BLOCKCHAIN_RPC_URL
```

Solutions:

1. Verify RPC URL (`BLOCKCHAIN_RPC_URL` environment variable)
2. Check network connection
3. Verify firewall settings
4. Try different RPC provider

### Forwarder Signature Verification Failed

```
Error: Invalid signature - EIP-712 verification failed
```

Solutions:

1. Verify EIP-712 domain matches Forwarder contract
2. Check chainId is correct
3. Verify verifyingContract address is correct
4. Ensure ForwardRequest structure is accurate
5. Check deadline has not expired

### Insufficient Gas

```
Error: Insufficient balance for gas
```

Solutions:

1. Send POL to relayer wallet
2. Verify sufficient balance (minimum 0.5 POL testnet, 5 POL mainnet)
3. Re-evaluate transaction volume
4. Set up automatic balance alerts

---

## Related Documentation

- [API Reference](../api/payments.md)
- [Architecture Guide](../architecture-payments.md)
- [Implementation Guide](../implementation/payments-api.md)
