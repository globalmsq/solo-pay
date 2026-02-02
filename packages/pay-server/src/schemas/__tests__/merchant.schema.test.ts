import { describe, it, expect } from 'vitest';
import { UpdateMerchantSchema } from '../merchant.schema';

describe('UpdateMerchantSchema', () => {
  describe('Valid payloads', () => {
    it('should accept name only', () => {
      expect(UpdateMerchantSchema.parse({ name: 'New Name' })).toEqual({ name: 'New Name' });
    });

    it('should accept webhook_url only', () => {
      expect(UpdateMerchantSchema.parse({ webhook_url: 'https://example.com/webhook' })).toEqual({
        webhook_url: 'https://example.com/webhook',
      });
    });

    it('should accept chain_id only', () => {
      expect(UpdateMerchantSchema.parse({ chain_id: 1 })).toEqual({ chain_id: 1 });
    });

    it('should accept multiple fields', () => {
      const payload = {
        name: 'Acme',
        chain_id: 137,
        webhook_url: 'https://api.acme.com/webhook',
      };
      expect(UpdateMerchantSchema.parse(payload)).toEqual(payload);
    });

    it('should accept empty object (all fields optional)', () => {
      expect(UpdateMerchantSchema.parse({})).toEqual({});
    });
  });

  describe('Block merchant_key and unknown keys', () => {
    it('should reject merchant_key (not updatable via API)', () => {
      expect(() =>
        UpdateMerchantSchema.parse({ name: 'OK', merchant_key: 'attempted_change' })
      ).toThrow();
    });

    it('should reject unknown keys', () => {
      expect(() => UpdateMerchantSchema.parse({ name: 'OK', unknown_field: 'x' })).toThrow();
    });

    it('should reject body with only merchant_key', () => {
      expect(() => UpdateMerchantSchema.parse({ merchant_key: 'new_key' })).toThrow();
    });
  });

  describe('Invalid field values', () => {
    it('should reject empty name', () => {
      expect(() => UpdateMerchantSchema.parse({ name: '' })).toThrow();
    });

    it('should reject zero chain_id', () => {
      expect(() => UpdateMerchantSchema.parse({ chain_id: 0 })).toThrow();
    });

    it('should reject negative chain_id', () => {
      expect(() => UpdateMerchantSchema.parse({ chain_id: -1 })).toThrow();
    });

    it('should reject non-integer chain_id', () => {
      expect(() => UpdateMerchantSchema.parse({ chain_id: 1.5 })).toThrow();
    });

    it('should reject invalid webhook_url', () => {
      expect(() => UpdateMerchantSchema.parse({ webhook_url: 'not-a-url' })).toThrow();
    });

    it('should reject webhook_url without protocol', () => {
      expect(() => UpdateMerchantSchema.parse({ webhook_url: 'example.com/webhook' })).toThrow();
    });
  });
});
