import { FastifyDynamicSwaggerOptions } from '@fastify/swagger';
import { FastifySwaggerUiOptions } from '@fastify/swagger-ui';

/**
 * Swagger/OpenAPI configuration for MSQ Pay Server
 *
 * Best Practices Applied:
 * - Comprehensive API description with markdown
 * - Multiple server environments
 * - Proper security schemes
 * - Reusable component schemas
 * - External documentation links
 * - Consistent error response format
 */
export const swaggerConfig: FastifyDynamicSwaggerOptions = {
  openapi: {
    info: {
      title: 'MSQ Pay Server API',
      description: `
## Overview
MSQ Pay Server provides a comprehensive payment API for blockchain-based transactions with support for gasless (meta-transaction) payments.

## Features
- **Payment Creation**: Create payment requests for merchants
- **Gasless Transactions**: Submit meta-transactions via ERC-2771 forwarder (users don't need ETH for gas)
- **Token Operations**: Check ERC20 balances and allowances
- **Transaction Status**: Track payment and relay status in real-time

## Authentication
All merchant API requests require an API key passed in the \`X-API-Key\` header.

\`\`\`
X-API-Key: your-api-key-here
\`\`\`

## Error Handling
All errors follow a consistent format:
\`\`\`json
{
  "code": "ERROR_CODE",
  "message": "Human readable message",
  "details": {}
}
\`\`\`

## Supported Networks
| Network | Chain ID | Type |
|---------|----------|------|
| Localhost | 31337 | Testnet |
| Polygon Amoy | 80002 | Testnet |
      `,
      version: '0.1.0',
    },
    servers: [
      {
        url: 'http://localhost:3001',
        description: 'Local Development',
      },
    ],
    tags: [
      {
        name: 'Merchants',
        description: 'Merchant profile and payment method management.',
      },
      {
        name: 'Chains',
        description: 'Supported blockchain networks and tokens.',
      },
      {
        name: 'Tokens',
        description: 'Check token balance and allowance before payment.',
      },
      {
        name: 'Payments',
        description:
          'Create payment requests, submit gasless transactions (meta-transaction), check status, and view history.',
      },
      {
        name: 'Transactions',
        description: 'Check blockchain transaction status.',
      },
    ],
    components: {
      securitySchemes: {
        ApiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key',
          description: 'Merchant API key for authentication.',
        },
      },
      schemas: {
        // Standard error response - used across all endpoints
        ErrorResponse: {
          type: 'object',
          description: 'Standard error response format',
          properties: {
            code: {
              type: 'string',
              description: 'Machine-readable error code',
              example: 'INVALID_REQUEST',
            },
            message: {
              type: 'string',
              description: 'Human-readable error message',
              example: 'The request body is invalid',
            },
            details: {
              type: 'object',
              additionalProperties: true,
              description: 'Additional error context (validation errors, etc.)',
            },
          },
          required: ['code', 'message'],
        },
        // Ethereum address format
        EthereumAddress: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{40}$',
          example: '0x1234567890abcdef1234567890abcdef12345678',
          description: 'Ethereum address (0x + 40 hex characters)',
        },
        // Payment hash / ID format
        PaymentHash: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{64}$',
          example: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
          description: 'Unique payment identifier (bytes32 hash)',
        },
        // Transaction hash format
        TransactionHash: {
          type: 'string',
          pattern: '^0x[a-fA-F0-9]{64}$',
          example: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
          description: 'Blockchain transaction hash',
        },
      },
    },
  },
};

/**
 * Swagger UI configuration
 */
export const swaggerUiConfig: FastifySwaggerUiOptions = {
  routePrefix: '/api-docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
    displayRequestDuration: true,
    filter: true,
    showExtensions: true,
    showCommonExtensions: true,
    syntaxHighlight: {
      activate: true,
      theme: 'monokai',
    },
  },
  staticCSP: false,
};
