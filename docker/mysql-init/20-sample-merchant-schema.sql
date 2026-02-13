-- ============================================================
-- SoloPay MySQL Initialization - Sample Merchant Schema
-- ============================================================
-- SPEC-DB-001: Gateway Database Integration
-- This script creates tables for the sample merchant database
-- Execution Order: 20 (Third)
-- ============================================================

USE solopay_sample_merchant;

-- ============================================================
-- ENUMS
-- ============================================================

-- PaymentStatus: CREATED, PENDING, CONFIRMED, FAILED, EXPIRED

-- ============================================================
-- TABLE 1: Product - Coffee products
-- ============================================================
CREATE TABLE IF NOT EXISTS Product (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    roast VARCHAR(255) NOT NULL,
    weight VARCHAR(255) NOT NULL,
    price INT NOT NULL,
    description VARCHAR(1000) NOT NULL,
    image_url VARCHAR(500) NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE 2: Payment - Payment records for products
-- ============================================================
CREATE TABLE IF NOT EXISTS Payment (
    id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL COMMENT 'FK to Product.id',
    amount DECIMAL(65,0) NOT NULL COMMENT 'Payment amount in wei (max uint256)',
    token_symbol VARCHAR(20) NOT NULL,
    status ENUM('CREATED', 'PENDING', 'CONFIRMED', 'FAILED', 'EXPIRED') NOT NULL DEFAULT 'CREATED',
    tx_hash VARCHAR(66) NULL DEFAULT NULL COMMENT 'Transaction hash',
    confirmed_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_product_id (product_id),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
