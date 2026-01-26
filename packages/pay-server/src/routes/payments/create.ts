import { FastifyInstance } from 'fastify';
import { parseUnits, keccak256, toHex } from 'viem';
import { Decimal } from '@prisma/client/runtime/library';
import { randomBytes } from 'crypto';
import { ZodError } from 'zod';
import { CreatePaymentSchema } from '../../schemas/payment.schema';
import { BlockchainService } from '../../services/blockchain.service';
import { MerchantService } from '../../services/merchant.service';
import { ChainService } from '../../services/chain.service';
import { TokenService } from '../../services/token.service';
import { PaymentMethodService } from '../../services/payment-method.service';
import { PaymentService } from '../../services/payment.service';
import { createMerchantAuthMiddleware } from '../../middleware/auth.middleware';
import {
  CreatePaymentRequestSchema,
  CreatePaymentResponseSchema,
  ErrorResponseSchema,
} from '../../docs/schemas';

export interface CreatePaymentRequest {
  merchantId: string;
  amount: number;
  chainId: number;
  tokenAddress: string;
}

export async function createPaymentRoute(
  app: FastifyInstance,
  blockchainService: BlockchainService,
  merchantService: MerchantService,
  chainService: ChainService,
  tokenService: TokenService,
  paymentMethodService: PaymentMethodService,
  paymentService: PaymentService
) {
  // Auth + merchant ownership middleware
  const authMiddleware = createMerchantAuthMiddleware(merchantService);

  app.post<{ Body: CreatePaymentRequest }>(
    '/payments/create',
    {
      schema: {
        operationId: 'createPayment',
        tags: ['Payments'],
        summary: 'Create a new payment',
        description: `
Creates a new payment request for a merchant.

**Flow:**
1. Client calls this endpoint with payment details
2. Server validates merchant, chain, and token configuration
3. Server creates a payment record with unique payment hash
4. Client uses the returned payment info to submit on-chain transaction

**Notes:**
- Payment expires after 30 minutes
- Amount is converted to wei based on token decimals
- Gasless payments use the returned forwarderAddress
        `,
        security: [{ ApiKeyAuth: [] }],
        body: CreatePaymentRequestSchema,
        response: {
          201: CreatePaymentResponseSchema,
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
        // 입력 검증
        const validatedData = CreatePaymentSchema.parse(request.body);

        // 1. 체인 지원 여부 확인
        if (!blockchainService.isChainSupported(validatedData.chainId)) {
          return reply.code(400).send({
            code: 'UNSUPPORTED_CHAIN',
            message: 'Unsupported chain',
          });
        }

        // 2. 토큰 검증: 심볼 존재 + 주소 일치 확인
        const tokenAddress = validatedData.tokenAddress;
        if (!tokenAddress) {
          return reply.code(400).send({
            code: 'INVALID_REQUEST',
            message: 'tokenAddress is required',
          });
        }

        if (!blockchainService.validateTokenByAddress(validatedData.chainId, tokenAddress)) {
          return reply.code(400).send({
            code: 'UNSUPPORTED_TOKEN',
            message: 'Unsupported token',
          });
        }

        // 3. 토큰 설정 가져오기 (주소 기반)
        const tokenConfig = blockchainService.getTokenConfigByAddress(
          validatedData.chainId,
          tokenAddress
        );
        if (!tokenConfig) {
          return reply.code(400).send({
            code: 'UNSUPPORTED_TOKEN',
            message: 'Unsupported token',
          });
        }

        // 4. DB에서 Merchant 조회 (merchant_key로)
        const merchant = await merchantService.findByMerchantKey(validatedData.merchantId);
        if (!merchant) {
          return reply.code(404).send({
            code: 'MERCHANT_NOT_FOUND',
            message: 'Merchant not found',
          });
        }

        if (!merchant.is_enabled) {
          return reply.code(403).send({
            code: 'MERCHANT_DISABLED',
            message: 'Merchant is disabled',
          });
        }

        // 5. Validate merchant's chain matches requested chain
        if (merchant.chain_id) {
          const merchantChain = await chainService.findById(merchant.chain_id);
          if (merchantChain && merchantChain.network_id !== validatedData.chainId) {
            return reply.code(400).send({
              code: 'CHAIN_MISMATCH',
              message: `Merchant is configured for chain ${merchantChain.network_id}, but payment requested for chain ${validatedData.chainId}`,
            });
          }
        }

        // 6. DB에서 Chain 조회 (network_id로)
        const chain = await chainService.findByNetworkId(validatedData.chainId);
        if (!chain) {
          return reply.code(404).send({
            code: 'CHAIN_NOT_FOUND',
            message: 'Chain not found in database',
          });
        }

        // 7. DB에서 Token 조회 (chain.id + address로)
        const token = await tokenService.findByAddress(chain.id, tokenAddress);
        if (!token) {
          return reply.code(404).send({
            code: 'TOKEN_NOT_FOUND',
            message: 'Token not found in database',
          });
        }

        // 8. Validate token's chain matches merchant's chain
        if (merchant.chain_id && token.chain_id !== merchant.chain_id) {
          return reply.code(400).send({
            code: 'CHAIN_MISMATCH',
            message: `Token belongs to chain ${token.chain_id}, but merchant is configured for chain ${merchant.chain_id}`,
          });
        }

        // 9. DB에서 MerchantPaymentMethod 조회
        const paymentMethod = await paymentMethodService.findByMerchantAndToken(
          merchant.id,
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

        // Get token decimals and symbol from on-chain data (source of truth)
        // Fallback to database if on-chain call fails
        let tokenDecimals: number;
        let tokenSymbol: string;

        try {
          tokenDecimals = await blockchainService.getDecimals(validatedData.chainId, tokenAddress);
        } catch (error) {
          // Fallback to database value if on-chain call fails
          app.log.warn(
            { err: error, tokenAddress },
            `Failed to get decimals from on-chain for token ${tokenAddress}, using database value: ${token.decimals}`
          );
          tokenDecimals = token.decimals;
        }

        try {
          tokenSymbol = await blockchainService.getTokenSymbolOnChain(
            validatedData.chainId,
            tokenAddress
          );
        } catch (error) {
          // Fallback to database value if on-chain call fails
          app.log.warn(
            { err: error, tokenAddress },
            `Failed to get symbol from on-chain for token ${tokenAddress}, using database value: ${token.symbol}`
          );
          tokenSymbol = token.symbol;
        }

        // amount를 wei로 변환 (on-chain decimals 사용 - 보안 강화)
        const amountInWei = parseUnits(validatedData.amount.toString(), tokenDecimals);

        // 체인 컨트랙트 정보 조회
        const contracts = blockchainService.getChainContracts(validatedData.chainId);

        // Generate payment: create bytes32 hash based on merchantId + timestamp + random bytes
        const random = randomBytes(32);
        const paymentHash = keccak256(
          toHex(`${validatedData.merchantId}:${Date.now()}:${random.toString('hex')}`)
        );

        // 8. DB에 Payment 저장
        const payment = await paymentService.create({
          payment_hash: paymentHash,
          merchant_id: merchant.id,
          payment_method_id: paymentMethod.id,
          amount: new Decimal(amountInWei.toString()),
          token_decimals: tokenDecimals, // Use on-chain decimals (or fallback from DB)
          token_symbol: tokenSymbol, // Use on-chain symbol (or fallback from DB)
          network_id: chain.network_id,
          expires_at: new Date(Date.now() + 30 * 60 * 1000), // 30분 후 만료
        });

        return reply.code(201).send({
          success: true,
          paymentId: paymentHash,
          chainId: validatedData.chainId,
          tokenAddress: tokenConfig.address,
          tokenSymbol, // From on-chain (or fallback from DB)
          tokenDecimals, // From on-chain (or fallback from DB)
          gatewayAddress: contracts?.gateway,
          forwarderAddress: contracts?.forwarder,
          amount: amountInWei.toString(),
          status: payment.status.toLowerCase(),
          expiresAt: payment.expires_at.toISOString(),
        });
      } catch (error) {
        if (error instanceof ZodError) {
          return reply.code(400).send({
            code: 'VALIDATION_ERROR',
            message: '입력 검증 실패',
            details: error.errors,
          });
        }
        const message = error instanceof Error ? error.message : '결제를 생성할 수 없습니다';
        return reply.code(500).send({
          code: 'INTERNAL_ERROR',
          message,
        });
      }
    }
  );
}
