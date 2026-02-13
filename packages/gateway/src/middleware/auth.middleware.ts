import { FastifyRequest, FastifyReply } from 'fastify';
import { Merchant } from '@solo-pay/database';
import { MerchantService } from '../services/merchant.service';

declare module 'fastify' {
  interface FastifyRequest {
    merchant?: Merchant;
  }
}

/**
 * Base authentication middleware - validates x-api-key header
 * and attaches merchant to request if valid
 */
export function createAuthMiddleware(merchantService: MerchantService) {
  return async function authMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const apiKey = request.headers['x-api-key'] as string | undefined;

    if (!apiKey || apiKey.trim() === '') {
      return reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid x-api-key header',
      });
    }

    try {
      const merchant = await merchantService.findByApiKey(apiKey);

      if (!merchant) {
        return reply.code(401).send({
          code: 'UNAUTHORIZED',
          message: 'Invalid API key',
        });
      }

      request.merchant = merchant;
    } catch (error) {
      request.log.error(error, 'Authentication failed due to an internal error');
      return reply.code(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Authentication failed',
      });
    }
  };
}
