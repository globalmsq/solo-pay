import { FastifyInstance } from 'fastify';
import { MerchantService } from '../../services/merchant.service';
import { createAuthMiddleware } from '../../middleware/auth.middleware';

export async function getMerchantRoute(
  app: FastifyInstance,
  merchantService: MerchantService
) {
  // Auth middleware validates X-API-Key header and attaches merchant to request
  const authMiddleware = createAuthMiddleware(merchantService);

  app.get(
    '/merchants/me',
    { preHandler: authMiddleware },
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

        // Return merchant information (excluding sensitive data like api_key_hash)
        return reply.code(200).send({
          success: true,
          merchant: {
            id: merchant.id,
            merchant_key: merchant.merchant_key,
            name: merchant.name,
            webhook_url: merchant.webhook_url,
            is_enabled: merchant.is_enabled,
            created_at: merchant.created_at.toISOString(),
            updated_at: merchant.updated_at.toISOString(),
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
