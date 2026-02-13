# Price Service

Token price service that fetches real-time cryptocurrency prices from CoinMarketCap API with Redis caching and database-backed token whitelist.

## Overview

Provides token price lookup by chain ID and contract address. Tokens must be registered in the database with a CoinMarketCap ID (`cmc_id`) to be queryable.

**Purpose**:

- Real-time token price lookup for the Solo Pay payment system
- Redis caching with configurable TTL (default 60s, matching CMC refresh rate)
- Database-backed whitelist ensures only registered tokens are queryable

## Key Features

- **Whitelist-Based Lookup**: Only tokens registered in the `tokens` table with a valid `cmc_id` are queryable
- **Redis Caching**: Configurable TTL with graceful degradation when Redis is unavailable
- **Currency Conversion**: Support for any fiat currency via CMC `convert` parameter (default: USD)
- **Swagger Documentation**: OpenAPI docs available at `/api-docs`
- **Docker Support**: Ready to use in Docker Compose environment

## Tech Stack

| Component | Technology | Version |
| --------- | ---------- | ------- |
| Framework | Fastify    | ^5.0.0  |
| ORM       | Prisma     | ^6.0.0  |
| Cache     | ioredis    | ^5.4.0  |
| Runtime   | Node.js    | 20+     |
| Language  | TypeScript | ^5.4.0  |
| Testing   | Vitest     | ^2.0.0  |

## Getting Started

### Installation

```bash
cd packages/price-service
pnpm install
pnpm exec prisma generate
```

### Environment Variables

Create `.env` file:

```bash
# Server Configuration
PORT=3003
HOST=0.0.0.0
LOG_LEVEL=info

# CoinMarketCap API
CMC_API_KEY=your-coinmarketcap-api-key

# Cache TTL (seconds)
CACHE_TTL=60

# Database
DATABASE_URL=mysql://solopay:pass@localhost:3306/solopay

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Run Development Server

```bash
# Development mode (hot reload)
pnpm dev

# Production build and run
pnpm build
pnpm start
```

Server runs at `http://localhost:3003`.

## API Endpoints

### GET /api/v1/prices/:chainId/:address

Fetch token price by chain ID and contract address.

**Request**:

```bash
curl http://localhost:3003/api/v1/prices/137/0xdAC17F958D2ee523a2206206994597C13D831ec7
```

**Query Parameters**:

- `convert` (optional): Target fiat currency (default: `USD`). Supports `KRW`, `EUR`, `JPY`, etc.

```bash
curl http://localhost:3003/api/v1/prices/137/0xdAC17F958D2ee523a2206206994597C13D831ec7?convert=KRW
```

**Response (200)**:

```json
{
  "data": {
    "id": 825,
    "name": "Tether",
    "symbol": "USDT",
    "address": "0xdac17f958d2ee523a2206206994597c13d831ec7",
    "chain_id": 137,
    "quote": {
      "USD": {
        "price": 1.0001,
        "volume_24h": 50000000000,
        "percent_change_1h": 0.01,
        "percent_change_24h": 0.02,
        "percent_change_7d": -0.01,
        "market_cap": 95000000000,
        "last_updated": "2025-01-15T12:00:00.000Z"
      }
    }
  }
}
```

**Error Responses**:

- `400`: Invalid address format or non-numeric chainId
- `404 Not Found`: Token not registered in whitelist
- `404 Not Configured`: Token exists but `cmc_id` is not set
- `500`: CoinMarketCap API failure or unexpected error

### GET /health

Service health check.

```bash
curl http://localhost:3003/health
```

**Response**:

```json
{
  "status": "healthy",
  "service": "price-service",
  "version": "1.0.0",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "redis": true
}
```

### GET /ready

Readiness probe. Returns 503 if Redis is unavailable.

```bash
curl http://localhost:3003/ready
```

### GET /api-docs

Swagger UI with interactive API documentation.

## How It Works

1. **Receive Request**: Client sends `chainId` and `address`
2. **Check Cache**: Look up Redis for cached price data (`price:{chainId}:{address}:{convert}`)
3. **Cache Hit**: Return cached data immediately
4. **Cache Miss**: Look up token in database by `chain_id` + `address`
5. **Validate**: Ensure token exists, is enabled, and has `cmc_id` configured
6. **Fetch Price**: Call CoinMarketCap API `/v2/cryptocurrency/quotes/latest` with `cmc_id`
7. **Cache Result**: Store in Redis with configured TTL (default 60s)
8. **Return**: Send price data to client

## Docker Usage

### Docker Compose

Runs in `docker-compose.yaml`:

```yaml
services:
  price-service:
    build:
      context: ..
      dockerfile: docker/Dockerfile.packages
      target: price-service
    ports:
      - '3006:3003'
    environment:
      PORT: 3003
      DATABASE_URL: mysql://solopay:pass@mysql:3306/solopay
      REDIS_HOST: redis
      REDIS_PORT: 6379
      CMC_API_KEY: ${CMC_API_KEY}
    depends_on:
      mysql:
        condition: service_healthy
      redis:
        condition: service_started
```

### Run in Docker Environment

```bash
cd docker
docker-compose up -d price-service

# View logs
docker-compose logs -f price-service
```

## Project Structure

```
packages/price-service/
├── src/
│   ├── server.ts               # Fastify server entry point
│   ├── index.ts                # Main export
│   ├── docs/
│   │   └── swagger.config.ts   # OpenAPI configuration
│   ├── db/
│   │   └── client.ts           # Prisma singleton
│   ├── lib/
│   │   ├── logger.ts           # Pino logger factory
│   │   └── redis.ts            # Redis cache layer
│   ├── routes/
│   │   ├── price.routes.ts     # GET /api/v1/prices/:chainId/:address
│   │   └── health.routes.ts    # GET /health, GET /ready
│   └── services/
│       └── price.service.ts    # Core price lookup logic
├── prisma/
│   └── schema.prisma           # Token model (subset)
├── tests/
│   ├── price.service.test.ts   # Service unit tests
│   ├── price.routes.test.ts    # Route integration tests
│   └── health.routes.test.ts   # Health endpoint tests
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Token Registration

Tokens must be registered in the `tokens` table with a valid `cmc_id` to be queryable.

The `cmc_id` is the CoinMarketCap cryptocurrency ID. You can find it from:

- CoinMarketCap website URL (e.g., `https://coinmarketcap.com/currencies/tether/` → ID 825)
- CoinMarketCap API `/v1/cryptocurrency/map` endpoint

**Example token record**:

- `chain_id`: 137
- `address`: `0xdac17f958d2ee523a2206206994597c13d831ec7`
- `symbol`: USDT
- `cmc_id`: 825
- `is_enabled`: true

## Testing

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Type check
pnpm typecheck
```

## License

MIT License
