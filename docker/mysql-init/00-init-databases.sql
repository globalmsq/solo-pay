-- ============================================================
-- SoloPay MySQL Initialization - Database Setup
-- ============================================================
-- SPEC-DB-001: Gateway Database Integration
-- This script creates databases and grants permissions
-- Execution Order: 00 (First)
-- ============================================================

-- Create databases with UTF-8 support
CREATE DATABASE IF NOT EXISTS solopay CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS solopay_sample_merchant CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Grant permissions to solopay user for sample_merchant database
GRANT ALL PRIVILEGES ON solopay_sample_merchant.* TO 'solopay'@'%';

-- Grant CREATE/DROP for Prisma shadow database (used by prisma migrate dev)
GRANT CREATE, DROP ON *.* TO 'solopay'@'%';

FLUSH PRIVILEGES;
