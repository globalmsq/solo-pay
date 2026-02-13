import { FastifyInstance } from 'fastify';
import { RefundStatus } from '@solo-pay/database';
import { MerchantService } from '../../services/merchant.service';
import { PaymentService } from '../../services/payment.service';
import { RefundService } from '../../services/refund.service';
import { createAuthMiddleware } from '../../middleware/auth.middleware';

interface RefundListQuery {
  page?: number;
  limit?: number;
  status?: RefundStatus;
  paymentId?: string;
}

export async function getRefundListRoute(
  app: FastifyInstance,
  merchantService: MerchantService,
  paymentService: PaymentService,
  refundService: RefundService
) {
  const authMiddleware = createAuthMiddleware(merchantService);

  app.get<{ Querystring: RefundListQuery }>(
    '/refunds',
    {
      schema: {
        operationId: 'getRefundList',
        tags: ['Refunds'],
        summary: 'List refunds',
        description: 'Returns a paginated list of refunds for the authenticated merchant.',
        security: [{ ApiKeyAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              minimum: 1,
              default: 1,
              description: 'Page number',
            },
            limit: {
              type: 'integer',
              minimum: 1,
              maximum: 100,
              default: 20,
              description: 'Items per page',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED'],
              description: 'Filter by status',
            },
            paymentId: {
              type: 'string',
              description: 'Filter by payment hash',
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
                  items: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        refundId: { type: 'string' },
                        paymentId: { type: 'string' },
                        amount: { type: 'string' },
                        tokenAddress: { type: 'string' },
                        payerAddress: { type: 'string' },
                        status: {
                          type: 'string',
                          enum: ['PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED'],
                        },
                        reason: { type: 'string', nullable: true },
                        txHash: { type: 'string', nullable: true },
                        createdAt: { type: 'string', format: 'date-time' },
                        confirmedAt: { type: 'string', format: 'date-time', nullable: true },
                      },
                    },
                  },
                  pagination: {
                    type: 'object',
                    properties: {
                      page: { type: 'integer' },
                      limit: { type: 'integer' },
                      total: { type: 'integer' },
                      totalPages: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      preHandler: authMiddleware,
    },
    async (request, reply) => {
      try {
        const { page = 1, limit = 20, status, paymentId } = request.query;
        const merchant = (request as unknown as { merchant: { id: number } }).merchant;

        const result = await refundService.findByMerchant(merchant.id, {
          page,
          limit,
          status,
          paymentId,
        });

        // Get payment hashes for each refund (single batch query)
        const paymentIds = [...new Set(result.items.map((r) => r.payment_id))];
        const payments = await paymentService.findByIds(paymentIds);
        const paymentMap = new Map(payments.map((p) => [p.id, p.payment_hash]));

        const items = result.items.map((refund) => ({
          refundId: refund.refund_hash,
          paymentId: paymentMap.get(refund.payment_id) || '',
          amount: refund.amount.toString(),
          tokenAddress: refund.token_address,
          payerAddress: refund.payer_address,
          status: refund.status,
          reason: refund.reason,
          txHash: refund.tx_hash,
          createdAt: refund.created_at.toISOString(),
          confirmedAt: refund.confirmed_at?.toISOString() || null,
        }));

        return reply.code(200).send({
          success: true,
          data: {
            items,
            pagination: result.pagination,
          },
        });
      } catch (error) {
        request.log.error({ err: error }, 'Failed to list refunds');
        return reply.code(500).send({
          code: 'INTERNAL_ERROR',
          message: 'Failed to list refunds',
        });
      }
    }
  );
}
