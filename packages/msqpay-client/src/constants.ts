/**
 * Constants
 */

export const WALLET_TYPES = {
  METAMASK: 'metamask',
  TRUST: 'trust',
  INJECTED: 'injected',
} as const;

export type WalletType = (typeof WALLET_TYPES)[keyof typeof WALLET_TYPES];

export const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
] as const;

export const PAYMENT_GATEWAY_ABI = [
  'function pay(bytes32 paymentId, address token, uint256 amount, address merchant) external',
] as const;

export const FORWARDER_ABI = ['function nonces(address owner) view returns (uint256)'] as const;

export interface PaymentStep {
  step: number;
  total: number;
  message: string;
}

export const PAYMENT_STEPS: Record<string, PaymentStep> = {
  VALIDATING: { step: 1, total: 6, message: 'Validating payment...' },
  CREATING: { step: 2, total: 6, message: 'Creating payment request...' },
  APPROVING: { step: 3, total: 6, message: 'Approving token spend...' },
  WALLET_CONFIRM: { step: 4, total: 6, message: 'Waiting for wallet confirmation...' },
  PROCESSING: { step: 5, total: 6, message: 'Processing transaction...' },
  CONFIRMING: { step: 6, total: 6, message: 'Confirming payment...' },
};

export const GASLESS_STEPS: Record<string, PaymentStep> = {
  VALIDATING: { step: 1, total: 6, message: 'Validating payment...' },
  CREATING: { step: 2, total: 6, message: 'Creating payment request...' },
  APPROVING: { step: 3, total: 6, message: 'Approving token spend...' },
  SIGNING: { step: 4, total: 6, message: 'Signing transaction...' },
  RELAYING: { step: 5, total: 6, message: 'Relaying transaction...' },
  CONFIRMING: { step: 6, total: 6, message: 'Confirming payment...' },
};

export const BLOCK_EXPLORERS: Record<number, string> = {
  1: 'https://etherscan.io',
  11155111: 'https://sepolia.etherscan.io',
  137: 'https://polygonscan.com',
  80002: 'https://amoy.polygonscan.com',
  56: 'https://bscscan.com',
  97: 'https://testnet.bscscan.com',
  42161: 'https://arbiscan.io',
  10: 'https://optimistic.etherscan.io',
  43114: 'https://snowtrace.io',
  8453: 'https://basescan.org',
  31337: 'http://localhost:8545',
};

// Timing constants
export const TIMING = {
  ETHERS_CHECK_INTERVAL: 100, // ms - Check interval for ethers.js availability
  ETHERS_CHECK_TIMEOUT: 10000, // ms - Timeout for ethers.js check
  WALLET_REQUEST_RETRY_DELAY: 1000, // ms - Delay before retrying wallet request
  PAYMENT_STATUS_POLL_INITIAL_DELAY: 2000, // ms - Initial delay before starting payment status polling
  PAYMENT_STATUS_POLL_INTERVAL: 3000, // ms - Polling interval for payment status
  PAYMENT_STATUS_MAX_ATTEMPTS: 60, // Maximum polling attempts
  RELAY_STATUS_POLL_INTERVAL: 3000, // ms - Polling interval for relay status
  RELAY_STATUS_TIMEOUT: 120000, // ms - Timeout for relay status check
} as const;

// Default values
export const DEFAULTS = {
  GASLESS_DEADLINE: 600, // seconds - Default deadline for gasless payments (10 minutes)
  GASLESS_GAS_LIMIT: 300000, // Default gas limit for gasless transactions
  DAPP_NAME: 'MSQPay', // Default dApp name
} as const;

// Error codes
export const ERROR_CODES = {
  WALLET_REQUEST_PENDING: -32002, // Request already pending
  USER_REJECTED: 4001, // User rejected the request
} as const;
