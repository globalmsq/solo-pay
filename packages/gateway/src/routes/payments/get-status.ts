import { FastifyInstance } from 'fastify';
import { BlockchainService } from '../../services/blockchain.service';
import { PaymentService } from '../../services/payment.service';
import { MerchantService } from '../../services/merchant.service';
import {
  enqueuePaymentConfirmedWebhook,
  type WebhookQueueAdapter,
} from '../../services/webhook-queue.service';
import { createPublicAuthMiddleware } from '../../middleware/public-auth.middleware';
import { PaymentStatusResponseSchema, ErrorResponseSchema } from '../../docs/schemas';

export async function getPaymentStatusRoute(
  app: FastifyInstance,
  blockchainService: BlockchainService,
  paymentService: PaymentService,
  merchantService: MerchantService,
  webhookQueue: WebhookQueueAdapter
) {
  const authMiddleware = createPublicAuthMiddleware(merchantService);

  app.get<{
    Params: { id: string };
  }>(
    '/payment/:id',
    {
      schema: {
        operationId: 'getPaymentStatus',
        tags: ['Payment'],
        summary: 'Get payment status',
        description: `
Retrieves the current status of a payment by its payment hash. Requires x-public-key and Origin (must match merchant allowed_domains).

**Status Values:**
- \`CREATED\` - Payment created, awaiting on-chain transaction
- \`PENDING\` - Transaction submitted, awaiting confirmation
- \`CONFIRMED\` - Payment confirmed on-chain
- \`FAILED\` - Payment failed

**Note:** This endpoint syncs on-chain status with database status.
        `,
        headers: {
          type: 'object',
          properties: {
            'x-public-key': {
              type: 'string',
              description: 'Public key (pk_live_xxx or pk_test_xxx)',
            },
            'x-origin': {
              type: 'string',
              description:
                'Origin for this GET endpoint (proxy often strips Origin). Must match merchant allowed_domains.',
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
          200: PaymentStatusResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
      preHandler: authMiddleware,
    },
    async (request, reply) => {
      try {
        const { id } = request.params;

        if (!id || typeof id !== 'string') {
          return reply.code(400).send({
            code: 'INVALID_REQUEST',
            message: 'Payment ID is required',
          });
        }

        const paymentData = await paymentService.findByHash(id);

        if (!paymentData) {
          return reply.code(404).send({
            code: 'NOT_FOUND',
            message: 'Payment not found',
          });
        }

        const chainIdNum = paymentData.network_id;

        if (!blockchainService.isChainSupported(chainIdNum)) {
          return reply.code(400).send({
            code: 'UNSUPPORTED_CHAIN',
            message: 'Unsupported chain',
          });
        }

        const paymentStatus = await blockchainService.getPaymentStatus(chainIdNum, id);

        if (!paymentStatus) {
          return reply.code(404).send({
            code: 'NOT_FOUND',
            message: 'Payment not found',
          });
        }

        if (paymentStatus.status === 'completed' && paymentStatus.amount) {
          const eventAmount = BigInt(paymentStatus.amount);
          const dbAmount = BigInt(paymentData.amount.toString());

          if (eventAmount !== dbAmount) {
            return reply.code(400).send({
              code: 'AMOUNT_MISMATCH',
              message: `Payment amount mismatch. DB: ${dbAmount.toString()}, on-chain: ${eventAmount.toString()}`,
              details: {
                dbAmount: dbAmount.toString(),
                onChainAmount: eventAmount.toString(),
                paymentId: id,
                transactionHash: paymentStatus.transactionHash,
              },
            });
          }
        }

        let finalStatus = paymentData.status;
        if (
          paymentStatus.status === 'completed' &&
          ['CREATED', 'PENDING'].includes(paymentData.status)
        ) {
          const updatedPayment = await paymentService.updateStatusByHash(
            paymentData.payment_hash,
            'CONFIRMED',
            paymentStatus.transactionHash
          );
          if (paymentStatus.payerAddress) {
            await paymentService.updatePayerAddress(id, paymentStatus.payerAddress);
          }
          finalStatus = 'CONFIRMED';

          const merchant = await merchantService.findById(updatedPayment.merchant_id);
          enqueuePaymentConfirmedWebhook(webhookQueue, updatedPayment, merchant, (err, paymentId) =>
            app.log.warn({ err, paymentId }, 'Webhook enqueue failed')
          );
        }

        return reply.code(200).send({
          success: true,
          data: {
            ...paymentStatus,
            payment_hash: paymentData.payment_hash,
            network_id: paymentData.network_id,
            token_symbol: paymentData.token_symbol,
            status: finalStatus,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get payment status';
        return reply.code(500).send({
          code: 'INTERNAL_ERROR',
          message,
        });
      }
    }
  );
}
