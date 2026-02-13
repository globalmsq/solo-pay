import { describe, it, expect } from 'vitest';
import { CreatePaymentSchema } from '../payment.schema';

describe('payment.schema.ts - CreatePaymentSchema', () => {
  const validPayload = {
    orderId: 'order_001',
    amount: 100,
    tokenAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    successUrl: 'https://example.com/success',
    failUrl: 'https://example.com/fail',
  };

  describe('Valid payloads', () => {
    it('should accept valid payment with orderId, amount, successUrl, failUrl', () => {
      const result = CreatePaymentSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.orderId).toBe('order_001');
        expect(result.data.amount).toBe(100);
        expect(result.data.successUrl).toBe('https://example.com/success');
        expect(result.data.failUrl).toBe('https://example.com/fail');
      }
    });

    it('should accept valid payment with tokenAddress and optional webhookUrl', () => {
      const payload = { ...validPayload, webhookUrl: 'https://example.com/webhook' };
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.webhookUrl).toBe('https://example.com/webhook');
      }
    });

    it('should accept different amounts', () => {
      const testCases = [0.1, 1, 100, 1000, 999999999];
      testCases.forEach((amount) => {
        const payload = { ...validPayload, amount };
        const result = CreatePaymentSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Invalid payloads', () => {
    it('should reject missing amount', () => {
      const payload = { ...validPayload };
      delete (payload as Partial<typeof validPayload>).amount;
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject negative amount', () => {
      const payload = { ...validPayload, amount: -100 };
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject zero amount', () => {
      const payload = { ...validPayload, amount: 0 };
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject missing orderId', () => {
      const payload = { ...validPayload };
      delete (payload as Partial<typeof validPayload>).orderId;
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject empty orderId', () => {
      const payload = { ...validPayload, orderId: '' };
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject invalid successUrl', () => {
      const payload = { ...validPayload, successUrl: 'not-a-url' };
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject missing successUrl', () => {
      const payload = { ...validPayload };
      delete (payload as Partial<typeof validPayload>).successUrl;
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject invalid failUrl', () => {
      const payload = { ...validPayload, failUrl: 'not-a-url' };
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject missing failUrl', () => {
      const payload = { ...validPayload };
      delete (payload as Partial<typeof validPayload>).failUrl;
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject payload with unknown keys (strict)', () => {
      const payload = { ...validPayload, unknownField: 'value' };
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject missing tokenAddress', () => {
      const rest = {
        orderId: validPayload.orderId,
        amount: validPayload.amount,
        successUrl: validPayload.successUrl,
        failUrl: validPayload.failUrl,
      };
      const result = CreatePaymentSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    it('should reject invalid tokenAddress format', () => {
      const payload = { ...validPayload, tokenAddress: 'not-an-address' };
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });
  });

  describe('Schema field requirements', () => {
    it('should have required fields: orderId, amount, successUrl, failUrl', () => {
      const schema = CreatePaymentSchema.shape;
      expect(schema).toHaveProperty('orderId');
      expect(schema).toHaveProperty('amount');
      expect(schema).toHaveProperty('successUrl');
      expect(schema).toHaveProperty('failUrl');
    });

    it('should have optional webhookUrl field', () => {
      const schema = CreatePaymentSchema.shape;
      expect(schema).toHaveProperty('webhookUrl');
    });

    it('should have tokenAddress and NOT have merchantId, chainId', () => {
      const schema = CreatePaymentSchema.shape;
      expect(schema).toHaveProperty('tokenAddress');
      expect(schema).not.toHaveProperty('merchantId');
      expect(schema).not.toHaveProperty('chainId');
    });
  });
});
