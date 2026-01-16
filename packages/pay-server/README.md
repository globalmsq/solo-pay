# MSQ Pay Server

[English](README.md) | [한국어](README.ko.md)

MSQ Pay Server is the backend API server for the blockchain-based payment system. It processes multi-chain ERC-20 token payments using Fastify framework and viem.

## Key Features

- **Multi-chain Support**: Handle multiple blockchain networks with a single server
- **Multi-token Support**: Support various ERC-20 tokens per chain
- **Payment Methods**: Direct Payment and Gasless Payment (Meta-Transaction)
- **ERC2771 Forwarder**: EIP-712 signature-based Meta-Transaction
- **Stateless Architecture**: Use smart contracts as Single Source of Truth
- **Redis Caching**: Performance optimization through blockchain query result caching
- **Prisma ORM**: MySQL database management

## Tech Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Fastify | ^5.0.0 |
| Blockchain | viem | ^2.21.0 |
| Database | MySQL + Prisma | ^6.0.0 |
| Cache | Redis + ioredis | ^5.4.0 |
| Validation | Zod | ^3.23.0 |
| Runtime | Node.js | 18+ |
| Language | TypeScript | ^5.4.0 |
| Testing | Vitest | ^2.0.0 |

## Getting Started

### Requirements

- Node.js >= 18.0.0
- MySQL >= 8.0
- Redis >= 7.0 (optional, for caching)

### Installation

```bash
cd packages/pay-server
pnpm install
```

### Environment Variables

Copy `.env.example` to create `.env` file:

```bash
cp .env.example .env
```

Required environment variables:

```bash
# Server Configuration
PORT=3001
HOST=0.0.0.0

# Database (MySQL)
DATABASE_URL=mysql://msqpay:pass@localhost:3306/msqpay
# Or individual settings:
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=msqpay
MYSQL_PASSWORD=pass
MYSQL_DATABASE=msqpay

# Redis (Optional - for caching)
REDIS_URL=redis://localhost:6379
# Or individual settings:
REDIS_HOST=localhost
REDIS_PORT=6379

# Relayer Service
RELAYER_API_URL=http://simple-relayer:3001  # Local development
# RELAYER_API_URL=https://api.defender.openzeppelin.com  # Production
RELAYER_API_KEY=  # Production only
RELAYER_API_SECRET=  # Production only
```

> **Note**: Chain configuration (RPC URLs, Contract addresses, etc.) is managed in the database `chains` table, not environment variables.

### Database Setup

```bash
# Run Prisma migration
pnpm prisma migrate dev

# Generate Prisma Client
pnpm prisma generate
```

### Run Development Server

```bash
# Development mode (hot reload)
pnpm dev

# Production build
pnpm build

# Production run
pnpm start
```

Server runs at `http://localhost:3001`.

### Health Check

```bash
curl http://localhost:3001/health
```

Response example:
```json
{
  "status": "ok",
  "timestamp": "2025-01-05T10:30:00.000Z",
  "uptime": 123.456
}
```

## API Endpoints

### Payment API

- `POST /payments/create` - Create payment
- `GET /payments/:paymentId/status` - Check payment status
- `POST /payments/:paymentId/gasless` - Submit gasless payment
- `POST /payments/:paymentId/relay` - Execute relay transaction
- `GET /payments/history` - Query payment history

### Chain Configuration API

- `GET /config/chains` - List supported chains
- `GET /config/chains/:chainId` - Get specific chain configuration

### Token API

- `GET /tokens/balance` - Query token balance
- `GET /tokens/allowance` - Query token allowance

For detailed API documentation, refer to [docs/reference/api.md](../../docs/reference/api.md).

## Project Structure

```
packages/pay-server/
├── src/
│   ├── index.ts                 # Server entry point
│   ├── app.ts                   # Fastify app setup
│   ├── config/
│   │   ├── chains.json          # Chain configuration
│   │   └── environment.ts       # Environment settings
│   ├── routes/
│   │   ├── payments.ts          # Payment endpoints
│   │   ├── config.ts            # Config endpoints
│   │   └── tokens.ts            # Token endpoints
│   ├── services/
│   │   ├── blockchain.service.ts    # Blockchain interaction
│   │   ├── relay.service.ts         # Relay service
│   │   └── payment.service.ts       # Payment logic
│   ├── schemas/
│   │   └── payment.schema.ts    # Zod validation schemas
│   └── types/
│       └── index.ts             # Type definitions
├── prisma/
│   ├── schema.prisma            # Prisma schema
│   └── migrations/              # Database migrations
├── tests/
│   ├── routes/                  # Route tests
│   ├── services/                # Service tests
│   └── setup.ts                 # Test setup
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

## Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Type check
pnpm typecheck

# Lint
pnpm lint
```

## Docker

### Docker Compose

The server is included in the Docker Compose setup at the project root:

```bash
# Start all services
cd docker && docker-compose up -d

# View logs
docker-compose logs -f server

# Restart server
docker-compose restart server
```

### Standalone Docker

```bash
# Build image
docker build -t msq-pay-server .

# Run container
docker run -p 3001:3001 \
  -e DATABASE_URL=mysql://... \
  -e REDIS_URL=redis://... \
  msq-pay-server
```

## Architecture

### Stateless Design

The server follows stateless architecture principles:

- **Contract as Source of Truth**: Payment completion is determined solely by smart contracts
- **Database for Caching**: DB stores indexed data for query performance
- **Redis for Performance**: Cache blockchain query results
- **No Session State**: Each request is independent

### Payment Flow

#### Direct Payment

```
1. User initiates payment
2. Frontend creates transaction
3. User approves in wallet (pays gas)
4. Transaction sent to blockchain
5. Server queries contract for status
```

#### Gasless Payment

```
1. User initiates payment
2. Frontend creates meta-transaction
3. User signs (no gas payment)
4. Server submits to relayer
5. Relayer executes transaction
6. Server monitors transaction status
```

## Multi-chain Configuration

MSQ Pay Server supports a **fully dynamic multi-chain architecture**. Chain configuration is managed in the database.

### Dynamic Chain Management

- Chain information stored in MySQL `chains` table
- Auto-loaded from database on server startup
- Add new chains without code changes
- Support for all EVM-compatible chains (Ethereum, Polygon, BSC, Arbitrum, Optimism, etc.)

### Adding New Chains

Simply INSERT into the database:

```sql
INSERT INTO chains (network_id, name, rpc_url, gateway_address, forwarder_address, is_testnet)
VALUES (
  42161,
  'Arbitrum One',
  'https://arb1.arbitrum.io/rpc',
  '0x...', -- PaymentGateway contract address
  '0x...', -- ERC2771Forwarder contract address
  FALSE
);
```

### Chain Activation Requirements

- `gateway_address`: PaymentGateway contract must be deployed
- `forwarder_address`: ERC2771Forwarder contract must be deployed
- `is_enabled = TRUE`: Chain is active
- `is_deleted = FALSE`: Chain is not deleted

### Initial Chain Data

In Docker environment, `docker/init.sql` automatically initializes:

- Localhost (Hardhat) - Development
- Polygon Amoy - Testnet
- Sepolia, BSC Testnet - Pending
- Polygon, Ethereum, BSC - Production (after contract deployment)

## Monitoring

### Logging

Structured logging with Pino:

```typescript
logger.info({ paymentId, status }, 'Payment status updated');
logger.error({ error, paymentId }, 'Payment processing failed');
```

### Metrics

Key metrics to monitor:

- Request latency
- Payment success rate
- Blockchain query cache hit rate
- Database connection pool usage
- Redis connection status

## Security

### Best Practices

- ✅ Private keys stored in environment variables only
- ✅ Input validation with Zod schemas
- ✅ Rate limiting on API endpoints
- ✅ CORS configuration
- ✅ Request timeout settings
- ✅ Error handling without sensitive data exposure

### Production Checklist

- [ ] Use environment-specific RPC URLs
- [ ] Configure proper CORS origins
- [ ] Set up monitoring and alerting
- [ ] Enable rate limiting
- [ ] Use production database with backups
- [ ] Rotate relayer private keys regularly
- [ ] Use managed Relayer service (e.g., OpenZeppelin Defender)

## Troubleshooting

### Common Issues

**Database connection failed**
```bash
# Check MySQL is running
docker-compose ps mysql

# Verify DATABASE_URL format
DATABASE_URL=mysql://user:password@host:3306/database
```

**Redis connection failed**
```bash
# Redis is optional, but if used:
docker-compose ps redis

# Verify REDIS_URL
REDIS_URL=redis://localhost:6379
```

**RPC errors**
```bash
# Verify RPC URL is accessible
curl https://rpc-amoy.polygon.technology

# Check rate limits on RPC provider
```

## Performance

### Optimization Tips

1. **Enable Redis caching** - Reduces blockchain queries by 70-80%
2. **Database indexing** - Add indexes on frequently queried fields
3. **Connection pooling** - Configure Prisma connection limits
4. **Rate limiting** - Protect against abuse

### Benchmarks

- Average response time: < 100ms (with cache)
- Blockchain query: 200-500ms (without cache)
- Database query: < 50ms
- Throughput: 100+ requests/second

## Documentation

- [API Reference](../../docs/reference/api.md) - Complete API documentation
- [Architecture Guide](../../docs/reference/architecture.md) - System architecture
- [Deployment Guide](../../docs/guides/deploy-server.md) - Production deployment

## License

MIT License
