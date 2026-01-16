import { FastifyInstance } from 'fastify';
import { MerchantService } from '../../services/merchant.service';
import { PaymentMethodService } from '../../services/payment-method.service';
import { TokenService } from '../../services/token.service';
import { ChainService } from '../../services/chain.service';
import { createAuthMiddleware } from '../../middleware/auth.middleware';

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

        // Get payment methods for this merchant
        const paymentMethods = await paymentMethodService.findAllForMerchant(merchant.id);

        // Enrich payment methods with token and chain information using optimized bulk queries
        const validPaymentMethods = await paymentMethodService.enrichPaymentMethods(
          paymentMethods,
          tokenService,
          chainService
        );

        // Return merchant information with payment methods
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
