import { FastifyInstance } from 'fastify';
import { keccak256, encodePacked, Hex, Address } from 'viem';
import { Decimal } from '@solo-pay/database';
import { randomBytes } from 'crypto';
import { MerchantService } from '../../services/merchant.service';
import { PaymentService } from '../../services/payment.service';
import { RefundService } from '../../services/refund.service';
import { ServerSigningService } from '../../services/signature-server.service';
import { BlockchainService } from '../../services/blockchain.service';
import { createAuthMiddleware } from '../../middleware/auth.middleware';

interface CreateRefundBody {
  paymentId: string;
  reason?: string;
}

export async function createRefundRoute(
  app: FastifyInstance,
  merchantService: MerchantService,
  paymentService: PaymentService,
  refundService: RefundService,
  blockchainService: BlockchainService,
  signingServices: Map<number, ServerSigningService>
) {
  const authMiddleware = createAuthMiddleware(merchantService);

  app.post<{ Body: CreateRefundBody }>(
    '/refund',
    {
      schema: {
        operationId: 'createRefund',
        tags: ['Refund'],
        summary: 'Create a new refund request',
        description: `
Creates a refund request for a confirmed payment.

**Requirements:**
- Payment must be in CONFIRMED status
- Payment must belong to the authenticated merchant
- Payment must have a payer_address stored
- Payment must not be already refunded

**Flow:**
1. Validate payment status and ownership
2. Generate refund hash and server signature
3. Submit refund transaction to relayer
4. Return refund status
        `,
        security: [{ ApiKeyAuth: [] }],
        body: {
          type: 'object',
          required: ['paymentId'],
          properties: {
            paymentId: {
              type: 'string',
              description: 'Payment hash (bytes32)',
              example: '0x1234567890abcdef...',
            },
            reason: {
              type: 'string',
              description: 'Refund reason (optional)',
              maxLength: 500,
              example: 'Customer requested refund',
            },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'object',
                properties: {
                  refundId: { type: 'string', example: '0xabcd...' },
                  paymentId: { type: 'string', example: '0x1234...' },
                  amount: { type: 'string', example: '100000000000000000000' },
                  tokenAddress: { type: 'string', example: '0xE4C6...' },
                  payerAddress: { type: 'string', example: '0x7bE4...' },
                  status: { type: 'string', example: 'PENDING' },
                  serverSignature: { type: 'string', example: '0xabcd...' },
                  merchantId: { type: 'string', example: '0x1234...' },
                  createdAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
          400: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
          403: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              code: { type: 'string' },
              message: { type: 'string' },
            },
          },
        },
      },
      preHandler: authMiddleware,
    },
    async (request, reply) => {
      try {
        const { paymentId, reason } = request.body;
        const merchant = (request as unknown as { merchant: { id: number; merchant_key: string } })
          .merchant;

        // 1. Find payment
        const payment = await paymentService.findByHash(paymentId);
        if (!payment) {
          return reply.code(404).send({
            code: 'PAYMENT_NOT_FOUND',
            message: 'Payment not found',
          });
        }

        // 2. Verify merchant ownership
        if (payment.merchant_id !== merchant.id) {
          return reply.code(403).send({
            code: 'FORBIDDEN',
            message: 'Payment does not belong to this merchant',
          });
        }

        // 3. Check payment status
        if (payment.status !== 'CONFIRMED') {
          return reply.code(400).send({
            code: 'PAYMENT_NOT_CONFIRMED',
            message: `Payment must be CONFIRMED to refund. Current status: ${payment.status}`,
          });
        }

        // 4. Check payer_address
        if (!payment.payer_address) {
          return reply.code(400).send({
            code: 'PAYER_ADDRESS_NOT_FOUND',
            message: 'Payer address not found for this payment',
          });
        }

        // 5. Check for existing refund
        const hasCompleted = await refundService.hasCompletedRefund(payment.id);
        if (hasCompleted) {
          return reply.code(400).send({
            code: 'PAYMENT_ALREADY_REFUNDED',
            message: 'This payment has already been refunded',
          });
        }

        const hasActive = await refundService.hasActiveRefund(payment.id);
        if (hasActive) {
          return reply.code(400).send({
            code: 'REFUND_IN_PROGRESS',
            message: 'A refund is already in progress for this payment',
          });
        }

        // 6. Get chain contracts
        const chainContracts = blockchainService.getChainContracts(payment.network_id);
        if (!chainContracts || !chainContracts.gateway) {
          return reply.code(500).send({
            code: 'CHAIN_CONFIG_ERROR',
            message: 'Chain configuration not found',
          });
        }

        // 7. Get signing service
        const signingService = signingServices.get(payment.network_id);
        if (!signingService) {
          return reply.code(500).send({
            code: 'SIGNING_SERVICE_ERROR',
            message: 'Signing service not available for this chain',
          });
        }

        // 8. Get token config
        const tokenConfig = blockchainService.getTokenConfig(
          payment.network_id,
          payment.token_symbol
        );
        if (!tokenConfig) {
          return reply.code(500).send({
            code: 'TOKEN_INFO_ERROR',
            message: 'Token information not found',
          });
        }

        // 9. Generate refund hash
        const randomSalt = randomBytes(16).toString('hex');
        const refundHash = keccak256(
          encodePacked(
            ['bytes32', 'address', 'uint256', 'bytes16'],
            [
              paymentId as Hex,
              payment.payer_address as Address,
              BigInt(payment.amount.toString()),
              `0x${randomSalt}` as Hex,
            ]
          )
        );

        // 10. Create refund record
        const refund = await refundService.create({
          refund_hash: refundHash,
          payment_id: payment.id,
          merchant_id: merchant.id,
          amount: payment.amount as Decimal,
          token_address: tokenConfig.address,
          payer_address: payment.payer_address,
          reason,
        });

        // 11. Generate server signature
        const merchantId = ServerSigningService.merchantKeyToId(merchant.merchant_key);

        const serverSignature = await signingService.signRefundRequest(
          paymentId as Hex,
          tokenConfig.address as Address,
          BigInt(payment.amount.toString()),
          payment.payer_address as Address,
          merchantId
        );

        // 12. TODO: Submit to relayer (for now, just return the signature)
        // In a full implementation, you would call relayerService here
        // to submit the refund transaction

        return reply.code(201).send({
          success: true,
          data: {
            refundId: refund.refund_hash,
            paymentId: payment.payment_hash,
            amount: payment.amount.toString(),
            tokenAddress: tokenConfig.address,
            payerAddress: payment.payer_address,
            status: refund.status,
            serverSignature,
            merchantId,
            createdAt: refund.created_at.toISOString(),
          },
        });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to create refund');
        return reply.code(500).send({
          code: 'INTERNAL_ERROR',
          message: 'Failed to create refund',
        });
      }
    }
  );
}
