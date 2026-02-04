-- Migration: Merchant public key, Payment client fields, WalletGasGrant
-- Date: 2026-02-04 12:00:00
-- Aligns with Prisma schema for client-side integration (public key, orderId, successUrl, failUrl, webhookUrl, gas faucet)

USE msqpay;

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

-- ============================================================
-- 3. New table: wallet_gas_grants (Gas faucet grant history, one grant per wallet per chain)
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_gas_grants (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL COMMENT 'Wallet that received gas',
  chain_id INT NOT NULL COMMENT 'EIP-155 chain ID',
  amount VARCHAR(78) NOT NULL COMMENT 'Gas amount in wei (string)',
  tx_hash VARCHAR(66) NULL DEFAULT NULL COMMENT 'Gas transfer transaction hash',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_wallet_chain (wallet_address, chain_id),
  INDEX idx_wallet_address (wallet_address),
  INDEX idx_chain_id (chain_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
