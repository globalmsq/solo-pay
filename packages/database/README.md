# @solo-pay/database

Shared Prisma database client for SoloPay monorepo services.

## Overview

This package provides a centralized Prisma schema and database client used by all SoloPay services that share the same database (gateway, faucet-manager, price-service).

## Features

- Single source of truth for database schema
- Shared Prisma client across multiple services
- Centralized database connection management
- TypeScript types for all database models

## Usage

### Installation

This package is workspace-internal. Add it to your service's `package.json`:

```json
{
  "dependencies": {
    "@solo-pay/database": "workspace:*"
  }
}
```

### Importing Types and Client

```typescript
// Import models and types
import { Token, Chain, Payment, PaymentStatus } from '@solo-pay/database';

// Import Decimal for handling large numbers
import { Decimal } from '@solo-pay/database';

// Import database utilities
import { getPrismaClient, disconnectPrisma } from '@solo-pay/database';

// Use the client
const prisma = getPrismaClient();
const tokens = await prisma.token.findMany();
```

### Database Connection

The database client uses the following environment variables (in order of priority):

1. `DATABASE_URL` - Full MySQL connection string
2. Individual variables (fallback):
   - `MYSQL_HOST` (default: localhost)
   - `MYSQL_PORT` (default: 3306)
   - `MYSQL_USER` (default: solopay)
   - `MYSQL_PASSWORD` (default: empty)
   - `MYSQL_DATABASE` (default: solopay)

## Development

### Generate Prisma Client

```bash
pnpm run prisma:generate
```

### Build Package

```bash
pnpm run build
```

### Database Migrations

Note: Run migrations from the root of the monorepo or from this package directory.

```bash
# Create a new migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy
```

## Schema

The schema includes the following models:

- `Chain` - Blockchain network configurations
- `Token` - Token information per chain
- `Merchant` - Merchant accounts
- `MerchantPaymentMethod` - Payment methods per merchant
- `Payment` - Payment records
- `RelayRequest` - Gasless transaction relay requests
- `PaymentEvent` - Payment event logs
- `Refund` - Refund records
- `WalletGasGrant` - Gas faucet grants

## License

MIT
