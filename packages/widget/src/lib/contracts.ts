/**
 * Contract ABIs and utilities for blockchain interactions
 */

// ============================================================================
// ERC20 Token ABI (minimal for balance, allowance, approve)
// ============================================================================

export const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// ============================================================================
// PaymentGateway ABI
// ============================================================================

export const PAYMENT_GATEWAY_ABI = [
  {
    type: 'function',
    name: 'pay',
    inputs: [
      { name: 'paymentId', type: 'bytes32' },
      { name: 'tokenAddress', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'recipientAddress', type: 'address' },
      { name: 'merchantId', type: 'bytes32' },
      { name: 'feeBps', type: 'uint16' },
      { name: 'serverSignature', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    inputs: [{ name: 'paymentId', type: 'bytes32' }],
    name: 'processedPayments',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'tokenAddress', type: 'address' }],
    name: 'supportedTokens',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'treasury',
    outputs: [{ name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'paymentId', type: 'bytes32' },
      { indexed: true, name: 'payerAddress', type: 'address' },
      { indexed: true, name: 'treasuryAddress', type: 'address' },
      { indexed: false, name: 'tokenAddress', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
      { indexed: false, name: 'timestamp', type: 'uint256' },
    ],
    name: 'PaymentCompleted',
    type: 'event',
  },
] as const;

// ============================================================================
// ERC2771Forwarder ABI (for gasless payments)
// ============================================================================

export const FORWARDER_ABI = [
  {
    type: 'function',
    name: 'nonces',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;
