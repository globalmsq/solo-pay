import { FastifyInstance } from 'fastify';
import { Payment } from '@solo-pay/database';
import { BlockchainService } from '../../services/blockchain.service';
import { PaymentService } from '../../services/payment.service';
import { createMerchantAuthMiddleware } from '../../middleware/auth.middleware';
import { MerchantService } from '../../services/merchant.service';
import {
  enqueuePaymentConfirmedWebhook,
  type WebhookQueueAdapter,
} from '../../services/webhook-queue.service';
import { ErrorResponseSchema } from '../../docs/schemas';

/**
 * Syncs payment status from blockchain: if on-chain status is completed and DB status is
 * CREATED or PENDING, updates DB to CONFIRMED and mutates the payment object in place.
 * @returns true if status was updated to CONFIRMED (caller may enqueue webhook).
 */
async function syncPaymentStatusFromChain(
  blockchainService: BlockchainService,
  paymentService: PaymentService,
  payment: Payment
): Promise<boolean> {
  const chainId = payment.network_id;
  if (!blockchainService.isChainSupported(chainId)) {
    return false;
  }
  const paymentStatus = await blockchainService.getPaymentStatus(chainId, payment.payment_hash);
  if (paymentStatus?.status === 'completed' && ['CREATED', 'PENDING'].includes(payment.status)) {
    const updated = await paymentService.updateStatusByHash(
      payment.payment_hash,
      'CONFIRMED',
      paymentStatus.transactionHash ?? undefined
    );
    payment.status = updated.status;
    payment.tx_hash = updated.tx_hash;
    payment.confirmed_at = updated.confirmed_at ?? payment.confirmed_at;
    if (paymentStatus.payerAddress) {
      const withPayer = await paymentService.updatePayerAddress(
        payment.payment_hash,
        paymentStatus.payerAddress
      );
      payment.payer_address = withPayer.payer_address ?? payment.payer_address;
    }
    return true;
  }
  return false;
}

function buildPaymentDetailResponse(payment: {
  payment_hash: string;
  order_id: string | null;
  status: string;
  amount: { toString: () => string };
  token_symbol: string;
  token_decimals: number;
  tx_hash: string | null;
  payer_address: string | null;
  created_at: Date;
  confirmed_at: Date | null;
  expires_at: Date;
}) {
  return {
    paymentId: payment.payment_hash,
    orderId: payment.order_id ?? undefined,
    status: payment.status,
    amount: payment.amount.toString(),
    tokenSymbol: payment.token_symbol,
    tokenDecimals: payment.token_decimals,
    txHash: payment.tx_hash ?? undefined,
    payerAddress: payment.payer_address ?? undefined,
    createdAt: payment.created_at.toISOString(),
    confirmedAt: payment.confirmed_at?.toISOString() ?? undefined,
    expiresAt: payment.expires_at.toISOString(),
  };
}

export async function paymentDetailRoute(
  app: FastifyInstance,
  blockchainService: BlockchainService,
  merchantService: MerchantService,
  paymentService: PaymentService,
  webhookQueue: WebhookQueueAdapter
) {
  const authMiddleware = createMerchantAuthMiddleware(merchantService);

  const detailResponseSchema = {
    type: 'object',
    properties: {
      paymentId: { type: 'string' },
      orderId: { type: 'string' },
      status: { type: 'string', enum: ['CREATED', 'PENDING', 'CONFIRMED', 'FAILED', 'EXPIRED'] },
      amount: { type: 'string', description: 'Wei' },
      tokenSymbol: { type: 'string' },
      tokenDecimals: { type: 'integer' },
      txHash: { type: 'string' },
      payerAddress: { type: 'string' },
      createdAt: { type: 'string', format: 'date-time' },
      confirmedAt: { type: 'string', format: 'date-time' },
      expiresAt: { type: 'string', format: 'date-time' },
    },
  };

  // GET /payments?orderId=xxx – API Key, findByOrderId (static route first)
  app.get<{ Querystring: { orderId?: string } }>(
    '/payments',
    {
      schema: {
        operationId: 'getPaymentByOrderId',
        tags: ['Payments'],
        summary: 'Get payment by order ID',
        description: `
Retrieves payment by merchant order ID. API Key required. Same response format as GET /payments/:paymentId.
        `,
        security: [{ ApiKeyAuth: [] }],
        querystring: {
          type: 'object',
          properties: { orderId: { type: 'string', description: 'Merchant order ID' } },
          required: ['orderId'],
        },
        response: {
          200: detailResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          404: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
      preHandler: authMiddleware,
    },
    async (request, reply) => {
      try {
        const { orderId } = request.query;
        const merchant = (request as { merchant?: { id: number } }).merchant;
        if (!merchant) {
          return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Authentication required' });
        }

        if (!orderId || typeof orderId !== 'string') {
          return reply.code(400).send({
            code: 'INVALID_REQUEST',
            message: 'orderId query parameter is required',
          });
        }

        const payment = await paymentService.findByOrderId(orderId, merchant.id);
        if (!payment) {
          return reply.code(404).send({
            code: 'NOT_FOUND',
            message: 'Payment not found for this order ID',
          });
        }

        const statusJustConfirmed = await syncPaymentStatusFromChain(
          blockchainService,
          paymentService,
          payment
        );
        if (statusJustConfirmed && payment.status === 'CONFIRMED') {
          const merchantForWebhook = await merchantService.findById(payment.merchant_id);
          enqueuePaymentConfirmedWebhook(
            webhookQueue,
            payment,
            merchantForWebhook,
            (err, paymentId) => app.log.warn({ err, paymentId }, 'Webhook enqueue failed')
          );
        }

        return reply.code(200).send(buildPaymentDetailResponse(payment));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get payment';
        return reply.code(500).send({ code: 'INTERNAL_ERROR', message });
      }
    }
  );

  // GET /payments/:paymentId – API Key, merchant ownership, sync status (parameterized)
  app.get<{ Params: { paymentId: string } }>(
    '/payments/:paymentId',
    {
      schema: {
        operationId: 'getPaymentById',
        tags: ['Payments'],
        summary: 'Get payment by ID (API Key, merchant verification)',
        description: `
Retrieves payment by payment hash. API Key required. Validates payment belongs to merchant.
Syncs latest status from blockchain.
        `,
        security: [{ ApiKeyAuth: [] }],
        params: {
          type: 'object',
          properties: { paymentId: { type: 'string', description: 'Payment hash' } },
          required: ['paymentId'],
        },
        response: {
          200: detailResponseSchema,
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
        const { paymentId } = request.params;
        const merchant = (request as { merchant?: { id: number } }).merchant;
        if (!merchant) {
          return reply.code(401).send({ code: 'UNAUTHORIZED', message: 'Authentication required' });
        }

        const payment = await paymentService.findByHash(paymentId);
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

        const statusJustConfirmed = await syncPaymentStatusFromChain(
          blockchainService,
          paymentService,
          payment
        );
        if (statusJustConfirmed && payment.status === 'CONFIRMED') {
          const merchantForWebhook = await merchantService.findById(payment.merchant_id);
          enqueuePaymentConfirmedWebhook(
            webhookQueue,
            payment,
            merchantForWebhook,
            (err, paymentId) => app.log.warn({ err, paymentId }, 'Webhook enqueue failed')
          );
        }

        return reply.code(200).send(buildPaymentDetailResponse(payment));
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get payment';
        return reply.code(500).send({ code: 'INTERNAL_ERROR', message });
      }
    }
  );
}
