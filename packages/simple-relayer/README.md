# Simple Relayer

[English](README.md) | [한국어](README.ko.md)

Simple Relayer is a lightweight HTTP service that replaces production Relayer API in local development environments. It processes Meta-Transactions (Gasless Payment) using ERC2771Forwarder.

## Overview

Provides the same API interface for testing Gasless payments without external Relayer services during local development.

**Purpose**:

- Docker Compose local development environment
- Gasless payment testing on Hardhat network
- HTTP service compatible with production Relayer API

**Not for Production**: This service is for development only. Use professional Relayer services (e.g., OpenZeppelin Defender) in production.

## Key Features

- ✅ **Relayer API Compatible**: Same interface as production Relayer with `/txs` endpoint
- ✅ **ERC2771 Forwarder Support**: Meta-Transaction execution
- ✅ **Signature Verification**: EIP-712 signature verification
- ✅ **Lightweight Implementation**: Uses only Fastify + viem
- ✅ **Docker Support**: Ready to use in Docker Compose environment

## Tech Stack

| Component  | Technology | Version |
| ---------- | ---------- | ------- |
| Framework  | Fastify    | ^5.0.0  |
| Blockchain | viem       | ^2.21.0 |
| Runtime    | Node.js    | 18+     |
| Language   | TypeScript | ^5.4.0  |
| Testing    | Vitest     | ^2.0.0  |

## Getting Started

### Installation

```bash
cd packages/simple-relayer
pnpm install
```

### Environment Variables

Create `.env` file:

```bash
# Server Configuration
PORT=3001
LOG_LEVEL=info

# Blockchain
RPC_URL=http://hardhat:8545  # Docker environment
# RPC_URL=http://localhost:8545  # Local environment

# Relayer Wallet
RELAYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Forwarder Contract
FORWARDER_ADDRESS=0x5FbDB2315678afecb367f032d93F642f64180aa3
```

### Run Development Server

```bash
# Development mode (hot reload)
pnpm dev

# Production build and run
pnpm build
pnpm start
```

Server runs at `http://localhost:3001`.

## API Endpoints

### POST /txs

Execute Meta-Transaction. Compatible with production Relayer API.

**Request**:

```bash
curl -X POST http://localhost:3001/txs \
  -H "Content-Type: application/json" \
  -d '{
    "to": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "data": "0x...",
    "speed": "fast",
    "gasLimit": 100000
  }'
```

**Request Parameters**:

- `to` (required): Forwarder contract address
- `data` (required): ERC2771Forwarder.execute() call data (encoded ForwardRequest)
- `speed` (optional): Gas price setting (`safeLow`, `average`, `fast`, `fastest`) - currently ignored
- `gasLimit` (optional): Gas limit - currently ignored

**Response**:

```json
{
  "transactionId": "1a2b3c4d-5e6f-7g8h-9i0j-k1l2m3n4o5p6",
  "hash": "0x123abc...",
  "status": "mined",
  "chainId": 31337
}
```

**Response Fields**:

- `transactionId`: Unique transaction ID (UUID)
- `hash`: Blockchain transaction hash
- `status`: Transaction status (`pending`, `mined`, `failed`)
- `chainId`: Chain ID

### GET /health

Server health check

**Request**:

```bash
curl http://localhost:3001/health
```

**Response**:

```json
{
  "status": "ok",
  "timestamp": "2025-01-05T10:30:00.000Z"
}
```

## Docker Usage

### Docker Compose

Automatically runs in `docker-compose.yml`:

```yaml
services:
  simple-relayer:
    build:
      context: ..
      dockerfile: docker/Dockerfile.packages
      target: simple-relayer
    ports:
      - '3001:3001'
    environment:
      PORT: 3001
      RPC_URL: http://hardhat:8545
      RELAYER_PRIVATE_KEY: ${RELAYER_PRIVATE_KEY}
      FORWARDER_ADDRESS: ${FORWARDER_ADDRESS}
    depends_on:
      - hardhat
```

### Run in Docker Environment

```bash
cd docker
docker-compose up -d simple-relayer

# View logs
docker-compose logs -f simple-relayer
```

## Integration with Pay-Server

Pay-Server selects Relayer service via environment variables:

```bash
# Local development (Simple Relayer)
RELAY_API_URL=http://simple-relayer:3001

# Production (External Relayer service)
RELAY_API_URL=https://api.defender.openzeppelin.com
```

Pay-Server's `RelayService` calls the same API, enabling environment switching without code changes.

## Project Structure

```
packages/simple-relayer/
├── src/
│   ├── server.ts               # Fastify server entry point
│   ├── index.ts                # Main export
│   ├── routes/
│   │   ├── relay.routes.ts     # POST /txs route
│   │   └── health.routes.ts    # GET /health route
│   └── services/
│       └── relay.service.ts    # Relay execution logic
├── tests/
│   └── relay.test.ts           # Tests
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## How It Works

1. **Receive Request**: Pay-Server sends Meta-Transaction request to `/txs` endpoint
2. **Decode Data**: Extract ForwardRequest from `data` field
3. **Verify Signature**: Check signature validity in ERC2771Forwarder
4. **Execute Transaction**: Call `forwarder.execute()` with Relayer wallet
5. **Return Result**: Return transaction hash and status

## Testing

```bash
# Run all tests
pnpm test

# Coverage report
pnpm test:coverage

# Type check
pnpm typecheck
```

## Production Relayer vs Simple Relayer

| Feature              | Production Relayer                  | Simple Relayer          |
| -------------------- | ----------------------------------- | ----------------------- |
| **Environment**      | Production                          | Development             |
| **Authentication**   | API Key + Secret                    | None                    |
| **Gas Management**   | Auto-refill, gas price optimization | Fixed (Hardhat default) |
| **Monitoring**       | Dashboard, alerts                   | Logs only               |
| **Nonce Management** | Automatic                           | viem auto-handling      |
| **Retry Logic**      | Yes                                 | No                      |
| **Cost**             | Paid                                | Free                    |
| **Setup**            | Complex                             | Simple                  |

## Security Considerations

⚠️ **Do Not Use in Production**: This service is for development only.

**Reasons to use only in development**:

- No authentication (anyone can execute transactions)
- No gas management (Relayer balance can be depleted)
- Minimal error handling
- No monitoring
- Potential nonce conflicts

**Relayer Private Key Management**:

- Use test accounts only
- Never use accounts with real assets
- Do not commit `.env` file to Git

## Production Deployment

In production, always use professional **Relayer services** (e.g., OpenZeppelin Defender):

1. Create [OpenZeppelin Defender](https://defender.openzeppelin.com/) account
2. Create Relayer and issue API Key
3. Configure Pay-Server environment variables:
   ```bash
   RELAY_API_URL=https://api.defender.openzeppelin.com
   RELAY_API_KEY=your-api-key
   RELAYER_API_SECRET=your-api-secret
   ```

## Documentation

- [Architecture Documentation](../../docs/reference/architecture.md)
- [Deployment Guide](../../docs/guides/deploy-server.md)
- [OpenZeppelin Defender Documentation](https://docs.openzeppelin.com/defender/)

## License

MIT License
