import { FastifyRequest, FastifyReply } from 'fastify';
import { Merchant } from '@prisma/client';
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

/**
 * Merchant auth middleware for routes that accept merchantId in body.
 * Ensures same merchant key and API: body.merchantId must match the merchant bound to x-api-key.
 * Used by: routes that accept body.merchantId (e.g. refunds).
 */
export function createMerchantAuthMiddleware(merchantService: MerchantService) {
  const baseAuth = createAuthMiddleware(merchantService);

  return async function merchantAuthMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Step 1: Base authentication
    await baseAuth(request, reply);
    if (reply.sent) return;

    // Step 2: Validate merchant ownership
    // Note: request.merchant is guaranteed to exist after baseAuth succeeds
    const merchant = request.merchant;
    if (!merchant) {
      // This should not be reached if baseAuth is functioning correctly
      request.log.error(
        'Merchant object not found on request after base authentication in merchantAuthMiddleware'
      );
      return reply.code(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Authentication context is missing',
      });
    }

    const body = request.body as { merchantId?: string };
    if (body?.merchantId && body.merchantId !== merchant.merchant_key) {
      return reply.code(403).send({
        code: 'FORBIDDEN',
        message: 'API key does not match the requested merchant',
      });
    }
  };
}

/**
 * Payment auth middleware for /payments/:id/gasless and /payments/:id/relay
 * Validates that the payment belongs to the authenticated merchant
 */
export function createPaymentAuthMiddleware(
  merchantService: MerchantService,
  paymentService: PaymentService
) {
  const baseAuth = createAuthMiddleware(merchantService);

  return async function paymentAuthMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Step 1: Base authentication
    await baseAuth(request, reply);
    if (reply.sent) return;

    // Step 2: Validate payment ownership
    // Note: request.merchant is guaranteed to exist after baseAuth succeeds
    const merchant = request.merchant;
    if (!merchant) {
      // This should not be reached if baseAuth is functioning correctly
      request.log.error(
        'Merchant object not found on request after base authentication in paymentAuthMiddleware'
      );
      return reply.code(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Authentication context is missing',
      });
    }

    const params = request.params as { id?: string };
    if (params?.id) {
      const payment = await paymentService.findByHash(params.id);
      if (payment && payment.merchant_id !== merchant.id) {
        return reply.code(403).send({
          code: 'FORBIDDEN',
          message: 'Payment does not belong to this merchant',
        });
      }
    }
  };
}
