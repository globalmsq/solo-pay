-- Migration: Unique constraint (order_id, merchant_id) on payments
-- Date: 2026-02-12 10:00:00
-- Ensures one payment per (order_id, merchant_id) when order_id is set.
-- Multiple rows with order_id = NULL are allowed (MySQL unique allows multiple NULLs).
-- Aligns with Prisma schema @@unique([order_id, merchant_id]).

USE solopay;

-- Replace non-unique index with unique constraint (index name from 20260204_120000_merchant_payment_wallet_gas_migration.sql)
DROP INDEX idx_payments_order_id_merchant_id ON payments;

CREATE UNIQUE INDEX idx_payments_order_id_merchant_id ON payments (order_id, merchant_id);
