-- Migration: Merchant public key, Payment client fields
-- Date: 2026-02-04 12:00:00
-- Aligns with Prisma schema for client-side integration (public key, orderId, successUrl, failUrl, webhookUrl)

USE solopay;

-- ============================================================
-- 1. Merchant: public_key, public_key_hash, allowed_domains
-- ============================================================
ALTER TABLE merchants
  ADD COLUMN public_key VARCHAR(255) NULL UNIQUE COMMENT 'pk_live_xxx for client-side integration' AFTER api_key_hash,
  ADD COLUMN public_key_hash VARCHAR(64) NULL UNIQUE COMMENT 'SHA-256 hash of public_key (same pattern as api_key_hash)' AFTER public_key,
  ADD COLUMN allowed_domains JSON NULL COMMENT 'List of domains allowed for public_key usage' AFTER public_key_hash;

-- ============================================================
-- 2. Payment: order_id, success_url, fail_url, webhook_url, origin, payer_address + index
-- ============================================================
ALTER TABLE payments
  ADD COLUMN order_id VARCHAR(255) NULL COMMENT 'Merchant order ID (client-side integration)' AFTER confirmed_at,
  ADD COLUMN success_url VARCHAR(500) NULL COMMENT 'Redirect URL on payment success' AFTER order_id,
  ADD COLUMN fail_url VARCHAR(500) NULL COMMENT 'Redirect URL on payment failure/cancel' AFTER success_url,
  ADD COLUMN webhook_url VARCHAR(500) NULL COMMENT 'Per-payment webhook (fallback: merchant.webhook_url)' AFTER fail_url,
  ADD COLUMN origin VARCHAR(500) NULL COMMENT 'Request origin for domain verification audit' AFTER webhook_url,
  ADD COLUMN payer_address VARCHAR(42) NULL COMMENT 'Payer wallet address' AFTER origin;

CREATE INDEX idx_payments_order_id_merchant_id ON payments (order_id, merchant_id);
