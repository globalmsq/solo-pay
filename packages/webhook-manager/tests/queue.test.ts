import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createWebhookQueue, WEBHOOK_QUEUE_NAME, JOB_NAME_PAYMENT_CONFIRMED } from '../src/queue';

const mockAdd = vi.fn().mockResolvedValue(undefined);
const mockClose = vi.fn().mockResolvedValue(undefined);

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(function Queue(this: unknown) {
    return { add: mockAdd, close: mockClose };
  }),
  Worker: vi.fn().mockImplementation(function Worker(this: unknown) {
    return { on: vi.fn(), close: vi.fn().mockResolvedValue(undefined) };
  }),
}));

describe('createWebhookQueue', () => {
  const mockRedis = {} as import('ioredis').Redis;

  beforeEach(() => {
    mockAdd.mockClear();
    mockClose.mockClear();
  });

  it('exposes addPaymentConfirmed and close', () => {
    const queue = createWebhookQueue(mockRedis);
    expect(typeof queue.addPaymentConfirmed).toBe('function');
    expect(typeof queue.close).toBe('function');
  });

  it('addPaymentConfirmed calls Queue.add with job name and data', async () => {
    const queue = createWebhookQueue(mockRedis);
    const data = {
      url: 'https://merchant.example/webhook',
      body: {
        paymentId: '0xabc',
        orderId: 'order-1',
        status: 'CONFIRMED',
        txHash: '0xtx',
        amount: '1000000',
        tokenSymbol: 'USDC',
        confirmedAt: '2024-01-26T12:00:00.000Z',
      },
    };
    await queue.addPaymentConfirmed(data);
    expect(mockAdd).toHaveBeenCalledWith(JOB_NAME_PAYMENT_CONFIRMED, data, expect.any(Object));
    await queue.close();
    expect(mockClose).toHaveBeenCalled();
  });
});

describe('constants', () => {
  it('queue name and job name are defined', () => {
    expect(WEBHOOK_QUEUE_NAME).toBe('solo-pay-webhook');
    expect(JOB_NAME_PAYMENT_CONFIRMED).toBe('payment.confirmed');
  });
});
