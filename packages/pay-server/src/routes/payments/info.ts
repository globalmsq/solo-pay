import { FastifyInstance } from 'fastify';
import { parseUnits, Address } from 'viem';
import { ZodError } from 'zod';
import { PaymentInfoSchema } from '../../schemas/payment.schema';
import { BlockchainService } from '../../services/blockchain.service';
import { MerchantService } from '../../services/merchant.service';
import { ChainService } from '../../services/chain.service';
import { TokenService } from '../../services/token.service';
import { PaymentMethodService } from '../../services/payment-method.service';
import { ServerSigningService } from '../../services/signature-server.service';
import { createMerchantAuthMiddleware } from '../../middleware/auth.middleware';
import {
  PaymentInfoRequestSchema,
  PaymentInfoResponseSchema,
  ErrorResponseSchema,
} from '../../docs/schemas';

export interface PaymentInfoRequest {
  amount: number;
  tokenAddress: string;
}

export async function paymentInfoRoute(
  app: FastifyInstance,
  blockchainService: BlockchainService,
  merchantService: MerchantService,
  chainService: ChainService,
  tokenService: TokenService,
  paymentMethodService: PaymentMethodService
) {
  // Enforce same merchant key and API when body.merchantId is present
  const authMiddleware = createMerchantAuthMiddleware(merchantService);

  app.post<{ Body: PaymentInfoRequest }>(
    '/payments/info',
    {
      schema: {
        operationId: 'getPaymentInfo',
        tags: ['Payments'],
        summary: 'Get payment contract information',
        description: `
Returns payment contract information without creating a payment record.

**Use case:**
- Client needs gateway/forwarder addresses before creating a payment
- Pre-validation of token and merchant configuration
- Get amount in wei for display purposes

**Notes:**
- Requires API key authentication
- chainId is derived from merchant configuration
- No database record is created
        `,
        security: [{ ApiKeyAuth: [] }],
        body: PaymentInfoRequestSchema,
        response: {
          200: PaymentInfoResponseSchema,
          400: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
      preHandler: authMiddleware,
    },
    async (request, reply) => {
      try {
        const validatedData = PaymentInfoSchema.parse(request.body);

        // Get merchant from auth middleware
        const merchant = (request as { merchant?: { merchant_key: string } }).merchant;
        if (!merchant) {
          return reply.code(403).send({
            code: 'UNAUTHORIZED',
            message: 'Merchant authentication required',
          });
        }

        // Get full merchant info from DB
        const merchantInfo = await merchantService.findByMerchantKey(merchant.merchant_key);
        if (!merchantInfo) {
          return reply.code(404).send({
            code: 'MERCHANT_NOT_FOUND',
            message: 'Merchant not found',
          });
        }

        if (!merchantInfo.is_enabled) {
          return reply.code(403).send({
            code: 'MERCHANT_DISABLED',
            message: 'Merchant is disabled',
          });
        }

        // Get chainId from merchant
        if (!merchantInfo.chain_id) {
          return reply.code(400).send({
            code: 'CHAIN_NOT_CONFIGURED',
            message: 'Merchant chain is not configured',
          });
        }

        const merchantChain = await chainService.findById(merchantInfo.chain_id);
        if (!merchantChain) {
          return reply.code(404).send({
            code: 'CHAIN_NOT_FOUND',
            message: 'Merchant chain not found',
          });
        }

        const chainId = merchantChain.network_id;

        // Validate chain is supported
        if (!blockchainService.isChainSupported(chainId)) {
          return reply.code(400).send({
            code: 'UNSUPPORTED_CHAIN',
            message: 'Unsupported chain',
          });
        }

        // Validate recipient address
        if (!merchantInfo.recipient_address) {
          return reply.code(400).send({
            code: 'RECIPIENT_NOT_CONFIGURED',
            message: 'Merchant recipient address is not configured',
          });
        }
        const recipientAddress = merchantInfo.recipient_address as Address;

        // Validate token
        const tokenAddress = validatedData.tokenAddress;
        if (!blockchainService.validateTokenByAddress(chainId, tokenAddress)) {
          return reply.code(400).send({
            code: 'UNSUPPORTED_TOKEN',
            message: 'Unsupported token',
          });
        }

        const tokenConfig = blockchainService.getTokenConfigByAddress(chainId, tokenAddress);
        if (!tokenConfig) {
          return reply.code(400).send({
            code: 'UNSUPPORTED_TOKEN',
            message: 'Unsupported token',
          });
        }

        // Get token from DB
        const chain = await chainService.findByNetworkId(chainId);
        if (!chain) {
          return reply.code(404).send({
            code: 'CHAIN_NOT_FOUND',
            message: 'Chain not found in database',
          });
        }

        const token = await tokenService.findByAddress(chain.id, tokenAddress);
        if (!token) {
          return reply.code(404).send({
            code: 'TOKEN_NOT_FOUND',
            message: 'Token not found in database',
          });
        }

        // Validate payment method
        const paymentMethod = await paymentMethodService.findByMerchantAndToken(
          merchantInfo.id,
          token.id
        );
        if (!paymentMethod) {
          return reply.code(404).send({
            code: 'PAYMENT_METHOD_NOT_FOUND',
            message: 'Payment method not configured for this merchant and token',
          });
        }

        if (!paymentMethod.is_enabled) {
          return reply.code(403).send({
            code: 'PAYMENT_METHOD_DISABLED',
            message: 'Payment method is disabled',
          });
        }

        // Get token info (on-chain with DB fallback)
        let tokenDecimals: number;
        let tokenSymbol: string;

        try {
          tokenDecimals = await blockchainService.getDecimals(chainId, tokenAddress);
        } catch {
          tokenDecimals = token.decimals;
        }

        try {
          tokenSymbol = await blockchainService.getTokenSymbolOnChain(chainId, tokenAddress);
        } catch {
          tokenSymbol = token.symbol;
        }

        // Convert amount to wei
        const amountInWei = parseUnits(validatedData.amount.toString(), tokenDecimals);

        // Get contract addresses
        const contracts = blockchainService.getChainContracts(chainId);

        // Generate merchantId (bytes32)
        const merchantId = ServerSigningService.merchantKeyToId(merchantInfo.merchant_key);

        return reply.code(200).send({
          success: true,
          chainId,
          tokenAddress: tokenConfig.address,
          tokenSymbol,
          tokenDecimals,
          gatewayAddress: contracts?.gateway,
          forwarderAddress: contracts?.forwarder,
          amount: amountInWei.toString(),
          recipientAddress,
          merchantId,
          feeBps: merchantInfo.fee_bps,
        });
      } catch (error) {
        if (error instanceof ZodError) {
          return reply.code(400).send({
            code: 'VALIDATION_ERROR',
            message: 'Input validation failed',
            details: error.errors,
          });
        }
        const message = error instanceof Error ? error.message : 'Failed to get payment info';
        return reply.code(500).send({
          code: 'INTERNAL_ERROR',
          message,
        });
      }
    }
  );
}
