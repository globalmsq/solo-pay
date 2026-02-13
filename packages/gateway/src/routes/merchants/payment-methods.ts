import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { MerchantPaymentMethod } from '@solo-pay/database';
import { MerchantService } from '../../services/merchant.service';
import { PaymentMethodService } from '../../services/payment-method.service';
import { TokenService } from '../../services/token.service';
import { ChainService } from '../../services/chain.service';
import { createAuthMiddleware } from '../../middleware/auth.middleware';
import { ErrorResponseSchema } from '../../docs/schemas';

// Note: recipientAddress removed - contract pays to treasury (set at deployment)
const CreatePaymentMethodSchema = z.object({
  tokenAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address format'),
  is_enabled: z.boolean().optional().default(true),
});

const UpdatePaymentMethodSchema = z
  .object({
    is_enabled: z.boolean().optional(),
  })
  .strict(); // Reject unknown keys (e.g. merchant_key); this endpoint updates payment method only

export async function paymentMethodsRoute(
  app: FastifyInstance,
  merchantService: MerchantService,
  paymentMethodService: PaymentMethodService,
  tokenService: TokenService,
  chainService: ChainService
) {
  const authMiddleware = createAuthMiddleware(merchantService);

  // GET /merchant/payment-method - List all payment methods
  app.get(
    '/merchant/payment-method',
    {
      schema: {
        operationId: 'listPaymentMethods',
        tags: ['Merchant'],
        summary: 'List payment methods',
        description: 'Returns all payment methods configured for the authenticated merchant',
        security: [{ ApiKeyAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              payment_methods: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    is_enabled: { type: 'boolean' },
                    created_at: { type: 'string', format: 'date-time' },
                    updated_at: { type: 'string', format: 'date-time' },
                    token: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        address: { type: 'string' },
                        symbol: { type: 'string' },
                        decimals: { type: 'integer' },
                        chain_id: { type: 'integer' },
                      },
                    },
                    chain: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        network_id: { type: 'integer' },
                        name: { type: 'string' },
                        is_testnet: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
            },
          },
          401: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
      preHandler: authMiddleware,
    },
    async (request, reply) => {
      try {
        const merchant = request.merchant;
        if (!merchant) {
          return reply.code(500).send({
            code: 'INTERNAL_ERROR',
            message: 'Authentication context is missing',
          });
        }

        const paymentMethods = await paymentMethodService.findAllForMerchant(merchant.id);

        // Enrich with token and chain information using optimized bulk queries
        const validPaymentMethods = await paymentMethodService.enrichPaymentMethods(
          paymentMethods,
          tokenService,
          chainService
        );

        return reply.code(200).send({
          success: true,
          payment_methods: validPaymentMethods,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get payment methods';
        request.log.error(error, 'Failed to get payment methods');
        return reply.code(500).send({
          code: 'INTERNAL_ERROR',
          message,
        });
      }
    }
  );

  // POST /merchant/payment-method - Create payment method
  app.post<{ Body: z.infer<typeof CreatePaymentMethodSchema> }>(
    '/merchant/payment-method',
    {
      schema: {
        operationId: 'createPaymentMethod',
        tags: ['Merchant'],
        summary: 'Create payment method',
        description: 'Creates a new payment method for the authenticated merchant',
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          properties: {
            tokenAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'ERC20 token address',
            },
            is_enabled: { type: 'boolean', default: true },
          },
          required: ['tokenAddress'],
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              payment_method: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  is_enabled: { type: 'boolean' },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' },
                  token: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer' },
                      address: { type: 'string' },
                      symbol: { type: 'string' },
                      decimals: { type: 'integer' },
                      chain_id: { type: 'integer' },
                    },
                  },
                  chain: {
                    type: 'object',
                    properties: {
                      id: { type: 'integer' },
                      network_id: { type: 'integer' },
                      name: { type: 'string' },
                      is_testnet: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
      preHandler: authMiddleware,
    },
    async (request, reply) => {
      try {
        const merchant = request.merchant;
        if (!merchant) {
          return reply.code(500).send({
            code: 'INTERNAL_ERROR',
            message: 'Authentication context is missing',
          });
        }

        const validatedData = CreatePaymentMethodSchema.parse(request.body);

        // Validate merchant has chain configured
        if (!merchant.chain_id) {
          return reply.code(400).send({
            code: 'MERCHANT_CHAIN_NOT_CONFIGURED',
            message: 'Merchant chain is not configured. Please configure merchant chain first.',
          });
        }

        // Get merchant's chain
        const chain = await chainService.findById(merchant.chain_id);
        if (!chain) {
          return reply.code(404).send({
            code: 'CHAIN_NOT_FOUND',
            message: 'Merchant chain not found',
          });
        }

        // Find token by merchant's chain_id and address
        const token = await tokenService.findByAddress(chain.id, validatedData.tokenAddress);
        if (!token) {
          return reply.code(404).send({
            code: 'TOKEN_NOT_FOUND',
            message: 'Token not found',
          });
        }

        // Validate that token's chain matches merchant's chain
        if (token.chain_id !== merchant.chain_id) {
          return reply.code(400).send({
            code: 'CHAIN_MISMATCH',
            message: `Token belongs to chain ${token.chain_id}, but merchant is configured for chain ${merchant.chain_id}`,
          });
        }

        // Check if payment method already exists (including soft-deleted ones)
        const existing = await paymentMethodService.findByMerchantAndTokenIncludingDeleted(
          merchant.id,
          token.id
        );

        let paymentMethod: MerchantPaymentMethod;

        if (existing) {
          if (existing.is_deleted) {
            // Restore soft-deleted payment method with updated values
            paymentMethod = await paymentMethodService.restore(existing.id, {
              is_enabled: validatedData.is_enabled, // Schema default is true
            });
          } else {
            // Active payment method already exists
            return reply.code(409).send({
              code: 'PAYMENT_METHOD_EXISTS',
              message: 'Payment method already exists for this token',
            });
          }
        } else {
          // Create new payment method
          paymentMethod = await paymentMethodService.create({
            merchant_id: merchant.id,
            token_id: token.id,
            is_enabled: validatedData.is_enabled, // Schema default is true
          });
        }

        // Return enriched payment method
        return reply.code(201).send({
          success: true,
          payment_method: {
            id: paymentMethod.id,
            is_enabled: paymentMethod.is_enabled,
            created_at: paymentMethod.created_at.toISOString(),
            updated_at: paymentMethod.updated_at.toISOString(),
            token: {
              id: token.id,
              address: token.address,
              symbol: token.symbol,
              decimals: token.decimals,
              chain_id: token.chain_id,
            },
            chain: {
              id: chain.id,
              network_id: chain.network_id,
              name: chain.name,
              is_testnet: chain.is_testnet,
            },
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            code: 'VALIDATION_ERROR',
            message: 'Input validation failed',
            details: error.errors,
          });
        }
        const message = error instanceof Error ? error.message : 'Failed to create payment method';
        request.log.error(error, 'Failed to create payment method');
        return reply.code(500).send({
          code: 'INTERNAL_ERROR',
          message,
        });
      }
    }
  );

  // PATCH /merchant/payment-method/:id - Update payment method
  app.patch<{ Params: { id: string }; Body: z.infer<typeof UpdatePaymentMethodSchema> }>(
    '/merchant/payment-method/:id',
    {
      schema: {
        operationId: 'updatePaymentMethod',
        tags: ['Merchant'],
        summary: 'Update payment method',
        description: 'Updates an existing payment method',
        security: [{ ApiKeyAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Payment method ID' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            is_enabled: { type: 'boolean' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              payment_method: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  is_enabled: { type: 'boolean' },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' },
                  token: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      id: { type: 'integer' },
                      address: { type: 'string' },
                      symbol: { type: 'string' },
                      decimals: { type: 'integer' },
                      chain_id: { type: 'integer' },
                    },
                  },
                  chain: {
                    type: 'object',
                    nullable: true,
                    properties: {
                      id: { type: 'integer' },
                      network_id: { type: 'integer' },
                      name: { type: 'string' },
                      is_testnet: { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
          400: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
      preHandler: authMiddleware,
    },
    async (request, reply) => {
      try {
        const merchant = request.merchant;
        if (!merchant) {
          return reply.code(500).send({
            code: 'INTERNAL_ERROR',
            message: 'Authentication context is missing',
          });
        }

        const paymentMethodId = parseInt(request.params.id, 10);
        if (isNaN(paymentMethodId)) {
          return reply.code(400).send({
            code: 'INVALID_REQUEST',
            message: 'Invalid payment method ID',
          });
        }

        // Get payment method and verify ownership
        const paymentMethod = await paymentMethodService.findById(paymentMethodId);
        if (!paymentMethod) {
          return reply.code(404).send({
            code: 'NOT_FOUND',
            message: 'Payment method not found',
          });
        }

        if (paymentMethod.merchant_id !== merchant.id) {
          return reply.code(403).send({
            code: 'FORBIDDEN',
            message: 'Payment method does not belong to this merchant',
          });
        }

        const validatedData = UpdatePaymentMethodSchema.parse(request.body);

        if (Object.keys(validatedData).length === 0) {
          return reply.code(400).send({
            code: 'VALIDATION_ERROR',
            message: 'At least one field must be provided for update',
          });
        }

        // Transform for service
        const updateData: {
          is_enabled?: boolean;
        } = {};

        if (validatedData.is_enabled !== undefined) {
          updateData.is_enabled = validatedData.is_enabled;
        }

        // Update payment method
        const updated = await paymentMethodService.update(paymentMethodId, updateData);

        // Get token and chain for response
        const token = await tokenService.findById(updated.token_id);
        const chain = token ? await chainService.findById(token.chain_id) : null;

        return reply.code(200).send({
          success: true,
          payment_method: {
            id: updated.id,
            is_enabled: updated.is_enabled,
            created_at: updated.created_at.toISOString(),
            updated_at: updated.updated_at.toISOString(),
            token: token
              ? {
                  id: token.id,
                  address: token.address,
                  symbol: token.symbol,
                  decimals: token.decimals,
                  chain_id: token.chain_id,
                }
              : null,
            chain: chain
              ? {
                  id: chain.id,
                  network_id: chain.network_id,
                  name: chain.name,
                  is_testnet: chain.is_testnet,
                }
              : null,
          },
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          return reply.code(400).send({
            code: 'VALIDATION_ERROR',
            message: 'Input validation failed',
            details: error.errors,
          });
        }
        const message = error instanceof Error ? error.message : 'Failed to update payment method';
        request.log.error(error, 'Failed to update payment method');
        return reply.code(500).send({
          code: 'INTERNAL_ERROR',
          message,
        });
      }
    }
  );

  // DELETE /merchant/payment-method/:id - Delete payment method
  app.delete<{ Params: { id: string } }>(
    '/merchant/payment-method/:id',
    {
      schema: {
        operationId: 'deletePaymentMethod',
        tags: ['Merchant'],
        summary: 'Delete payment method',
        description: 'Soft-deletes a payment method',
        security: [{ ApiKeyAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Payment method ID' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              message: { type: 'string' },
            },
          },
          400: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
      preHandler: authMiddleware,
    },
    async (request, reply) => {
      try {
        const merchant = request.merchant;
        if (!merchant) {
          return reply.code(500).send({
            code: 'INTERNAL_ERROR',
            message: 'Authentication context is missing',
          });
        }

        const paymentMethodId = parseInt(request.params.id, 10);
        if (isNaN(paymentMethodId)) {
          return reply.code(400).send({
            code: 'INVALID_REQUEST',
            message: 'Invalid payment method ID',
          });
        }

        // Get payment method and verify ownership
        const paymentMethod = await paymentMethodService.findById(paymentMethodId);
        if (!paymentMethod) {
          return reply.code(404).send({
            code: 'NOT_FOUND',
            message: 'Payment method not found',
          });
        }

        if (paymentMethod.merchant_id !== merchant.id) {
          return reply.code(403).send({
            code: 'FORBIDDEN',
            message: 'Payment method does not belong to this merchant',
          });
        }

        // Soft delete payment method
        await paymentMethodService.softDelete(paymentMethodId);

        return reply.code(200).send({
          success: true,
          message: 'Payment method deleted successfully',
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to delete payment method';
        request.log.error(error, 'Failed to delete payment method');
        return reply.code(500).send({
          code: 'INTERNAL_ERROR',
          message,
        });
      }
    }
  );
}
