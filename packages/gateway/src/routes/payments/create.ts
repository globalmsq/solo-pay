import { FastifyInstance } from 'fastify';
import { parseUnits, keccak256, toHex, Hex, Address } from 'viem';
import { Decimal } from '@solo-pay/database';
import { randomBytes } from 'crypto';
import { ZodError } from 'zod';
import { CreatePaymentSchema } from '../../schemas/payment.schema';
import { BlockchainService } from '../../services/blockchain.service';
import { MerchantService } from '../../services/merchant.service';
import { ChainService } from '../../services/chain.service';
import { TokenService } from '../../services/token.service';
import { PaymentMethodService } from '../../services/payment-method.service';
import { PaymentService } from '../../services/payment.service';
import { ServerSigningService } from '../../services/signature-server.service';
import { createPublicAuthMiddleware } from '../../middleware/public-auth.middleware';
import { ErrorResponseSchema } from '../../docs/schemas';

export interface CreatePaymentBody {
  orderId: string;
  amount: number;
  tokenAddress: string;
  successUrl: string;
  failUrl: string;
  webhookUrl?: string;
}

export async function createPaymentRoute(
  app: FastifyInstance,
  blockchainService: BlockchainService,
  merchantService: MerchantService,
  chainService: ChainService,
  tokenService: TokenService,
  paymentMethodService: PaymentMethodService,
  paymentService: PaymentService,
  signingServices?: Map<number, ServerSigningService>
) {
  const publicAuth = createPublicAuthMiddleware(merchantService);

  app.post<{ Body: CreatePaymentBody }>(
    '/payments/create',
    {
      schema: {
        operationId: 'createPayment',
        tags: ['Payments'],
        summary: 'Create payment (public key + Origin)',
        description: `
Creates a payment. Single endpoint for both widget and backend. Uses Public Key auth and Origin validation.

**Headers (required):** \`x-public-key\` = public key (pk_live_xxx or pk_test_xxx). \`Origin\` = request origin; must **exactly** match one of merchant \`allowed_domains\` (no trailing slash). In a browser the browser sets Origin automatically; in server-to-server or Swagger/curl set it manually to one of your allowed domains.

**Flow:** Public Key + Origin -> merchant -> token from request body (must be whitelisted and enabled for merchant) -> amount to wei -> payment_hash -> Payment record -> server signature.

**Response:** paymentId, serverSignature, chainId, tokenAddress, gatewayAddress, amount (wei), tokenDecimals, tokenSymbol, successUrl, failUrl, expiresAt, recipientAddress, merchantId, feeBps, forwarderAddress.
        `,
        headers: {
          type: 'object',
          properties: {
            'x-public-key': {
              type: 'string',
              description:
                'Public key (pk_live_xxx). Get from POST /merchants/me/public-key with API Key.',
            },
            origin: {
              type: 'string',
              description:
                'Request origin. Must exactly match one of merchant allowed_domains (e.g. http://localhost:3000). In browser this is set automatically; in server-to-server/Swagger set it to the same value as one of your allowed_domains.',
            },
          },
        },
        body: {
          type: 'object',
          required: ['orderId', 'amount', 'tokenAddress', 'successUrl', 'failUrl'],
          properties: {
            orderId: { type: 'string', description: 'Merchant order ID' },
            amount: { type: 'number', description: 'Payment amount' },
            tokenAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              default: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
              example: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
              description:
                'ERC-20 token contract address (must be whitelisted and enabled for merchant)',
            },
            successUrl: { type: 'string', format: 'uri', description: 'Redirect URL on success' },
            failUrl: { type: 'string', format: 'uri', description: 'Redirect URL on failure' },
            webhookUrl: {
              type: 'string',
              format: 'uri',
              description: 'Optional per-payment webhook',
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                example: true,
                description: 'Indicates the request succeeded',
              },
              paymentId: { type: 'string' },
              orderId: { type: 'string', description: 'Merchant order ID' },
              serverSignature: {
                type: 'string',
                description: 'Server EIP-712 signature for payment authorization',
              },
              chainId: { type: 'integer' },
              tokenAddress: { type: 'string' },
              gatewayAddress: { type: 'string' },
              amount: { type: 'string', description: 'Wei' },
              tokenDecimals: { type: 'integer' },
              tokenSymbol: { type: 'string' },
              successUrl: { type: 'string' },
              failUrl: { type: 'string' },
              expiresAt: { type: 'string', format: 'date-time' },
              recipientAddress: {
                type: 'string',
                description: 'Merchant recipient wallet address',
              },
              merchantId: { type: 'string', description: 'Merchant ID (bytes32)' },
              feeBps: { type: 'integer', description: 'Fee in basis points (100 = 1%)' },
              forwarderAddress: {
                type: 'string',
                description: 'ERC2771Forwarder address for gasless payments',
              },
            },
          },
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          409: {
            type: 'object',
            description: 'Order ID already used for this merchant',
            properties: {
              code: { type: 'string', example: 'DUPLICATE_ORDER' },
              message: { type: 'string', example: 'Order ID already used for this merchant.' },
            },
          },
          500: ErrorResponseSchema,
        },
      },
      preHandler: publicAuth,
    },
    async (request, reply) => {
      try {
        const validated = CreatePaymentSchema.parse(request.body);
        const merchant = (
          request as {
            merchant?: {
              id: number;
              merchant_key: string;
              chain_id: number;
              recipient_address: string | null;
              fee_bps: number;
            };
          }
        ).merchant;
        if (!merchant) {
          return reply.code(403).send({ code: 'UNAUTHORIZED', message: 'Merchant required' });
        }

        const origin = (request.headers['origin'] as string) ?? '';

        if (!merchant.chain_id) {
          return reply.code(400).send({
            code: 'CHAIN_NOT_CONFIGURED',
            message: 'Merchant chain is not configured',
          });
        }

        const chain = await chainService.findById(merchant.chain_id);
        if (!chain || !chain.gateway_address) {
          return reply.code(404).send({
            code: 'CHAIN_NOT_FOUND',
            message: 'Merchant chain or gateway not found',
          });
        }

        const chainId = chain.network_id;
        if (!blockchainService.isChainSupported(chainId)) {
          return reply.code(400).send({
            code: 'UNSUPPORTED_CHAIN',
            message: 'Unsupported chain',
          });
        }

        // Resolve token from request: must be in our whitelist (chain) and enabled for this merchant (combined filter)
        const token = await tokenService.findByAddress(chain.id, validated.tokenAddress);
        if (!token) {
          return reply.code(404).send({
            code: 'TOKEN_NOT_FOUND',
            message: 'Token not found or not whitelisted for this chain',
          });
        }
        if (token.chain_id !== merchant.chain_id) {
          return reply.code(400).send({
            code: 'CHAIN_MISMATCH',
            message: 'Token does not belong to merchant chain',
          });
        }
        const paymentMethod = await paymentMethodService.findByMerchantAndToken(
          merchant.id,
          token.id
        );
        if (!paymentMethod || !paymentMethod.is_enabled) {
          return reply.code(400).send({
            code: 'TOKEN_NOT_ENABLED',
            message:
              'Token is not enabled for this merchant. Add and enable it in payment methods first.',
          });
        }

        const tokenAddress = token.address;
        if (!blockchainService.validateTokenByAddress(chainId, tokenAddress)) {
          return reply.code(400).send({
            code: 'UNSUPPORTED_TOKEN',
            message: 'Unsupported token',
          });
        }

        let tokenDecimals = token.decimals;
        let tokenSymbol = token.symbol;
        try {
          tokenDecimals = await blockchainService.getDecimals(chainId, tokenAddress);
        } catch (err) {
          app.log.warn({ err, chainId, tokenAddress }, 'getDecimals failed, using DB value');
        }
        try {
          tokenSymbol = await blockchainService.getTokenSymbolOnChain(chainId, tokenAddress);
        } catch (err) {
          app.log.warn(
            { err, chainId, tokenAddress },
            'getTokenSymbolOnChain failed, using DB value'
          );
        }

        const amountInWei = parseUnits(validated.amount.toString(), tokenDecimals);
        const contracts = blockchainService.getChainContracts(chainId);
        const random = randomBytes(32);
        const paymentHash = keccak256(
          toHex(`${merchant.merchant_key}:${Date.now()}:${random.toString('hex')}`)
        );

        const merchantId = ServerSigningService.merchantKeyToId(merchant.merchant_key);
        const recipientAddress = (merchant.recipient_address ?? '') as Address;
        if (!recipientAddress) {
          return reply.code(400).send({
            code: 'RECIPIENT_NOT_CONFIGURED',
            message: 'Merchant recipient address is not configured',
          });
        }

        // Generate server signature if signing service is available for this chain
        let serverSignature: Hex | undefined;
        const signingService = signingServices?.get(chainId);
        if (signingService) {
          try {
            serverSignature = await signingService.signPaymentRequest(
              paymentHash as Hex,
              tokenAddress as Address,
              amountInWei,
              recipientAddress,
              merchantId,
              merchant.fee_bps
            );
          } catch (err) {
            app.log.error({ err }, 'Failed to generate server signature');
            return reply.code(500).send({
              code: 'SIGNATURE_ERROR',
              message: 'Failed to generate payment signature',
            });
          }
        }

        const existingPayment = await paymentService.findByOrderId(validated.orderId, merchant.id);
        if (existingPayment) {
          return reply.code(409).send({
            code: 'DUPLICATE_ORDER',
            message: 'Order ID already used for this merchant.',
          });
        }

        const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
        await paymentService.create({
          payment_hash: paymentHash,
          merchant_id: merchant.id,
          payment_method_id: paymentMethod.id,
          amount: new Decimal(amountInWei.toString()),
          token_decimals: tokenDecimals,
          token_symbol: tokenSymbol,
          network_id: chainId,
          expires_at: expiresAt,
          order_id: validated.orderId,
          success_url: validated.successUrl,
          fail_url: validated.failUrl,
          webhook_url: validated.webhookUrl,
          origin,
        });

        return reply.code(201).send({
          success: true,
          paymentId: paymentHash,
          orderId: validated.orderId,
          serverSignature: serverSignature ?? '',
          chainId,
          tokenAddress,
          gatewayAddress: contracts?.gateway ?? '',
          amount: amountInWei.toString(),
          tokenDecimals,
          tokenSymbol,
          successUrl: validated.successUrl,
          failUrl: validated.failUrl,
          expiresAt: expiresAt.toISOString(),
          recipientAddress,
          merchantId,
          feeBps: merchant.fee_bps,
          forwarderAddress: chain.forwarder_address ?? undefined,
        });
      } catch (err) {
        if (err instanceof ZodError) {
          return reply.code(400).send({
            code: 'VALIDATION_ERROR',
            message: 'Input validation failed',
            details: err.errors,
          });
        }
        const message = err instanceof Error ? err.message : 'Failed to create payment';
        return reply.code(500).send({ code: 'INTERNAL_ERROR', message });
      }
    }
  );
}
