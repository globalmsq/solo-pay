import { FastifyInstance } from 'fastify';
import { MerchantService } from '../../services/merchant.service';
import { createAuthMiddleware } from '../../middleware/auth.middleware';
import { UpdateMerchantRequest, UpdateMerchantSchema } from '../../schemas/merchant.schema';
import { ZodError } from 'zod';
import { ErrorResponseSchema } from '../../docs/schemas';

export async function updateMerchantRoute(app: FastifyInstance, merchantService: MerchantService) {
  // Auth middleware validates X-API-Key header and attaches merchant to request
  const authMiddleware = createAuthMiddleware(merchantService);

  app.patch<{ Body: UpdateMerchantRequest }>(
    '/merchants/me',
    {
      schema: {
        operationId: 'updateCurrentMerchant',
        tags: ['Merchants'],
        summary: 'Update current merchant',
        description: 'Updates the authenticated merchant information',
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Merchant display name' },
            webhook_url: {
              type: 'string',
              format: 'uri',
              description: 'Webhook URL for payment notifications',
            },
          },
        },
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
                  webhook_url: { type: 'string', nullable: true },
                  is_enabled: { type: 'boolean' },
                  created_at: { type: 'string', format: 'date-time' },
                  updated_at: { type: 'string', format: 'date-time' },
                },
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
