-- ============================================================
-- SoloPay MySQL Initialization - Development Seed Data
-- ============================================================
-- SPEC-DB-001: Gateway Database Integration
-- This script inserts demo data for local development
-- Execution Order: 90 (Last)
-- ============================================================

USE solopay;

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
('merchant_demo_001', 'Demo Store', 1, 'a665a45920422f9d417e4867efdc4fb8a04a1f3fff1fa07e998e86f7f7a27ae3', 'pk_test_demo', 'cfaaf44f4fcf9f65805b2a4642a68173d0b427f104dd192adbb489f01e392b76', '["http://localhost:3000"]', 'http://demo:3000/api/webhook', 0, '0x70997970C51812dc3A010C7d01b50e0d17dc79C8');

-- MetaStar Merchant (id=2)
-- API Key: msq_sk_metastar_123 -> SHA-256 hash
-- chain_id=3 (Amoy chain)
-- recipient_address: Steven's wallet address for receiving payments
-- public_key, public_key_hash, allowed_domains: NULL by default; configure via POST /merchants/me/public-key
INSERT INTO merchants (merchant_key, name, chain_id, api_key_hash, public_key, public_key_hash, allowed_domains, webhook_url, fee_bps, recipient_address) VALUES
('merchant_metastar_001', 'Metastar Global', 3, '0136f3e97619f4aa51dffe177e9b7d6bf495ffd6b09547f5463ef483d1db705a', NULL, NULL, NULL, NULL, 0, '0x7bE4CfF95eb3c3d2162410abCd5506f691C624Ed');

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

-- ============================================================
-- Verification Queries
-- ============================================================

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
