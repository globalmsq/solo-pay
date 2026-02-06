import { FastifyInstance } from 'fastify';
import { MerchantService } from '../../services/merchant.service';
import { PaymentService } from '../../services/payment.service';
import { RefundService } from '../../services/refund.service';
import { createAuthMiddleware } from '../../middleware/auth.middleware';

interface RefundStatusParams {
  refundId: string;
}

export async function getRefundStatusRoute(
  app: FastifyInstance,
  merchantService: MerchantService,
  paymentService: PaymentService,
  refundService: RefundService
) {
  const authMiddleware = createAuthMiddleware(merchantService);

  app.get<{ Params: RefundStatusParams }>(
    '/refunds/:refundId',
    {
      schema: {
        operationId: 'getRefundStatus',
        tags: ['Refunds'],
        summary: 'Get refund status',
        description: 'Returns the current status of a refund request.',
        security: [{ ApiKeyAuth: [] }],
        params: {
          type: 'object',
          required: ['refundId'],
          properties: {
            refundId: {
              type: 'string',
              description: 'Refund hash (bytes32)',
              example: '0xabcd1234...',
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'object',
                properties: {
                  refundId: { type: 'string' },
                  paymentId: { type: 'string' },
                  amount: { type: 'string' },
                  tokenAddress: { type: 'string' },
                  tokenSymbol: { type: 'string' },
                  tokenDecimals: { type: 'number' },
                  payerAddress: { type: 'string' },
                  status: { type: 'string', enum: ['PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED'] },
                  reason: { type: 'string', nullable: true },
                  txHash: { type: 'string', nullable: true },
                  errorMessage: { type: 'string', nullable: true },
                  createdAt: { type: 'string', format: 'date-time' },
                  submittedAt: { type: 'string', format: 'date-time', nullable: true },
                  confirmedAt: { type: 'string', format: 'date-time', nullable: true },
                },
              },
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
        const { refundId } = request.params;
        const merchant = (request as unknown as { merchant: { id: number } }).merchant;

        // Find refund
        const refund = await refundService.findByHash(refundId);
        if (!refund) {
          return reply.code(404).send({
            code: 'REFUND_NOT_FOUND',
            message: 'Refund not found',
          });
        }

        // Verify merchant ownership
        if (refund.merchant_id !== merchant.id) {
          return reply.code(403).send({
            code: 'FORBIDDEN',
            message: 'Refund does not belong to this merchant',
          });
        }

        // Get payment for additional info
        const payment = await paymentService.findById(refund.payment_id);
        if (!payment) {
          return reply.code(404).send({
            code: 'PAYMENT_NOT_FOUND',
            message: 'Associated payment not found',
          });
        }

        return reply.code(200).send({
          success: true,
          data: {
            refundId: refund.refund_hash,
            paymentId: payment.payment_hash,
            amount: refund.amount.toString(),
            tokenAddress: refund.token_address,
            tokenSymbol: payment.token_symbol,
            tokenDecimals: payment.token_decimals,
            payerAddress: refund.payer_address,
            status: refund.status,
            reason: refund.reason,
            txHash: refund.tx_hash,
            errorMessage: refund.error_message,
            createdAt: refund.created_at.toISOString(),
            submittedAt: refund.submitted_at?.toISOString() || null,
            confirmedAt: refund.confirmed_at?.toISOString() || null,
          },
        });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to get refund status');
        return reply.code(500).send({
          code: 'INTERNAL_ERROR',
          message: 'Failed to get refund status',
        });
      }
    }
  );
}
