/**
 * API Client Tests
 * Test suite for payment API client functions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createPayment, CreatePaymentRequest, ApiErrorCode } from './api';

// Mock fetch globally
global.fetch = vi.fn();

describe('createPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const validRequest: CreatePaymentRequest = {
    orderId: 'order-123',
    amount: 100,
    successUrl: 'https://example.com/success',
    failUrl: 'https://example.com/fail',
  };

  const mockCreateResponse = {
    paymentId: 'payment-123',
    orderId: 'order-123',
    serverSignature: '0x',
    chainId: 80002,
    tokenAddress: '0x1234567890123456789012345678901234567890',
    gatewayAddress: '0x0987654321098765432109876543210987654321',
    amount: '1000000000000000000',
    tokenDecimals: 18,
    tokenSymbol: 'SUT',
    successUrl: 'https://example.com/success',
    failUrl: 'https://example.com/fail',
    expiresAt: new Date().toISOString(),
    recipientAddress: '0x',
    merchantId: '0x',
    feeBps: 0,
    forwarderAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
  };

  it('should create a payment with valid request parameters', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockCreateResponse,
    });

    const result = await createPayment(validRequest);

    expect(result.success).toBe(true);
    expect(result.data?.paymentId).toBe('payment-123');
    expect(result.data?.tokenAddress).toBe(mockCreateResponse.tokenAddress);
    expect(result.data?.gatewayAddress).toBe(mockCreateResponse.gatewayAddress);
  });

  it('should return VALIDATION_ERROR for empty orderId', async () => {
    const result = await createPayment({
      ...validRequest,
      orderId: '',
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe(ApiErrorCode.VALIDATION_ERROR);
  });

  it('should return VALIDATION_ERROR for non-positive amount', async () => {
    const result = await createPayment({
      ...validRequest,
      amount: 0,
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe(ApiErrorCode.VALIDATION_ERROR);
  });

  it('should return VALIDATION_ERROR for invalid successUrl', async () => {
    const result = await createPayment({
      ...validRequest,
      successUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe(ApiErrorCode.VALIDATION_ERROR);
  });

  it('should return VALIDATION_ERROR for empty failUrl', async () => {
    const result = await createPayment({
      ...validRequest,
      failUrl: '',
    });
    expect(result.success).toBe(false);
    expect(result.code).toBe(ApiErrorCode.VALIDATION_ERROR);
  });

  it('should retry on 5xx errors and succeed after 2 failures', async () => {
    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Server error' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Server error' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockCreateResponse,
      });

    const result = await createPayment(validRequest);

    expect(result.success).toBe(true);
    expect(result.data?.paymentId).toBe('payment-123');
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should return error after 3 consecutive 5xx errors', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: 'Server error' }),
    });

    const result = await createPayment(validRequest);

    expect(result.success).toBe(false);
    expect(result.code).toBe(ApiErrorCode.SERVER_ERROR);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should not retry on 4xx errors and return immediately', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Bad request', code: 'INVALID_REQUEST' }),
    });

    const result = await createPayment(validRequest);

    expect(result.success).toBe(false);
    expect(result.code).toBe(ApiErrorCode.CLIENT_ERROR);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
