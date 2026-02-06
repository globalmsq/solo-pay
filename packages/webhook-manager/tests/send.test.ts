import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendWebhook } from '../src/send';

const sampleBody = {
  paymentId: '0xabc',
  orderId: 'order-1',
  status: 'CONFIRMED',
  txHash: '0xtx',
  amount: '1000000',
  tokenSymbol: 'USDC',
  confirmedAt: '2024-01-26T12:00:00.000Z',
};

describe('sendWebhook', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  it('returns ok when server returns 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });

    const p = sendWebhook('https://example.com/webhook', sampleBody);
    await vi.runAllTimersAsync();
    const result = await p;

    expect(result.ok).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sampleBody),
      })
    );
  });

  it('returns ok when server returns 201', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 201 });

    const result = await sendWebhook('https://example.com/webhook', sampleBody);

    expect(result.ok).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries on non-2xx and returns ok: false after 3 retries', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    const p = sendWebhook('https://example.com/webhook', sampleBody);
    await vi.runAllTimersAsync();
    const result = await p;

    expect(result.ok).toBe(false);
    expect(result.error).toBe('HTTP 500');
    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
  });

  it('retries on network error and returns ok: false after retries exhausted', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const p = sendWebhook('https://example.com/webhook', sampleBody);
    await vi.runAllTimersAsync();
    const result = await p;

    expect(result.ok).toBe(false);
    expect(result.error).toBe('ECONNREFUSED');
    expect(globalThis.fetch).toHaveBeenCalledTimes(4);
  });

  it('succeeds on second attempt after first 500', async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const p = sendWebhook('https://example.com/webhook', sampleBody);
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await p;

    expect(result.ok).toBe(true);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });
});
