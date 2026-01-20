/**
 * OpenAPI JSON Schemas for API documentation
 * These schemas are used by @fastify/swagger to generate API documentation
 */

// ============================================
// Common Schemas
// ============================================

export const ErrorResponseSchema = {
  type: 'object',
  properties: {
    code: { type: 'string', description: 'Error code', example: 'INVALID_REQUEST' },
    message: { type: 'string', description: 'Error message' },
    details: {
      type: 'object',
      additionalProperties: true,
      description: 'Additional error details',
    },
  },
  required: ['code', 'message'],
} as const;

export const EthereumAddressSchema = {
  type: 'string',
  pattern: '^0x[a-fA-F0-9]{40}$',
  example: '0x1234567890abcdef1234567890abcdef12345678',
  description: 'Ethereum address (0x + 40 hex characters)',
} as const;

export const PaymentHashSchema = {
  type: 'string',
  pattern: '^0x[a-fA-F0-9]{64}$',
  example: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
  description: 'Payment hash (bytes32)',
} as const;

// ============================================
// Payment Schemas
// ============================================

export const CreatePaymentRequestSchema = {
  type: 'object',
  properties: {
    merchantId: {
      type: 'string',
      minLength: 1,
      description: 'Unique merchant identifier (merchant_key)',
      example: 'merchant_demo_001',
    },
    amount: {
      type: 'number',
      exclusiveMinimum: 0,
      description: 'Payment amount in base token units (e.g., 10.5 for 10.5 TEST)',
      example: 10,
    },
    chainId: {
      type: 'integer',
      minimum: 1,
      description: 'Blockchain network ID',
      example: 31337,
    },
    tokenAddress: {
      type: 'string',
      pattern: '^0x[a-fA-F0-9]{40}$',
      description: 'ERC20 token contract address',
      example: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    },
    recipientAddress: {
      type: 'string',
      pattern: '^0x[a-fA-F0-9]{40}$',
      description: 'Recipient wallet address',
      example: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    },
  },
  required: ['merchantId', 'amount', 'chainId', 'tokenAddress', 'recipientAddress'],
} as const;

export const CreatePaymentResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    paymentId: {
      type: 'string',
      description: 'Unique payment hash (bytes32)',
      example: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    },
    chainId: { type: 'integer', example: 31337 },
    tokenAddress: {
      type: 'string',
      example: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    },
    tokenSymbol: { type: 'string', example: 'USDT' },
    tokenDecimals: { type: 'integer', example: 6 },
    gatewayAddress: {
      type: 'string',
      description: 'PaymentGateway contract address',
      example: '0x1234567890abcdef1234567890abcdef12345678',
    },
    forwarderAddress: {
      type: 'string',
      description: 'ERC2771 Forwarder contract address',
      example: '0x1234567890abcdef1234567890abcdef12345678',
    },
    amount: {
      type: 'string',
      description: 'Amount in wei (smallest unit)',
      example: '10500000',
    },
    status: {
      type: 'string',
      enum: ['created', 'pending', 'confirmed', 'failed'],
      example: 'created',
    },
    expiresAt: {
      type: 'string',
      format: 'date-time',
      description: 'Payment expiration time (ISO 8601)',
      example: '2024-01-20T12:30:00.000Z',
    },
  },
} as const;

export const PaymentStatusResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: {
      type: 'object',
      properties: {
        payment_hash: { type: 'string' },
        network_id: { type: 'integer' },
        token_symbol: { type: 'string' },
        status: {
          type: 'string',
          enum: ['CREATED', 'PENDING', 'CONFIRMED', 'FAILED'],
        },
        amount: { type: 'string' },
        transactionHash: { type: 'string', nullable: true },
        blockNumber: { type: 'integer', nullable: true },
      },
    },
  },
} as const;

// ============================================
// Gasless Transaction Schemas
// ============================================

export const ForwardRequestSchema = {
  type: 'object',
  properties: {
    from: {
      type: 'string',
      pattern: '^0x[a-fA-F0-9]{40}$',
      description: 'Sender address',
    },
    to: {
      type: 'string',
      pattern: '^0x[a-fA-F0-9]{40}$',
      description: 'Target contract address (PaymentGateway)',
    },
    value: { type: 'string', description: 'ETH value (usually "0")' },
    gas: { type: 'string', description: 'Gas limit' },
    nonce: { type: 'string', description: 'Forwarder nonce for this sender' },
    deadline: { type: 'string', description: 'Unix timestamp deadline' },
    data: {
      type: 'string',
      pattern: '^0x',
      description: 'Encoded function call data (pay function)',
    },
    signature: {
      type: 'string',
      pattern: '^0x',
      description: 'EIP-712 signature',
    },
  },
  required: ['from', 'to', 'value', 'gas', 'nonce', 'deadline', 'data', 'signature'],
} as const;

export const GaslessRequestSchema = {
  type: 'object',
  properties: {
    paymentId: {
      type: 'string',
      description: 'Payment hash from /payments/create',
      example: '0xabcdef...',
    },
    forwarderAddress: {
      type: 'string',
      pattern: '^0x[a-fA-F0-9]{40}$',
      description: 'ERC2771 Forwarder contract address',
    },
    forwardRequest: ForwardRequestSchema,
  },
  required: ['paymentId', 'forwarderAddress', 'forwardRequest'],
} as const;

export const GaslessResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    relayId: {
      type: 'string',
      description: 'Relay job ID for tracking',
    },
    status: {
      type: 'string',
      enum: ['submitted', 'pending', 'confirmed', 'failed'],
    },
    transactionHash: {
      type: 'string',
      nullable: true,
      description: 'Transaction hash (available after submission)',
    },
  },
} as const;

// ============================================
// Token Schemas
// ============================================

export const TokenBalanceQuerySchema = {
  type: 'object',
  properties: {
    chainId: {
      type: 'string',
      description: 'Blockchain network ID',
      example: '31337',
    },
    address: {
      type: 'string',
      pattern: '^0x[a-fA-F0-9]{40}$',
      description: 'Wallet address to check balance',
    },
  },
  required: ['chainId', 'address'],
} as const;

export const TokenBalanceResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: {
      type: 'object',
      properties: {
        balance: {
          type: 'string',
          description: 'Token balance in wei',
          example: '1000000000',
        },
      },
    },
  },
} as const;

export const TokenAllowanceQuerySchema = {
  type: 'object',
  properties: {
    chainId: {
      type: 'string',
      description: 'Blockchain network ID',
    },
    owner: {
      type: 'string',
      pattern: '^0x[a-fA-F0-9]{40}$',
      description: 'Token owner address',
    },
    spender: {
      type: 'string',
      pattern: '^0x[a-fA-F0-9]{40}$',
      description: 'Spender address (usually PaymentGateway)',
    },
  },
  required: ['chainId', 'owner', 'spender'],
} as const;

export const TokenAllowanceResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: {
      type: 'object',
      properties: {
        allowance: {
          type: 'string',
          description: 'Approved allowance in wei',
          example: '115792089237316195423570985008687907853269984665640564039457584007913129639935',
        },
      },
    },
  },
} as const;

// ============================================
// Chain Schemas
// ============================================

export const ChainInfoSchema = {
  type: 'object',
  properties: {
    id: { type: 'integer', description: 'Chain database ID' },
    networkId: { type: 'integer', description: 'Blockchain network ID', example: 31337 },
    name: { type: 'string', example: 'Hardhat Local' },
    gatewayAddress: { type: 'string', description: 'PaymentGateway contract' },
    forwarderAddress: { type: 'string', description: 'ERC2771 Forwarder contract' },
    tokens: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          address: { type: 'string' },
          symbol: { type: 'string', example: 'USDT' },
          decimals: { type: 'integer', example: 6 },
        },
      },
    },
  },
} as const;

export const ChainsResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: {
      type: 'array',
      items: ChainInfoSchema,
    },
  },
} as const;

// ============================================
// Merchant Schemas
// ============================================

export const MerchantResponseSchema = {
  type: 'object',
  properties: {
    success: { type: 'boolean', example: true },
    data: {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        merchant_key: { type: 'string' },
        name: { type: 'string' },
        is_enabled: { type: 'boolean' },
        chain_id: { type: 'integer', nullable: true },
        created_at: { type: 'string', format: 'date-time' },
        updated_at: { type: 'string', format: 'date-time' },
      },
    },
  },
} as const;
