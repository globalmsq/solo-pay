import { FastifyInstance } from 'fastify';
import { MerchantService } from '../../services/merchant.service';
import { PaymentMethodService } from '../../services/payment-method.service';
import { TokenService } from '../../services/token.service';
import { ChainService } from '../../services/chain.service';
import { createAuthMiddleware } from '../../middleware/auth.middleware';
import { ErrorResponseSchema } from '../../docs/schemas';

export async function getMerchantRoute(
  app: FastifyInstance,
  merchantService: MerchantService,
  paymentMethodService: PaymentMethodService,
  tokenService: TokenService,
  chainService: ChainService
) {
  // Auth middleware validates X-API-Key header and attaches merchant to request
  const authMiddleware = createAuthMiddleware(merchantService);

  app.get(
    '/merchants/me',
    {
      schema: {
        operationId: 'getCurrentMerchant',
        tags: ['Merchants'],
        summary: 'Get current merchant info',
        description:
          'Returns information about the authenticated merchant including payment methods',
        security: [{ ApiKeyAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              merchant: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  merchant_key: { type: 'string' },
                  name: { type: 'string' },
                  chain_id: { type: 'integer', nullable: true },
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
                  webhook_url: { type: 'string', nullable: true },
                  is_enabled: { type: 'boolean' },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' },
                  payment_methods: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer' },
                        recipient_address: { type: 'string' },
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
        // Merchant is guaranteed to exist after auth middleware
        const merchant = request.merchant;
        if (!merchant) {
          return reply.code(500).send({
            code: 'INTERNAL_ERROR',
            message: 'Authentication context is missing',
          });
        }

        // Get payment methods for this merchant
        const paymentMethods = await paymentMethodService.findAllForMerchant(merchant.id);

        // Enrich payment methods with token and chain information using optimized bulk queries
        const validPaymentMethods = await paymentMethodService.enrichPaymentMethods(
          paymentMethods,
          tokenService,
          chainService
        );

        // Get chain information for merchant
        const chain = merchant.chain_id ? await chainService.findById(merchant.chain_id) : null;

        // Return merchant information with payment methods
        return reply.code(200).send({
          success: true,
          merchant: {
            id: merchant.id,
            merchant_key: merchant.merchant_key,
            name: merchant.name,
            chain_id: merchant.chain_id,
            chain: chain
              ? {
                  id: chain.id,
                  network_id: chain.network_id,
                  name: chain.name,
                  is_testnet: chain.is_testnet,
                }
              : null,
            webhook_url: merchant.webhook_url,
            is_enabled: merchant.is_enabled,
            created_at: merchant.created_at.toISOString(),
            updated_at: merchant.updated_at.toISOString(),
            payment_methods: validPaymentMethods,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get merchant';
        request.log.error(error, 'Failed to get merchant');
        return reply.code(500).send({
          code: 'INTERNAL_ERROR',
          message,
        });
      }
    }
  );
}
