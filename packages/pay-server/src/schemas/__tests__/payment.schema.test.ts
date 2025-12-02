import { describe, it, expect } from 'vitest';
import { CreatePaymentSchema } from '../payment.schema';

describe('payment.schema.ts - CreatePaymentSchema', () => {
  const validPayload = {
    amount: 100,
    currency: 'SUT',
    chainId: 80002,
    recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  };

  describe('Valid payloads', () => {
    it('should accept valid payment with chainId and currency', () => {
      const result = CreatePaymentSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(100);
        expect(result.data.currency).toBe('SUT');
        expect(result.data.chainId).toBe(80002);
      }
    });

    it('should accept valid payment with chainId 31337 (Hardhat)', () => {
      const payload = { ...validPayload, chainId: 31337, currency: 'TEST' };
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(true);
    });

    it('should accept different amounts', () => {
      const testCases = [0.1, 1, 100, 1000, 999999999];
      testCases.forEach(amount => {
        const payload = { ...validPayload, amount };
        const result = CreatePaymentSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Invalid payloads', () => {
    it('should reject missing amount', () => {
      const payload = { ...validPayload };
      delete (payload as any).amount;
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

    it('should reject missing currency', () => {
      const payload = { ...validPayload };
      delete (payload as any).currency;
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject empty currency string', () => {
      const payload = { ...validPayload, currency: '' };
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject missing chainId', () => {
      const payload = { ...validPayload };
      delete (payload as any).chainId;
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject negative chainId', () => {
      const payload = { ...validPayload, chainId: -1 };
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject zero chainId', () => {
      const payload = { ...validPayload, chainId: 0 };
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject non-integer chainId', () => {
      const payload = { ...validPayload, chainId: 80002.5 };
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject missing recipientAddress', () => {
      const payload = { ...validPayload };
      delete (payload as any).recipientAddress;
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject invalid recipientAddress format', () => {
      const testCases = [
        'invalid-address',
        '0x123', // too short
        '0x' + 'a'.repeat(41), // 41 chars (should be 40)
        'x' + 'a'.repeat(40), // missing 0x
      ];
      testCases.forEach(address => {
        const payload = { ...validPayload, recipientAddress: address };
        const result = CreatePaymentSchema.safeParse(payload);
        expect(result.success).toBe(false);
      });
    });

    it('should accept valid Ethereum addresses (0x + 40 hex chars)', () => {
      const testAddresses = [
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        '0x0000000000000000000000000000000000000000',
        '0xffffffffffffffffffffffffffffffffffffffff',
        '0x1234567890abcdef1234567890abcdef12345678',
      ];
      testAddresses.forEach(address => {
        const payload = { ...validPayload, recipientAddress: address };
        const result = CreatePaymentSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Schema field requirements', () => {
    it('should have required fields: amount, currency, chainId, recipientAddress', () => {
      const schema = CreatePaymentSchema.shape;
      expect(schema).toHaveProperty('amount');
      expect(schema).toHaveProperty('currency');
      expect(schema).toHaveProperty('chainId');
      expect(schema).toHaveProperty('recipientAddress');
    });

    it('should NOT require userId field (changed from old schema)', () => {
      // userId는 제거되어야 함
      const payload = validPayload;
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as any).userId).toBeUndefined();
      }
    });

    it('should NOT require tokenAddress field (changed from old schema)', () => {
      // tokenAddress는 서버가 chainId와 currency로부터 조회하므로 제거
      const payload = validPayload;
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect((result.data as any).tokenAddress).toBeUndefined();
      }
    });
  });
});
