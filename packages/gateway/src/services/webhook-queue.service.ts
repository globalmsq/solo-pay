import type { Payment } from '@prisma/client';
import type { Merchant } from '@prisma/client';
import type { PaymentConfirmedBody, WebhookJobData } from '@solo-pay/webhook-manager';

export interface WebhookQueueAdapter {
  addPaymentConfirmed(data: WebhookJobData): Promise<void>;
}

/**
 * Resolve webhook URL: payment.webhook_url ?? merchant.webhook_url.
 * Returns null if neither is set.
 */
export function resolveWebhookUrl(payment: Payment, merchant: Merchant | null): string | null {
  if (payment.webhook_url) return payment.webhook_url;
  if (merchant?.webhook_url) return merchant.webhook_url;
  return null;
}

/**
 * Build payment.confirmed body for webhook POST.
 */
export function buildPaymentConfirmedBody(payment: Payment): PaymentConfirmedBody {
  return {
    paymentId: payment.payment_hash,
    orderId: payment.order_id ?? null,
    status: payment.status,
    txHash: payment.tx_hash ?? null,
    amount: payment.amount.toString(),
    tokenSymbol: payment.token_symbol,
    confirmedAt: payment.confirmed_at?.toISOString() ?? new Date().toISOString(),
  };
}
