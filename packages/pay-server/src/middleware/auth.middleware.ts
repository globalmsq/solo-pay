import { FastifyRequest, FastifyReply } from 'fastify';
import { Merchant } from '@prisma/client';
import { MerchantService } from '../services/merchant.service';
import { PaymentService } from '../services/payment.service';

declare module 'fastify' {
  interface FastifyRequest {
    merchant?: Merchant;
  }
}

/**
 * Base authentication middleware - validates X-API-Key header
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
        message: 'Missing or invalid X-API-Key header',
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
      return reply.code(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Authentication failed',
      });
    }
  };
}

/**
 * Merchant auth middleware for /payments/create
 * Validates that body.merchantId matches the authenticated merchant's merchant_key
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
    if (!merchant) return; // TypeScript guard - should never happen

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
    if (!merchant) return; // TypeScript guard - should never happen

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
