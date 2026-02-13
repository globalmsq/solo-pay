-- SoloPay MySQL Initialization Script
-- SPEC-DB-001: Gateway Database Integration
-- This script runs automatically when MySQL container starts for the first time
-- Schema aligned with Prisma schema (INT AUTO_INCREMENT IDs)

-- Create database if not exists
CREATE DATABASE IF NOT EXISTS solopay CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS solopay_sample_merchant CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Grant permissions to solopay user for sample_merchant database
GRANT ALL PRIVILEGES ON solopay_sample_merchant.* TO 'solopay'@'%';
-- Grant CREATE/DROP for Prisma shadow database (used by prisma migrate dev)
GRANT CREATE, DROP ON *.* TO 'solopay'@'%';
FLUSH PRIVILEGES;

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
    INDEX idx_order_id_merchant_id (order_id, merchant_id)
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

-- ============================================================
-- DEMO DATA FOR DEVELOPMENT
-- ============================================================

-- Chains (7 networks)
-- id=1: Localhost (Hardhat/Anvil) - with deployed contracts
-- id=2: Sepolia (Ethereum Testnet) - no contracts yet
-- id=3: Amoy (Polygon Testnet) - with deployed contracts
-- id=4: BNB Chain Testnet - no contracts yet
-- id=5: Polygon (Mainnet) - no contracts yet
-- id=6: Ethereum (Mainnet) - no contracts yet
-- id=7: BNB Chain (Mainnet) - no contracts yet
-- Deployment order: Forwarder → MockERC20 → GatewayV1 → Proxy
INSERT INTO chains (network_id, name, rpc_url, gateway_address, forwarder_address, is_testnet) VALUES
(31337, 'Localhost', 'http://hardhat-node:8545', '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9', '0x5FbDB2315678afecb367f032d93F642f64180aa3', TRUE),
(11155111, 'Sepolia', 'https://ethereum-sepolia-rpc.publicnode.com', NULL, NULL, TRUE),
(80002, 'Amoy', 'https://rpc-amoy.polygon.technology', '0x2024b6669A2BE5fF9624792cB1BB657d20C4b24B', '0xE8a3C8e530dddd14e02DA1C81Df6a15f41ad78DE', TRUE),
(97, 'BNB Chain Testnet', 'https://data-seed-prebsc-1-s1.binance.org:8545', NULL, NULL, TRUE),
(137, 'Polygon', 'https://polygon-rpc.com', '0x4F81a1481fc3d6479E2e6d56052fC60539F707ec', '0xec63c3E7BD0c51AA6DC08f587A2B147a671cf888', FALSE),
(1, 'Ethereum', 'https://eth.llamarpc.com', NULL, NULL, FALSE),
(56, 'BNB Chain', 'https://bsc-dataseed.binance.org', NULL, NULL, FALSE);

-- Tokens (3 tokens)
-- id=1: TEST on Localhost (chain_id=1) - MockERC20 is second deployed contract (nonce 1)
-- id=2: SUT on Polygon (chain_id=5)
-- id=3: SUT on Amoy (chain_id=3)
INSERT INTO tokens (chain_id, address, symbol, decimals) VALUES
(1, '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', 'TEST', 18),
(5, '0x98965474EcBeC2F532F1f780ee37b0b05F77Ca55', 'SUT', 18),
(5, '0x6A8Ec2d9BfBDD20A7F5A4E89D640F7E7cebA4499', 'MSQ', 18),
(3, '0xE4C687167705Abf55d709395f92e254bdF5825a2', 'SUT', 18),
(3, '0x7350C119cb048c2Ea6b2532bcE82c2F7c042ff6b', 'MSQ', 18);

-- Demo Merchant (id=1)
-- API Key: 123 -> SHA-256 hash
-- Public Key: pk_test_demo_001 -> SHA-256 hash
-- chain_id=1 (Localhost chain)
-- recipient_address: Account #1 (recipient) for receiving payments
-- webhook_url: Demo app receives webhooks at /api/webhook (Docker: http://demo:3000/api/webhook)
INSERT INTO merchants (merchant_key, name, chain_id, api_key_hash, public_key, public_key_hash, allowed_domains, webhook_url, fee_bps, recipient_address) VALUES
('merchant_demo_001', 'Demo Store', 1, 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', 'pk_test_demo_001', '51a9fbfc241088a3463f5df1db9d4d1963e4b74056f0892417f7db37bdf17b01', '["http://localhost:3000"]', 'http://demo:3000/api/webhook', 0, '0x70997970C51812dc3A010C7d01b50e0d17dc79C8');

-- MetaStar Merchant (id=2)
-- API Key: msq_sk_metastar_123 -> SHA-256 hash
-- chain_id=3 (Amoy chain)
-- recipient_address: Steven's wallet address for receiving payments
-- public_key, public_key_hash, allowed_domains: NULL by default; configure via POST /merchants/me/public-key
INSERT INTO merchants (merchant_key, name, chain_id, api_key_hash, webhook_url, fee_bps, recipient_address) VALUES
('merchant_metastar_001', 'Metastar Global', 3, '0136f3e97619f4aa51dffe177e9b7d6bf495ffd6b09547f5463ef483d1db705a', NULL, 0, '0x7bE4CfF95eb3c3d2162410abCd5506f691C624Ed');

-- Sample Merchant (id=3)
-- API Key: sample_api_key_001 -> SHA-256 hash
-- chain_id=1 (Localhost chain)
-- recipient_address: Account #6 (recipient) for receiving payments
-- public_key, public_key_hash, allowed_domains: NULL by default; configure via POST /merchants/me/public-key
-- webhook_url: http://sample-merchant:3004/api/webhook (Docker internal network)
INSERT INTO merchants (merchant_key, name, chain_id, api_key_hash, public_key, public_key_hash, allowed_domains, webhook_url, fee_bps, recipient_address) VALUES
('merchant_sample_001', 'Sample Merchant', 1, '9074171b675d51a53e7524e3b79d1dfa920d72063dcaab734856dd8f97749bd3', 'pk_live_xqKZ6PpVdfUaaVBJhS6qI8RbUbZUbvSq', '05994e195c9cde2a1548d848fa5d40d3506da18d0071785981db25daeb86d4f6', '["http://localhost:3005"]', 'http://sample-merchant:3004/api/webhook', 0, '0x976EA74026E726554dB657fA54763abd0C3a0aa9');

-- Payment Methods
-- Note: Payment methods must use tokens from the merchant's chain
-- Note: recipient_address removed - contract pays to treasury (set at deployment)
-- id=1: Demo Merchant (chain_id=1) + TEST on Localhost (token_id=1, chain_id=1)
-- id=2: MetaStar (chain_id=3) + SUT on Amoy (token_id=3, chain_id=3)
INSERT INTO merchant_payment_methods (merchant_id, token_id) VALUES
(1, 1),
(2, 5),
(3, 1);

-- Show created tables
SHOW TABLES;

-- Show table row counts
SELECT 'chains' as table_name, COUNT(*) as row_count FROM chains
UNION ALL
SELECT 'tokens', COUNT(*) FROM tokens
UNION ALL
SELECT 'merchants', COUNT(*) FROM merchants
UNION ALL
SELECT 'merchant_payment_methods', COUNT(*) FROM merchant_payment_methods
UNION ALL
SELECT 'payments', COUNT(*) FROM payments
UNION ALL
SELECT 'relay_requests', COUNT(*) FROM relay_requests
UNION ALL
SELECT 'payment_events', COUNT(*) FROM payment_events
UNION ALL
SELECT 'refunds', COUNT(*) FROM refunds
UNION ALL
SELECT 'wallet_gas_grants', COUNT(*) FROM wallet_gas_grants;
