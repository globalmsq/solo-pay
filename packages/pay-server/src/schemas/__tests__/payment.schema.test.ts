import { describe, it, expect } from 'vitest';
import { CreatePaymentSchema } from '../payment.schema';

describe('payment.schema.ts - CreatePaymentSchema', () => {
  const validPayload = {
    merchantId: 'merchant_001',
    amount: 100,
    chainId: 80002,
    tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
    recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  };

  describe('Valid payloads', () => {
    it('should accept valid payment with chainId and tokenAddress', () => {
      const result = CreatePaymentSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.amount).toBe(100);
        expect(result.data.chainId).toBe(80002);
        expect(result.data.tokenAddress).toBe('0xE4C687167705Abf55d709395f92e254bdF5825a2');
      }
    });

    it('should accept valid payment with chainId 31337 (Hardhat)', () => {
      const payload = {
        ...validPayload,
        chainId: 31337,
        tokenAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      };
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(true);
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

    it('should reject missing tokenAddress', () => {
      const payload = { ...validPayload };
      delete (payload as Partial<typeof validPayload>).tokenAddress;
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject invalid tokenAddress format', () => {
      const payload = { ...validPayload, tokenAddress: 'invalid' };
      const result = CreatePaymentSchema.safeParse(payload);
      expect(result.success).toBe(false);
    });

    it('should reject missing chainId', () => {
      const payload = { ...validPayload };
      delete (payload as Partial<typeof validPayload>).chainId;
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
      delete (payload as Partial<typeof validPayload>).recipientAddress;
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
      testCases.forEach((address) => {
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
      testAddresses.forEach((address) => {
        const payload = { ...validPayload, recipientAddress: address };
        const result = CreatePaymentSchema.safeParse(payload);
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Schema field requirements', () => {
    it('should have required fields: merchantId, amount, chainId, tokenAddress, recipientAddress', () => {
      const schema = CreatePaymentSchema.shape;
      expect(schema).toHaveProperty('merchantId');
      expect(schema).toHaveProperty('amount');
      expect(schema).toHaveProperty('chainId');
      expect(schema).toHaveProperty('tokenAddress');
      expect(schema).toHaveProperty('recipientAddress');
    });

    it('should NOT require userId field (not in schema)', () => {
      // userId는 스키마에 없음
      const schema = CreatePaymentSchema.shape;
      expect(schema).not.toHaveProperty('userId');
    });

    it('should NOT have currency field (removed from schema)', () => {
      // currency는 스키마에서 제거됨, tokenAddress 사용
      const schema = CreatePaymentSchema.shape;
      expect(schema).not.toHaveProperty('currency');
    });

    it('should require tokenAddress field', () => {
      // tokenAddress는 필수 필드
      const payloadWithoutToken = { ...validPayload };
      delete (payloadWithoutToken as Partial<typeof validPayload>).tokenAddress;
      const result = CreatePaymentSchema.safeParse(payloadWithoutToken);
      expect(result.success).toBe(false);
    });
  });
});
