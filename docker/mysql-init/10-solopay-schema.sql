-- ============================================================
-- SoloPay MySQL Initialization - Main Schema
-- ============================================================
-- SPEC-DB-001: Gateway Database Integration
-- This script creates all tables for the solopay database
-- Schema aligned with Prisma schema (INT AUTO_INCREMENT IDs)
-- Execution Order: 10 (Second)
-- ============================================================

USE solopay;

-- ============================================================
-- ENUMS (MySQL doesn't have native enums, use ENUM type)
-- ============================================================

-- PaymentStatus: CREATED, PENDING, CONFIRMED, FAILED, EXPIRED
-- RelayStatus: QUEUED, SUBMITTED, CONFIRMED, FAILED
-- RefundStatus: PENDING, SUBMITTED, CONFIRMED, FAILED
-- EventType: CREATED, STATUS_CHANGED, RELAY_SUBMITTED, RELAY_CONFIRMED, EXPIRED, REFUND_REQUESTED, REFUND_SUBMITTED, REFUND_CONFIRMED, REFUND_FAILED

-- ============================================================
-- TABLE 1: chains - Blockchain networks
-- ============================================================
CREATE TABLE IF NOT EXISTS chains (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    network_id INT NOT NULL UNIQUE COMMENT 'EIP-155 chain ID',
    name VARCHAR(255) NOT NULL,
    rpc_url VARCHAR(500) NOT NULL,
    gateway_address VARCHAR(42) NULL COMMENT 'PaymentGateway proxy address',
    forwarder_address VARCHAR(42) NULL COMMENT 'ERC2771Forwarder address',
    is_testnet BOOLEAN NOT NULL DEFAULT FALSE,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_network_id (network_id),
    INDEX idx_is_enabled (is_enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE 2: tokens - ERC20 tokens per chain
-- ============================================================
CREATE TABLE IF NOT EXISTS tokens (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    chain_id INT NOT NULL COMMENT 'Logical reference to chains.id',
    address VARCHAR(42) NOT NULL COMMENT 'ERC20 contract address',
    symbol VARCHAR(20) NOT NULL,
    decimals INT NOT NULL,
    cmc_id INT NULL DEFAULT NULL COMMENT 'CoinMarketCap cryptocurrency ID for price lookup',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_chain_address (chain_id, address),
    INDEX idx_chain_id (chain_id),
    INDEX idx_symbol (symbol)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE 3: merchants - Merchant accounts
-- public_key / public_key_hash / allowed_domains: set via API
-- (POST /merchants/me/public-key and PATCH /merchants/me), not on insert
-- ============================================================
CREATE TABLE IF NOT EXISTS merchants (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    merchant_key VARCHAR(255) NOT NULL UNIQUE COMMENT 'Public merchant identifier',
    name VARCHAR(255) NOT NULL,
    chain_id INT NOT NULL COMMENT 'Logical reference to chains.id',
    api_key_hash VARCHAR(64) NOT NULL UNIQUE COMMENT 'SHA-256 hash of API key; one API key per merchant',
    public_key VARCHAR(255) NULL UNIQUE COMMENT 'pk_live_xxx for client-side integration',
    public_key_hash VARCHAR(64) NULL UNIQUE COMMENT 'SHA-256 hash of public_key (same pattern as api_key_hash)',
    allowed_domains JSON NULL COMMENT 'List of domains allowed for public_key usage',
    webhook_url VARCHAR(500) NULL DEFAULT NULL,
    fee_bps INT NOT NULL DEFAULT 0 COMMENT 'Fee in basis points (0-10000, where 10000=100%)',
    recipient_address VARCHAR(42) NULL DEFAULT NULL COMMENT 'Merchant wallet address for receiving payments',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_merchant_key (merchant_key),
    INDEX idx_chain_id (chain_id),
    INDEX idx_is_enabled (is_enabled)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE 4: merchant_payment_methods - Payment settings per merchant
-- Note: recipient_address removed - contract pays to treasury (set at deployment)
-- ============================================================
CREATE TABLE IF NOT EXISTS merchant_payment_methods (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    merchant_id INT NOT NULL COMMENT 'Logical reference to merchants.id',
    token_id INT NOT NULL COMMENT 'Logical reference to tokens.id',
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_merchant_token (merchant_id, token_id),
    INDEX idx_merchant_id (merchant_id),
    INDEX idx_token_id (token_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE 5: payments - Payment records
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    payment_hash VARCHAR(66) NOT NULL UNIQUE COMMENT 'Keccak256 hash (bytes32)',
    merchant_id INT NOT NULL COMMENT 'Logical reference to merchants.id',
    payment_method_id INT NOT NULL COMMENT 'Logical reference to merchant_payment_methods.id',
    amount DECIMAL(65,0) NOT NULL COMMENT 'Payment amount in wei',
    token_decimals INT NOT NULL COMMENT 'Snapshot of token decimals at creation',
    token_symbol VARCHAR(20) NOT NULL COMMENT 'Snapshot of token symbol at creation',
    network_id INT NOT NULL COMMENT 'Snapshot of chain network_id at creation',
    status ENUM('CREATED', 'PENDING', 'CONFIRMED', 'FAILED', 'EXPIRED') NOT NULL DEFAULT 'CREATED',
    tx_hash VARCHAR(66) NULL DEFAULT NULL COMMENT 'Transaction hash (bytes32)',
    expires_at TIMESTAMP NOT NULL,
    confirmed_at TIMESTAMP NULL DEFAULT NULL,
    order_id VARCHAR(255) NULL DEFAULT NULL COMMENT 'Merchant order ID (client-side integration)',
    success_url VARCHAR(500) NULL DEFAULT NULL COMMENT 'Redirect URL on payment success',
    fail_url VARCHAR(500) NULL DEFAULT NULL COMMENT 'Redirect URL on payment failure/cancel',
    webhook_url VARCHAR(500) NULL DEFAULT NULL COMMENT 'Per-payment webhook (fallback: merchant.webhook_url)',
    origin VARCHAR(500) NULL DEFAULT NULL COMMENT 'Request origin for domain verification audit',
    payer_address VARCHAR(42) NULL DEFAULT NULL COMMENT 'Payer wallet address',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_payment_hash (payment_hash),
    INDEX idx_merchant_id (merchant_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at),
    UNIQUE INDEX idx_payments_order_id_merchant_id (order_id, merchant_id) COMMENT 'One payment per (order_id, merchant_id); multiple NULL order_id allowed'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE 6: relay_requests - Gasless relay tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS relay_requests (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    relay_ref VARCHAR(255) NOT NULL UNIQUE COMMENT 'Unique relay reference',
    payment_id INT NOT NULL COMMENT 'Logical reference to payments.id',
    status ENUM('QUEUED', 'SUBMITTED', 'CONFIRMED', 'FAILED') NOT NULL DEFAULT 'QUEUED',
    gas_estimate DECIMAL(65,0) NULL DEFAULT NULL COMMENT 'Estimated gas in wei',
    gas_used DECIMAL(65,0) NULL DEFAULT NULL COMMENT 'Actual gas used in wei',
    tx_hash VARCHAR(66) NULL DEFAULT NULL COMMENT 'Relay transaction hash',
    error_message TEXT NULL DEFAULT NULL,
    submitted_at TIMESTAMP NULL DEFAULT NULL,
    confirmed_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_relay_ref (relay_ref),
    INDEX idx_payment_id (payment_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE 7: payment_events - Audit log
-- ============================================================
CREATE TABLE IF NOT EXISTS payment_events (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    payment_id INT NOT NULL COMMENT 'Logical reference to payments.id',
    event_type ENUM('CREATED', 'STATUS_CHANGED', 'RELAY_SUBMITTED', 'RELAY_CONFIRMED', 'EXPIRED', 'REFUND_REQUESTED', 'REFUND_SUBMITTED', 'REFUND_CONFIRMED', 'REFUND_FAILED') NOT NULL,
    old_status VARCHAR(20) NULL DEFAULT NULL,
    new_status VARCHAR(20) NULL DEFAULT NULL,
    metadata JSON NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_payment_id (payment_id),
    INDEX idx_event_type (event_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE 8: refunds - Refund records
-- ============================================================
CREATE TABLE IF NOT EXISTS refunds (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    refund_hash VARCHAR(66) NOT NULL UNIQUE COMMENT 'Keccak256 hash (bytes32), unique refund identifier',
    payment_id INT NOT NULL COMMENT 'Logical reference to payments.id',
    merchant_id INT NOT NULL COMMENT 'Logical reference to merchants.id (denormalized)',
    amount DECIMAL(65,0) NOT NULL COMMENT 'Refund amount in wei',
    token_address VARCHAR(42) NOT NULL COMMENT 'Token contract address',
    payer_address VARCHAR(42) NOT NULL COMMENT 'Refund recipient (original payer)',
    status ENUM('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    reason VARCHAR(500) NULL DEFAULT NULL COMMENT 'Refund reason (optional)',
    tx_hash VARCHAR(66) NULL DEFAULT NULL COMMENT 'Refund transaction hash',
    error_message TEXT NULL DEFAULT NULL COMMENT 'Error message on failure',
    submitted_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Relayer submission time',
    confirmed_at TIMESTAMP NULL DEFAULT NULL COMMENT 'On-chain confirmation time',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_refund_hash (refund_hash),
    INDEX idx_payment_id (payment_id),
    INDEX idx_merchant_id (merchant_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE 9: wallet_gas_grants - One-time gas faucet per wallet per chain
-- ============================================================
CREATE TABLE IF NOT EXISTS wallet_gas_grants (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    wallet_address VARCHAR(42) NOT NULL,
    chain_id INT NOT NULL COMMENT 'EIP-155 network_id',
    amount VARCHAR(78) NOT NULL COMMENT 'wei (string for bigint)',
    tx_hash VARCHAR(66) NULL DEFAULT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    UNIQUE KEY wallet_gas_grants_wallet_address_chain_id_key (wallet_address, chain_id),
    INDEX idx_wallet_chain (wallet_address, chain_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
