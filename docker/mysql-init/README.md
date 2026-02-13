# MySQL Initialization Files

This directory contains MySQL initialization scripts that are automatically executed when the MySQL container starts for the first time.

## File Structure and Execution Order

MySQL executes SQL files in alphabetical order from the `/docker-entrypoint-initdb.d` directory. Our files are numbered to ensure correct execution sequence:

### 00-init-databases.sql

**Purpose**: Database creation and permissions

**Contents**:

- Creates `solopay` and `solopay_sample_merchant` databases
- Grants permissions to the `solopay` user
- Sets up Prisma shadow database permissions for migrations

**Execution**: First (00)

### 10-solopay-schema.sql

**Purpose**: Main SoloPay database schema

**Contents**:

- Switches to `solopay` database with `USE solopay`
- Creates all core tables:
  - chains (blockchain networks)
  - tokens (ERC20 tokens per chain)
  - merchants (merchant accounts)
  - merchant_payment_methods (payment settings)
  - payments (payment records)
  - relay_requests (gasless relay tracking)
  - payment_events (audit log)
  - refunds (refund records)
  - wallet_gas_grants (one-time gas faucet)

**Schema Reference**: Aligned with `/Users/mustfintech/src/solo-pay/packages/database/prisma/schema.prisma`

**Execution**: Second (10)

### 20-sample-merchant-schema.sql

**Purpose**: Sample merchant database schema placeholder

**Contents**:

- Switches to `solopay_sample_merchant` database with `USE solopay_sample_merchant`
- Placeholder comments explaining that schema is managed by Prisma migrations
- Actual schema is defined in `/Users/mustfintech/src/solo-pay/packages/sample-merchant/prisma/schema.prisma`

**Note**: The sample-merchant schema is created and managed through Prisma migrations, not this SQL file. This file ensures the database context is set correctly.

**Execution**: Third (20)

### 90-seed-data.sql

**Purpose**: Development seed data

**Contents**:

- Switches to `solopay` database with `USE solopay`
- Inserts demo data for local development:
  - 7 blockchain networks (Localhost, Sepolia, Amoy, BNB Testnet, Polygon, Ethereum, BNB Chain)
  - 5 tokens (TEST on Localhost, SUT/MSQ on Polygon and Amoy)
  - 3 merchants (Demo Store, Metastar Global, Sample Merchant)
  - 3 payment methods linking merchants to tokens
- Verification queries to confirm data insertion

**Execution**: Last (90)

## Synchronization with Prisma Schemas

The SQL schemas in this directory must stay synchronized with the Prisma schemas:

### Main Database (solopay)

**Prisma Schema**: `/Users/mustfintech/src/solo-pay/packages/database/prisma/schema.prisma`

**SQL File**: `10-solopay-schema.sql`

**Sync Points**:

- Table names and column definitions must match exactly
- ENUM values must be identical
- Indexes and unique constraints must align
- Default values and constraints must match

### Sample Merchant Database (solopay_sample_merchant)

**Prisma Schema**: `/Users/mustfintech/src/solo-pay/packages/sample-merchant/prisma/schema.prisma`

**SQL File**: `20-sample-merchant-schema.sql` (placeholder only)

**Note**: This database is fully managed by Prisma migrations. Do not manually create tables in the SQL file.

## Testing and Verification

### Test MySQL Initialization

Rebuild the MySQL container to test the initialization scripts:

```bash
# Stop and remove existing MySQL container and volume
docker compose down mysql
docker volume rm solo-pay_mysql-data

# Start MySQL container (initialization scripts will run)
docker compose up mysql -d

# Wait for MySQL to be healthy (check health status)
docker compose ps mysql

# Check initialization logs
docker compose logs mysql | grep -E "init|CREATE|INSERT"
```

### Verify Database Structure

Connect to MySQL and verify the schema:

```bash
# Connect to MySQL container
docker compose exec mysql mysql -u solopay -ppass solopay

# Verify tables exist
SHOW TABLES;

# Verify row counts
SELECT 'chains' as table_name, COUNT(*) as row_count FROM chains
UNION ALL SELECT 'tokens', COUNT(*) FROM tokens
UNION ALL SELECT 'merchants', COUNT(*) FROM merchants
UNION ALL SELECT 'merchant_payment_methods', COUNT(*) FROM merchant_payment_methods;

# Exit MySQL
exit
```

### Test Prisma Integration

Verify Prisma can connect to the database:

```bash
# Test main database connection
cd /Users/mustfintech/src/solo-pay/packages/database
npx prisma db pull

# Test sample-merchant database connection
cd /Users/mustfintech/src/solo-pay/packages/sample-merchant
npx prisma db pull
```

## Volume Mount Configuration

The initialization directory is mounted in `docker-compose.yaml`:

```yaml
services:
  mysql:
    volumes:
      - ./mysql-init:/docker-entrypoint-initdb.d:ro
```

**Key Points**:

- The `:ro` flag means read-only mount
- Files are executed only on first container start (when data volume is empty)
- Changes to SQL files require removing the MySQL data volume to re-run initialization

## File Naming Convention

**Pattern**: `{order}-{description}.sql`

**Order Prefix**:

- 00-09: Database and permission setup
- 10-19: Schema definitions
- 20-89: Additional schemas or migrations
- 90-99: Seed data and verification

**Benefits**:

- Alphabetical execution ensures correct dependency order
- Clear numbering makes execution sequence obvious
- Gaps between numbers (00, 10, 20, 90) allow for future insertions

## Best Practices

### When to Update SQL Files

Update the SQL initialization files when:

- Prisma schema changes require database structure updates
- New tables or columns are added to the core schema
- Development seed data needs to be modified
- New blockchain networks or tokens need to be added

### Workflow for Schema Changes

When updating the Prisma schema:

1. Update the Prisma schema file (`packages/database/prisma/schema.prisma`)
2. Generate and test migrations with `npx prisma migrate dev`
3. Update the corresponding SQL file (`10-solopay-schema.sql`)
4. Verify the SQL matches the Prisma schema exactly
5. Test the initialization by recreating the MySQL container

### Avoiding Common Issues

**Issue**: SQL syntax errors during initialization

**Solution**: Test SQL files manually before committing:

```bash
docker compose exec mysql mysql -u solopay -ppass < docker/mysql-init/10-solopay-schema.sql
```

**Issue**: Prisma schema and SQL out of sync

**Solution**: Always update both files together and verify with `npx prisma db pull`

**Issue**: Initialization scripts not running

**Solution**: Remove the MySQL data volume to force re-initialization:

```bash
docker compose down mysql
docker volume rm solo-pay_mysql-data
docker compose up mysql -d
```

## Backup and Original File

The original monolithic initialization script is preserved at:

**Location**: `/Users/mustfintech/src/solo-pay/docker/init.sql`

**Purpose**: Backup reference for the complete original schema

**Note**: This file is no longer used by Docker Compose but is kept for reference and rollback if needed.

## Migration Path

### From Old Structure (Single File)

```yaml
volumes:
  - ./init.sql:/docker-entrypoint-initdb.d/init.sql:ro
```

### To New Structure (Directory)

```yaml
volumes:
  - ./mysql-init:/docker-entrypoint-initdb.d:ro
```

**Benefits of New Structure**:

- Better organization aligned with Prisma package separation
- Easier to maintain and update individual components
- Clearer separation of concerns (setup, schema, seed data)
- More flexible for future additions (new databases, migrations)

## Related Documentation

- Prisma Database Schema: `/Users/mustfintech/src/solo-pay/packages/database/prisma/schema.prisma`
- Sample Merchant Schema: `/Users/mustfintech/src/solo-pay/packages/sample-merchant/prisma/schema.prisma`
- Docker Compose: `/Users/mustfintech/src/solo-pay/docker/docker-compose.yaml`
- Original Init Script: `/Users/mustfintech/src/solo-pay/docker/init.sql`
