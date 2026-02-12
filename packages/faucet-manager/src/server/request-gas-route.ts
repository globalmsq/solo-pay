import type { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { z } from 'zod';
import { requestGas } from '../faucet.service';
import { RequestGasError } from '../types';
import type { GasFaucetPorts } from '../ports';
import type { PrismaClient } from '@prisma/client';

const RequestGasBodySchema = z.object({
  paymentId: z.string().min(1),
  walletAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
});

interface BlockchainServiceLike {
  isChainSupported: (chainId: number) => boolean;
  getChainConfig: (chainId: number) => { gatewayAddress: string };
  getTokenBalance: (chainId: number, tokenAddress: string, address: string) => Promise<string>;
  getNativeBalance: (chainId: number, address: string) => Promise<bigint>;
  getGasPrice: (chainId: number) => Promise<bigint>;
}

export async function registerRequestGasRoute(
  app: FastifyInstance,
  prisma: PrismaClient,
  blockchainService: BlockchainServiceLike,
  sendNative: (chainId: number, toAddress: string, amountWei: bigint) => Promise<string>
): Promise<void> {
  app.post<{ Body: z.infer<typeof RequestGasBodySchema> }>(
    '/payments/request-gas',
    {
      schema: {
        operationId: 'requestGas',
        tags: ['Payments'],
        summary: 'Request one-time gas grant (faucet)',
        description:
          'Sends native token to wallet for approve gas. Requires x-public-key and Origin. Conditions: payment exists, token balance >= amount, native balance < approve cost, no prior grant for (wallet, chain).',
        headers: {
          type: 'object',
          required: ['x-public-key', 'origin'],
          properties: {
            'x-public-key': { type: 'string', description: 'Merchant public key (pk_live_xxx)' },
            origin: {
              type: 'string',
              description: 'Request origin (must be in merchant allowed_domains)',
            },
          },
        },
        body: {
          type: 'object',
          required: ['paymentId', 'walletAddress'],
          properties: {
            paymentId: { type: 'string', description: 'Payment hash' },
            walletAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Wallet address (0x + 40 hex)',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              txHash: { type: 'string' },
              amount: { type: 'string', description: 'Wei (string)' },
              chainId: { type: 'number' },
            },
          },
          400: {
            type: 'object',
            properties: { code: { type: 'string' }, message: { type: 'string' }, details: {} },
          },
          403: {
            type: 'object',
            properties: { code: { type: 'string' }, message: { type: 'string' } },
          },
          404: {
            type: 'object',
            properties: { code: { type: 'string' }, message: { type: 'string' } },
          },
          500: {
            type: 'object',
            properties: { code: { type: 'string' }, message: { type: 'string' } },
          },
        },
      } as Record<string, unknown>,
    },
    async (request, reply) => {
      try {
        const validated = RequestGasBodySchema.parse(request.body);
        const merchant = (request as { merchant?: { id: number } }).merchant;
        if (!merchant) {
          return reply.code(403).send({ code: 'UNAUTHORIZED', message: 'Merchant required' });
        }

        const getPaymentInfo: GasFaucetPorts['getPaymentInfo'] = async (paymentId: string) => {
          const payment = await prisma.payment.findUnique({
            where: { payment_hash: paymentId },
          });
          if (!payment || payment.merchant_id !== merchant.id) return null;

          const pm = await prisma.merchantPaymentMethod.findFirst({
            where: { id: payment.payment_method_id, is_deleted: false },
          });
          if (!pm) return null;

          const token = await prisma.token.findFirst({
            where: { id: pm.token_id, is_deleted: false },
          });
          if (!token) return null;

          if (!blockchainService.isChainSupported(payment.network_id)) return null;
          const config = blockchainService.getChainConfig(payment.network_id);

          return {
            paymentId: payment.payment_hash,
            networkId: payment.network_id,
            amountWei: BigInt(payment.amount.toString()),
            tokenAddress: token.address,
            gatewayAddress: config.gatewayAddress,
          };
        };

        const findWalletGasGrant = async (
          walletAddress: string,
          chainId: number
        ): Promise<{ id: number } | null> => {
          const row = await prisma.walletGasGrant.findUnique({
            where: {
              wallet_address_chain_id: {
                wallet_address: walletAddress.toLowerCase(),
                chain_id: chainId,
              },
            },
            select: { id: true },
          });
          return row;
        };

        const createWalletGasGrant = async (params: {
          walletAddress: string;
          chainId: number;
          amount: string;
          txHash: string | null;
        }): Promise<void> => {
          await prisma.walletGasGrant.create({
            data: {
              wallet_address: params.walletAddress.toLowerCase(),
              chain_id: params.chainId,
              amount: params.amount,
              tx_hash: params.txHash,
            },
          });
        };

        const ports: GasFaucetPorts = {
          getPaymentInfo,
          findWalletGasGrant,
          getTokenBalance: (chainId, tokenAddress, address) =>
            blockchainService.getTokenBalance(chainId, tokenAddress, address).then(BigInt),
          getNativeBalance: (chainId, address) =>
            blockchainService.getNativeBalance(chainId, address),
          getGasPrice: (chainId) => blockchainService.getGasPrice(chainId),
          sendNative,
          createWalletGasGrant,
        };

        const result = await requestGas(ports, {
          paymentId: validated.paymentId,
          walletAddress: validated.walletAddress,
        });

        return reply.code(200).send(result);
      } catch (err: unknown) {
        if (err instanceof RequestGasError) {
          const code = err.code === 'PAYMENT_NOT_FOUND' ? 'NOT_FOUND' : err.code;
          const status = err.code === 'PAYMENT_NOT_FOUND' ? 404 : 400;
          return reply.code(status).send({ code, message: err.message });
        }
        if (err instanceof ZodError) {
          return reply.code(400).send({
            code: 'VALIDATION_ERROR',
            message: 'Input validation failed',
            details: err.errors,
          });
        }
        const message = err instanceof Error ? err.message : 'Request gas failed';
        return reply.code(500).send({ code: 'INTERNAL_ERROR', message });
      }
    }
  );
}
