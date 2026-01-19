import { FastifyInstance } from 'fastify';
import { MerchantService } from '../../services/merchant.service';
import { createAuthMiddleware } from '../../middleware/auth.middleware';
import { UpdateMerchantRequest, UpdateMerchantSchema } from '../../schemas/merchant.schema';
import { ZodError } from 'zod';

export async function updateMerchantRoute(app: FastifyInstance, merchantService: MerchantService) {
  // Auth middleware validates X-API-Key header and attaches merchant to request
  const authMiddleware = createAuthMiddleware(merchantService);

  app.patch<{ Body: UpdateMerchantRequest }>(
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

        // Validate input
        const validatedData = UpdateMerchantSchema.parse(request.body);

        // Check if there's anything to update
        if (Object.keys(validatedData).length === 0) {
          return reply.code(400).send({
            code: 'VALIDATION_ERROR',
            message: 'At least one field must be provided for update',
          });
        }

        // Update merchant
        const updatedMerchant = await merchantService.update(merchant.id, validatedData);

        // Return updated merchant (excluding sensitive data)
        return reply.code(200).send({
          success: true,
          merchant: {
            id: updatedMerchant.id,
            merchant_key: updatedMerchant.merchant_key,
            name: updatedMerchant.name,
            chain_id: updatedMerchant.chain_id,
            webhook_url: updatedMerchant.webhook_url,
            is_enabled: updatedMerchant.is_enabled,
            created_at: updatedMerchant.created_at.toISOString(),
            updated_at: updatedMerchant.updated_at.toISOString(),
          },
        });
      } catch (error) {
        if (error instanceof ZodError) {
          return reply.code(400).send({
            code: 'VALIDATION_ERROR',
            message: 'Input validation failed',
            details: error.errors,
          });
        }
        const message = error instanceof Error ? error.message : 'Failed to update merchant';
        request.log.error(error, 'Failed to update merchant');
        return reply.code(500).send({
          code: 'INTERNAL_ERROR',
          message,
        });
      }
    }
  );
}
