import { FastifyInstance } from 'fastify';
import { ZodError } from 'zod';
import { PrepareWalletSchema } from '../../schemas/payment.schema';
import { BlockchainService } from '../../services/blockchain.service';
import { PaymentService } from '../../services/payment.service';
import { PaymentMethodService } from '../../services/payment-method.service';
import { TokenService } from '../../services/token.service';
import { createPublicAuthMiddleware } from '../../middleware/public-auth.middleware';
import { MerchantService } from '../../services/merchant.service';
import { ErrorResponseSchema } from '../../docs/schemas';

const APPROVE_GAS = 46_000n;

export interface PrepareWalletBody {
  paymentId: string;
  walletAddress: string;
}

export async function prepareWalletRoute(
  app: FastifyInstance,
  blockchainService: BlockchainService,
  merchantService: MerchantService,
  paymentService: PaymentService,
  paymentMethodService: PaymentMethodService,
  tokenService: TokenService
) {
  const publicAuth = createPublicAuthMiddleware(merchantService);

  app.post<{ Body: PrepareWalletBody }>(
    '/payments/prepare-wallet',
    {
      schema: {
        operationId: 'prepareWallet',
        tags: ['Payments'],
        summary: 'Prepare wallet (allowance/gas check)',
        description: `
After wallet connect, check allowance and token balance; reports needsApprove and needsGas.
Public Key auth.

**Headers (required):** \`x-public-key\` = public key (pk_live_xxx). \`Origin\` = allowed origin (must be in merchant allowed_domains).
        `,
        headers: {
          type: 'object',
          properties: {
            'x-public-key': {
              type: 'string',
              description: 'Public key (pk_live_xxx). Get from POST /merchants/me/public-key.',
            },
            origin: {
              type: 'string',
              description:
                'Request origin. Must exactly match one of merchant allowed_domains. In Swagger/curl set it to the same value as one of your allowed_domains.',
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
              description: 'Connected wallet address (0x + 40 hex)',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              needsApprove: { type: 'boolean' },
              needsGas: { type: 'boolean' },
              gatewayAddress: { type: 'string' },
              tokenAddress: { type: 'string' },
              amount: { type: 'string', description: 'Wei' },
            },
          },
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
      preHandler: publicAuth,
    },
    async (request, reply) => {
      try {
        const validated = PrepareWalletSchema.parse(request.body);
        const merchant = (request as { merchant?: { id: number } }).merchant;
        if (!merchant) {
          return reply.code(403).send({ code: 'UNAUTHORIZED', message: 'Merchant required' });
        }

        const payment = await paymentService.findByHash(validated.paymentId);
        if (!payment) {
          return reply.code(404).send({
            code: 'NOT_FOUND',
            message: 'Payment not found',
          });
        }

        if (payment.merchant_id !== merchant.id) {
          return reply.code(403).send({
            code: 'FORBIDDEN',
            message: 'Payment does not belong to this merchant',
          });
        }

        const chainId = payment.network_id;
        const amountWei = BigInt(payment.amount.toString());

        const pm = await paymentMethodService.findById(payment.payment_method_id);
        if (!pm) {
          return reply.code(404).send({
            code: 'PAYMENT_METHOD_NOT_FOUND',
            message: 'Payment method not found',
          });
        }

        const token = await tokenService.findById(pm.token_id);
        if (!token) {
          return reply.code(404).send({
            code: 'TOKEN_NOT_FOUND',
            message: 'Token not found',
          });
        }

        const tokenAddress = token.address;
        const contracts = blockchainService.getChainContracts(chainId);
        const gatewayAddress = contracts?.gateway;
        if (!gatewayAddress) {
          return reply.code(500).send({
            code: 'GATEWAY_NOT_CONFIGURED',
            message: 'Gateway address not configured for chain',
          });
        }

        const [allowanceStr, balanceStr, nativeBalance, gasPrice] = await Promise.all([
          blockchainService.getTokenAllowance(
            chainId,
            tokenAddress,
            validated.walletAddress,
            gatewayAddress
          ),
          blockchainService.getTokenBalance(chainId, tokenAddress, validated.walletAddress),
          blockchainService.getNativeBalance(chainId, validated.walletAddress),
          blockchainService.getGasPrice(chainId),
        ]);

        const balance = BigInt(balanceStr);
        if (balance < amountWei) {
          return reply.code(400).send({
            code: 'INSUFFICIENT_BALANCE',
            message: 'Token balance is less than payment amount',
          });
        }

        const allowance = BigInt(allowanceStr);
        const needsApprove = allowance < amountWei;

        const approveGasCost = APPROVE_GAS * gasPrice;
        const needsGas = nativeBalance < approveGasCost;

        return reply.code(200).send({
          needsApprove,
          needsGas,
          gatewayAddress,
          tokenAddress,
          amount: payment.amount.toString(),
        });
      } catch (err) {
        if (err instanceof ZodError) {
          return reply.code(400).send({
            code: 'VALIDATION_ERROR',
            message: 'Input validation failed',
            details: err.errors,
          });
        }
        const message = err instanceof Error ? err.message : 'Failed to prepare wallet';
        return reply.code(500).send({ code: 'INTERNAL_ERROR', message });
      }
    }
  );
}
