import type { FastifyRequest, FastifyReply } from 'fastify';
import crypto from 'crypto';
import type { PrismaClient } from '@solo-pay/database';

export interface Merchant {
  id: number;
  merchant_key: string;
  name: string;
  chain_id: number;
  public_key: string | null;
  public_key_hash: string | null;
  allowed_domains: unknown;
  is_enabled: boolean;
  is_deleted: boolean;
}

declare module 'fastify' {
  interface FastifyRequest {
    merchant?: Merchant;
  }
}

function hashPublicKey(publicKey: string): string {
  return crypto.createHash('sha256').update(publicKey).digest('hex');
}

export function createPublicAuthMiddleware(prisma: PrismaClient) {
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
      const publicKeyHash = hashPublicKey(publicKey);
      const merchant = await prisma.merchant.findFirst({
        where: {
          public_key_hash: publicKeyHash,
          is_deleted: false,
          is_enabled: true,
        },
      });

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

      (request as FastifyRequest & { merchant: Merchant }).merchant = merchant as Merchant;
    } catch (error) {
      request.log.error(error, 'Public key authentication failed');
      return reply.code(500).send({
        code: 'INTERNAL_ERROR',
        message: 'Authentication failed',
      });
    }
  };
}
