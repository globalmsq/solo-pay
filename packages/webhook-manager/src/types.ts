/**
 * Payload sent to merchant webhook (payment.confirmed).
 * Matches spec: paymentId, orderId, status, txHash, amount, tokenSymbol, confirmedAt.
 */
export interface PaymentConfirmedBody {
  paymentId: string;
  orderId: string | null;
  status: string;
  txHash: string | null;
  amount: string;
  tokenSymbol: string;
  confirmedAt: string;
}

/**
 * Job data for webhook queue: URL and body to POST.
 */
export interface WebhookJobData {
  url: string;
  body: PaymentConfirmedBody;
}

export const WEBHOOK_QUEUE_NAME = 'solo-pay-webhook';
export const JOB_NAME_PAYMENT_CONFIRMED = 'payment.confirmed';
