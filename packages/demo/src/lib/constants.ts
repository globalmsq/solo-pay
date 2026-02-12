/**
 * Demo app constants
 * Centralized configuration for easy reference and modification
 */

import { polygon, polygonAmoy, hardhat } from 'wagmi/chains';

// Demo merchant address (Hardhat account #1)
export const DEMO_MERCHANT_ADDRESS = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as const;

// Blockchain query limits
export const RECENT_BLOCKS_SCAN_LIMIT = 100;
export const SUBGRAPH_QUERY_LIMIT = 20;

// UI timing constants (milliseconds)
export const PAYMENT_HISTORY_REFRESH_DELAY = 500;
export const TOAST_DURATION = 3000;

// ============================================================
// UI Display Constants (for informational display only)
// ⚠️ These are NOT used for contract interactions!
// Contract addresses are provided by the server via checkout API.
// ============================================================

// Default token symbol per chain (UI display only)
export const DEFAULT_TOKEN_SYMBOL: Record<number, string> = {
  [polygon.id]: 'TEST-MSQ',
  [polygonAmoy.id]: 'SUT',
  [hardhat.id]: 'TEST',
};

// Token addresses per chain (UI display only - for polygonscan links etc.)
export const TOKENS: Record<number, Record<string, `0x${string}`>> = {
  [polygon.id]: {
    'TEST-MSQ': '0x3894c0a581eee053f9e220c4d2b4434f825af437',
  },
  [polygonAmoy.id]: {
    SUT: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
  },
  [hardhat.id]: {
    TEST: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  },
};
