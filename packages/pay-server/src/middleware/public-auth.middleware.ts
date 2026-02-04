import { FastifyRequest, FastifyReply } from 'fastify';
import { Merchant } from '@prisma/client';
import { MerchantService } from '../services/merchant.service';

declare module 'fastify' {
  interface FastifyRequest {
    merchant?: Merchant;
  }
}

/**
 * Public Key authentication middleware for client-side integration.
 * Validates x-public-key header, resolves merchant by public key hash,
 * and ensures Origin header is in merchant.allowed_domains.
 * Sets request.merchant on success; returns 401 for invalid/missing key, 403 for origin mismatch.
 */
export function createPublicAuthMiddleware(merchantService: MerchantService) {
  return async function publicAuthMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    const publicKey = request.headers['x-public-key'] as string | undefined;

    if (!publicKey || publicKey.trim() === '') {
      return reply.code(401).send({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid x-public-key header',
      });
    }

    try {
      const merchant = await merchantService.findByPublicKey(publicKey);

      if (!merchant) {
        return reply.code(401).send({
          code: 'UNAUTHORIZED',
          message: 'Invalid public key',
        });
      }

      const allowedDomains = (merchant.allowed_domains as string[] | null) ?? [];
      if (allowedDomains.length === 0) {
        return reply.code(403).send({
          code: 'FORBIDDEN',
          message: 'No allowed domains configured for this public key',
        });
      }

      const origin = request.headers['origin'] as string | undefined;
      if (!origin || !allowedDomains.includes(origin)) {
        return reply.code(403).send({
          code: 'FORBIDDEN',
          message: 'Origin not allowed for this public key',
        });
      }

      request.merchant = merchant;
    } catch (error) {
      request.log.error(error, 'Public key authentication failed due to an internal error');
      return reply.code(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Authentication failed',
      });
    }
  };
}
