/**
 * Constants
 */

export const WALLET_TYPES = {
  METAMASK: 'metamask',
  TRUST: 'trust',
  INJECTED: 'injected',
};

export const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
];

export const PAYMENT_GATEWAY_ABI = [
  'function pay(bytes32 paymentId, address token, uint256 amount, address merchant) external',
];

export const FORWARDER_ABI = ['function nonces(address owner) view returns (uint256)'];

export const PAYMENT_STEPS = {
  VALIDATING: { step: 1, total: 6, message: 'Validating payment...' },
  CREATING: { step: 2, total: 6, message: 'Creating payment request...' },
  APPROVING: { step: 3, total: 6, message: 'Approving token spend...' },
  WALLET_CONFIRM: { step: 4, total: 6, message: 'Waiting for wallet confirmation...' },
  PROCESSING: { step: 5, total: 6, message: 'Processing transaction...' },
  CONFIRMING: { step: 6, total: 6, message: 'Confirming payment...' },
};

export const GASLESS_STEPS = {
  VALIDATING: { step: 1, total: 6, message: 'Validating payment...' },
  CREATING: { step: 2, total: 6, message: 'Creating payment request...' },
  APPROVING: { step: 3, total: 6, message: 'Approving token spend...' },
  SIGNING: { step: 4, total: 6, message: 'Signing transaction...' },
  RELAYING: { step: 5, total: 6, message: 'Relaying transaction...' },
  CONFIRMING: { step: 6, total: 6, message: 'Confirming payment...' },
};

export const BLOCK_EXPLORERS = {
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
