import { FastifyInstance } from 'fastify';
import { MerchantService } from '../../services/merchant.service';
import { createMerchantAuthMiddleware } from '../../middleware/auth.middleware';
import { ErrorResponseSchema } from '../../docs/schemas';

const CreatePublicKeyBodySchema = {
  type: 'object',
  properties: {
    allowedDomains: {
      type: 'array',
      items: { type: 'string', format: 'uri' },
      description: 'Domains allowed for x-public-key (e.g. https://checkout.example.com). Required for client-side integration.',
    },
  },
};

export async function merchantPublicKeyRoute(
  app: FastifyInstance,
  merchantService: MerchantService
) {
  const authMiddleware = createMerchantAuthMiddleware(merchantService);

  /**
   * POST /merchants/me/public-key
   * Generate a new public key for client-side integration (widget).
   * Optionally set allowed_domains. Overwrites existing public key if present.
   */
  app.post<{
    Body: { allowedDomains?: string[] };
  }>(
    '/merchants/me/public-key',
    {
      schema: {
        operationId: 'createMerchantPublicKey',
        tags: ['Merchants'],
        summary: 'Generate public key for client-side integration',
        description: `
Generates a new public key (pk_live_xxx) for use in the payment widget.
Call with API Key auth. Optionally pass allowedDomains (origins that may use this key).
Overwrites any existing public key. Store the returned publicKey securely; it is shown only once.
        `,
        security: [{ ApiKeyAuth: [] }],
        body: CreatePublicKeyBodySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              publicKey: { type: 'string', description: 'Use in x-public-key header (pk_live_xxx)' },
              allowedDomains: {
                type: 'array',
                items: { type: 'string' },
                description: 'Domains allowed for this key',
              },
            },
          },
          400: ErrorResponseSchema,
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

        const body = request.body as { allowedDomains?: string[] };
        const allowedDomains = Array.isArray(body?.allowedDomains) ? body.allowedDomains : undefined;

        const publicKey = await merchantService.generatePublicKey(merchant.id);
        if (allowedDomains && allowedDomains.length > 0) {
          await merchantService.updateAllowedDomains(merchant.id, allowedDomains);
        }

        const updated = await merchantService.findById(merchant.id);
        const domains = (updated?.allowed_domains as string[] | null) ?? (allowedDomains ?? []);

        return reply.code(200).send({
          success: true,
          publicKey,
          allowedDomains: domains,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to generate public key';
        request.log.error(error, 'Failed to generate public key');
        return reply.code(500).send({
          code: 'INTERNAL_ERROR',
          message,
        });
      }
    }
  );
}
