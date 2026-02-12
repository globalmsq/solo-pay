-- Migration: WalletGasGrant table for gas faucet (one grant per wallet per chain)
-- Date: 2026-02-09 10:00:00

USE solopay;

CREATE TABLE wallet_gas_grants (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  wallet_address VARCHAR(42) NOT NULL,
  chain_id INT NOT NULL COMMENT 'EIP-155 network_id',
  amount VARCHAR(78) NOT NULL COMMENT 'wei (string for bigint)',
  tx_hash VARCHAR(66) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY wallet_gas_grants_wallet_address_chain_id_key (wallet_address, chain_id)
);
