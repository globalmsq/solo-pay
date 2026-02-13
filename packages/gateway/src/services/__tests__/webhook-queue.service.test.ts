import { describe, it, expect } from 'vitest';
import type { Payment } from '@solo-pay/database';
import type { Merchant } from '@solo-pay/database';
import { Decimal } from '@solo-pay/database';
import { resolveWebhookUrl, buildPaymentConfirmedBody } from '../webhook-queue.service';

describe('webhook-queue.service', () => {
  const basePayment = {
    id: 1,
    payment_hash: '0xabc',
    merchant_id: 10,
    payment_method_id: 1,
    amount: new Decimal('1000000'),
    token_decimals: 6,
    token_symbol: 'USDC',
    network_id: 31337,
    status: 'CONFIRMED' as const,
    tx_hash: '0xtx',
    expires_at: new Date(),
    confirmed_at: new Date('2024-01-26T12:00:00.000Z'),
    order_id: 'order-1',
    success_url: null,
    fail_url: null,
    webhook_url: null,
    origin: null,
    payer_address: '0xpayer',
    created_at: new Date(),
    updated_at: new Date(),
  } as Payment;

  const baseMerchant = {
    id: 10,
    merchant_key: 'mk_1',
    name: 'Test',
    chain_id: 31337,
    api_key_hash: 'hash',
    public_key: null,
    public_key_hash: null,
    allowed_domains: null,
    is_enabled: true,
    is_deleted: false,
    webhook_url: 'https://merchant.example/webhook',
    fee_bps: 0,
    recipient_address: '0xrecv',
    created_at: new Date(),
    updated_at: new Date(),
    deleted_at: null,
  } as Merchant;

  describe('resolveWebhookUrl', () => {
    it('returns payment.webhook_url when set', () => {
      const payment = { ...basePayment, webhook_url: 'https://payment.example/hook' };
      const merchant = { ...baseMerchant, webhook_url: 'https://merchant.example/webhook' };
      expect(resolveWebhookUrl(payment, merchant)).toBe('https://payment.example/hook');
    });

    it('returns merchant.webhook_url when payment.webhook_url is null', () => {
      const payment = { ...basePayment, webhook_url: null };
      const merchant = { ...baseMerchant, webhook_url: 'https://merchant.example/webhook' };
      expect(resolveWebhookUrl(payment, merchant)).toBe('https://merchant.example/webhook');
    });

    it('returns null when both are null', () => {
      const payment = { ...basePayment, webhook_url: null };
      const merchant = { ...baseMerchant, webhook_url: null };
      expect(resolveWebhookUrl(payment, merchant)).toBeNull();
    });

    it('returns null when merchant is null', () => {
      const payment = { ...basePayment, webhook_url: null };
      expect(resolveWebhookUrl(payment, null)).toBeNull();
    });
  });

  describe('buildPaymentConfirmedBody', () => {
    it('builds body with all required fields', () => {
      const body = buildPaymentConfirmedBody(basePayment);
      expect(body.paymentId).toBe('0xabc');
      expect(body.orderId).toBe('order-1');
      expect(body.status).toBe('CONFIRMED');
      expect(body.txHash).toBe('0xtx');
      expect(body.amount).toBe('1000000');
      expect(body.tokenSymbol).toBe('USDC');
      expect(body.confirmedAt).toBe('2024-01-26T12:00:00.000Z');
    });

    it('uses null for orderId when payment.order_id is null', () => {
      const payment = { ...basePayment, order_id: null };
      const body = buildPaymentConfirmedBody(payment);
      expect(body.orderId).toBeNull();
    });

    it('uses ISO string for confirmedAt when confirmed_at is null', () => {
      const payment = { ...basePayment, confirmed_at: null };
      const body = buildPaymentConfirmedBody(payment);
      expect(body.confirmedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });
});
