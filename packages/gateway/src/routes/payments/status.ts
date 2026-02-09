import { FastifyInstance } from 'fastify';
import { BlockchainService } from '../../services/blockchain.service';
import { PaymentService } from '../../services/payment.service';
import { MerchantService } from '../../services/merchant.service';
import {
  enqueuePaymentConfirmedWebhook,
  type WebhookQueueAdapter,
} from '../../services/webhook-queue.service';
import { PaymentStatusResponseSchema, ErrorResponseSchema } from '../../docs/schemas';

export async function getPaymentStatusRoute(
  app: FastifyInstance,
  blockchainService: BlockchainService,
  paymentService: PaymentService,
  merchantService: MerchantService,
  webhookQueue: WebhookQueueAdapter
) {
  app.get<{
    Params: { id: string };
  }>(
    '/payments/:id/status',
    {
      schema: {
        operationId: 'getPaymentStatus',
        tags: ['Payments'],
        summary: 'Get payment status',
        description: `
Retrieves the current status of a payment by its payment hash.

**Status Values:**
- \`CREATED\` - Payment created, awaiting on-chain transaction
- \`PENDING\` - Transaction submitted, awaiting confirmation
- \`CONFIRMED\` - Payment confirmed on-chain
- \`FAILED\` - Payment failed

**Note:** This endpoint syncs on-chain status with database status.
        `,
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
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params;

        if (!id || typeof id !== 'string') {
          return reply.code(400).send({
            code: 'INVALID_REQUEST',
            message: '결제 ID는 필수입니다',
          });
        }

        // Lookup payment by hash from database
        const paymentData = await paymentService.findByHash(id);

        if (!paymentData) {
          return reply.code(404).send({
            code: 'NOT_FOUND',
            message: '결제 정보를 찾을 수 없습니다',
          });
        }

        // Get chain ID from database snapshot
        const chainIdNum = paymentData.network_id;

        // Check if chain is supported
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
            message: '결제 정보를 찾을 수 없습니다',
          });
        }

        // Validate amount from PaymentCompleted event matches DB amount
        // This detects amount manipulation for all payments (Direct + Gasless)
        if (paymentStatus.status === 'completed' && paymentStatus.amount) {
          const eventAmount = BigInt(paymentStatus.amount);
          const dbAmount = BigInt(paymentData.amount.toString());

          if (eventAmount !== dbAmount) {
            return reply.code(400).send({
              code: 'AMOUNT_MISMATCH',
              message: `결제 금액이 일치하지 않습니다. DB: ${dbAmount.toString()}, 온체인: ${eventAmount.toString()}`,
              details: {
                dbAmount: dbAmount.toString(),
                onChainAmount: eventAmount.toString(),
                paymentId: id,
                transactionHash: paymentStatus.transactionHash,
              },
            });
          }
        }

        // Sync DB status with on-chain status
        // If on-chain payment is completed but DB still shows CREATED/PENDING, update DB
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

          // Enqueue webhook: payment.confirmed (fire-and-forget, do not block response)
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
        const message = error instanceof Error ? error.message : '결제 상태를 조회할 수 없습니다';
        return reply.code(500).send({
          code: 'INTERNAL_ERROR',
          message,
        });
      }
    }
  );
}
