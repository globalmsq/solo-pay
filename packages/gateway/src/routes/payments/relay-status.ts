import { FastifyInstance } from 'fastify';
import { RelayService } from '../../services/relay.service';
import { PaymentService } from '../../services/payment.service';
import { MerchantService } from '../../services/merchant.service';
import { createPublicAuthMiddleware } from '../../middleware/public-auth.middleware';
import { ErrorResponseSchema } from '../../docs/schemas';

export async function getRelayStatusRoute(
  app: FastifyInstance,
  relayService: RelayService,
  paymentService: PaymentService,
  merchantService: MerchantService
) {
  const authMiddleware = createPublicAuthMiddleware(merchantService);

  app.get<{ Params: { id: string } }>(
    '/payment/:id/relay',
    {
      schema: {
        operationId: 'getRelayStatus',
        tags: ['Payment'],
        summary: 'Get relay transaction status',
        description: `
Returns the latest relay transaction status for a payment.

**Status Values:**
- \`QUEUED\` - Relay request created, waiting to be submitted
- \`SUBMITTED\` - Transaction submitted to blockchain
- \`CONFIRMED\` - Transaction confirmed on-chain
- \`FAILED\` - Relay transaction failed

**Authentication:** x-public-key + Origin header required.
        `,
        headers: {
          type: 'object',
          properties: {
            'x-public-key': {
              type: 'string',
              description: 'Public key (pk_live_xxx or pk_test_xxx)',
            },
          },
        },
        params: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Payment hash (bytes32)',
            },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    enum: ['QUEUED', 'SUBMITTED', 'CONFIRMED', 'FAILED'],
                    description: 'Relay transaction status',
                  },
                  transactionHash: {
                    type: 'string',
                    nullable: true,
                    description: 'Transaction hash (available after submission)',
                  },
                  errorMessage: {
                    type: 'string',
                    nullable: true,
                    description: 'Error message if failed',
                  },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
      preHandler: authMiddleware,
    },
    async (request, reply) => {
      try {
        const { id } = request.params;

        // Find payment by hash
        const payment = await paymentService.findByHash(id);
        if (!payment) {
          return reply.code(404).send({
            code: 'PAYMENT_NOT_FOUND',
            message: 'Payment not found',
          });
        }

        // Find the latest relay request for this payment
        const relayRequests = await relayService.findByPaymentId(payment.id);
        if (relayRequests.length === 0) {
          return reply.code(404).send({
            code: 'RELAY_NOT_FOUND',
            message: 'No relay request found for this payment',
          });
        }

        const latest = relayRequests[0];

        return reply.code(200).send({
          success: true,
          data: {
            status: latest.status,
            transactionHash: latest.tx_hash ?? null,
            errorMessage: latest.error_message ?? null,
            createdAt: latest.created_at.toISOString(),
            updatedAt: latest.updated_at.toISOString(),
          },
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to get relay status';
        return reply.code(500).send({
          code: 'INTERNAL_ERROR',
          message,
        });
      }
    }
  );
}
