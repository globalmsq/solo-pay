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

        // Enrich payment methods with token and chain information
        const enrichedPaymentMethods = await Promise.all(
          paymentMethods.map(async (pm) => {
            const token = await tokenService.findById(pm.token_id);
            if (!token) {
              return null;
            }

            const chain = await chainService.findById(token.chain_id);
            if (!chain) {
              return null;
            }

            return {
              id: pm.id,
              recipient_address: pm.recipient_address,
              is_enabled: pm.is_enabled,
              created_at: pm.created_at.toISOString(),
              updated_at: pm.updated_at.toISOString(),
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
            };
          })
        );

        // Filter out null values (in case token or chain was not found)
        const validPaymentMethods = enrichedPaymentMethods.filter((pm) => pm !== null);

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
