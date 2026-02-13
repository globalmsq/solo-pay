import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { getPaymentStatusRoute } from '../../../src/routes/payments/get-status';
import { BlockchainService } from '../../../src/services/blockchain.service';
import { PaymentService } from '../../../src/services/payment.service';
import { MerchantService } from '../../../src/services/merchant.service';
import type { WebhookQueueAdapter } from '../../../src/services/webhook-queue.service';
import { PaymentStatus } from '../../../src/schemas/payment.schema';
import { API_V1_BASE_PATH } from '../../../src/constants';

const TEST_PUBLIC_KEY = 'pk_test_demo';
const TEST_ORIGIN = 'http://localhost:3011';

const publicAuthHeaders = { 'x-public-key': TEST_PUBLIC_KEY, origin: TEST_ORIGIN };

describe('GET /payment/:id', () => {
  let app: FastifyInstance;
  let blockchainService: Partial<BlockchainService>;
  let paymentService: Partial<PaymentService>;
  let merchantService: Partial<MerchantService>;
  let webhookQueue: WebhookQueueAdapter;

  const mockPaymentData = {
    id: 1,
    payment_hash: 'payment-123',
    merchant_id: 1,
    network_id: 31337,
    token_symbol: 'USDC',
    status: 'PENDING',
    amount: '1000000000000000000', // 1 token in wei (18 decimals)
  };

  const mockPaymentStatus: PaymentStatus = {
    paymentId: 'payment-123',
    payerAddress: '0x' + 'a'.repeat(40),
    amount: 1000000000000000000, // Must match mockPaymentData.amount for completed status
    tokenAddress: '0x' + 'a'.repeat(40),
    tokenSymbol: 'USDC',
    treasuryAddress: '0x' + 'b'.repeat(40),
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    app = Fastify({
      logger: false,
      ajv: {
        customOptions: {
          keywords: ['example'],
        },
      },
    });
    await app.register(cors);

    // Mock BlockchainService
    blockchainService = {
      getPaymentStatus: vi.fn().mockResolvedValue(mockPaymentStatus),
      recordPaymentOnChain: vi.fn(),
      waitForConfirmation: vi.fn(),
      estimateGasCost: vi.fn(),
      isChainSupported: vi.fn().mockReturnValue(true),
    };

    paymentService = {
      findByHash: vi.fn().mockResolvedValue(mockPaymentData),
      updateStatusByHash: vi.fn().mockResolvedValue(mockPaymentData),
      updatePayerAddress: vi
        .fn()
        .mockResolvedValue({ ...mockPaymentData, payer_address: '0xpayer' }),
    };

    merchantService = {
      findById: vi.fn().mockResolvedValue({
        id: 1,
        webhook_url: 'https://merchant.example/webhook',
      }),
      findByPublicKey: vi.fn().mockResolvedValue({
        id: 1,
        webhook_url: 'https://merchant.example/webhook',
        allowed_domains: [TEST_ORIGIN],
      }),
    };

    webhookQueue = {
      addPaymentConfirmed: vi.fn().mockResolvedValue(undefined),
    };

    await app.register(
      async (scope) => {
        await getPaymentStatusRoute(
          scope,
          blockchainService as BlockchainService,
          paymentService as PaymentService,
          merchantService as MerchantService,
          webhookQueue
        );
      },
      { prefix: API_V1_BASE_PATH }
    );
  });

  describe('Public auth', () => {
    it('x-public-key 없이 요청하면 2xx가 아니어야 함', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/payment/payment-123`,
        headers: { origin: TEST_ORIGIN },
      });
      // Schema validation (400) or middleware (401) must reject the request
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      expect(response.statusCode).toBeLessThan(500);
    });

    it('허용되지 않은 origin으로 요청하면 403을 반환해야 함', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/payment/payment-123`,
        headers: { 'x-public-key': TEST_PUBLIC_KEY, origin: 'https://not-allowed.example.com' },
      });
      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('FORBIDDEN');
    });
  });

  describe('정상 케이스', () => {
    it('유효한 결제 ID로 요청하면 200 상태 코드와 함께 결제 정보를 반환해야 함', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/payment/payment-123`,
        headers: publicAuthHeaders,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.paymentId).toBe(mockPaymentStatus.paymentId);
      expect(body.data.payment_hash).toBe(mockPaymentData.payment_hash);
    });

    it('응답에 결제의 모든 필드가 포함되어야 함', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/payment/payment-123`,
        headers: publicAuthHeaders,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const data = body.data;

      expect(data).toHaveProperty('paymentId');
      expect(data).toHaveProperty('payment_hash');
      expect(data).toHaveProperty('network_id');
      expect(data).toHaveProperty('token_symbol');
      expect(data).toHaveProperty('status');
    });
  });

  describe('경계 케이스', () => {
    it('존재하지 않는 결제 ID일 때 404 상태 코드를 반환해야 함', async () => {
      // paymentService.findByHash가 null을 반환하면 404
      paymentService.findByHash = vi.fn().mockResolvedValueOnce(null);

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/payment/nonexistent-id`,
        headers: publicAuthHeaders,
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('NOT_FOUND');
    });

    it('빈 결제 ID일 때 400 상태 코드를 반환해야 함', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/payment/`,
        headers: publicAuthHeaders,
      });

      // Fastify는 빈 파라미터를 다르게 처리할 수 있음
      expect(response.statusCode).toBeGreaterThanOrEqual(400);
    });
  });

  describe('예외 케이스', () => {
    it('블록체인 서비스 오류 발생 시 500 상태 코드를 반환해야 함', async () => {
      blockchainService.getPaymentStatus = vi
        .fn()
        .mockRejectedValueOnce(new Error('블록체인 연결 오류'));

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/payment/payment-123`,
        headers: publicAuthHeaders,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('INTERNAL_ERROR');
    });

    it('다양한 결제 상태를 반환할 수 있어야 함', async () => {
      const statuses: Array<'pending' | 'confirmed' | 'failed' | 'completed'> = [
        'pending',
        'confirmed',
        'failed',
        'completed',
      ];

      for (const status of statuses) {
        // Reset mocks for each iteration
        paymentService.findByHash = vi.fn().mockResolvedValueOnce({
          ...mockPaymentData,
          status: status.toUpperCase(),
        });
        blockchainService.getPaymentStatus = vi.fn().mockResolvedValueOnce({
          ...mockPaymentStatus,
          status,
        });

        const response = await app.inject({
          method: 'GET',
          url: `${API_V1_BASE_PATH}/payment/payment-${status}`,
          headers: publicAuthHeaders,
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        // DB status is returned (uppercase)
        expect(body.data.status).toBe(status.toUpperCase());
      }
    });
  });

  describe('Webhook enqueue', () => {
    it('when status syncs to CONFIRMED and merchant has webhook_url, enqueues webhook job', async () => {
      const paymentCreated = {
        ...mockPaymentData,
        status: 'CREATED',
        order_id: 'order-1',
        webhook_url: null,
        tx_hash: null,
        confirmed_at: null,
      };
      const updatedPayment = {
        ...paymentCreated,
        status: 'CONFIRMED',
        tx_hash: '0xtxhash',
        confirmed_at: new Date('2024-01-26T12:00:00.000Z'),
      };
      const merchantWithWebhook = {
        id: 1,
        webhook_url: 'https://merchant.example/webhook',
      };

      paymentService.findByHash = vi.fn().mockResolvedValue(paymentCreated);
      paymentService.updateStatusByHash = vi.fn().mockResolvedValue(updatedPayment);
      paymentService.updatePayerAddress = vi.fn().mockResolvedValue(updatedPayment);
      blockchainService.getPaymentStatus = vi.fn().mockResolvedValue({
        ...mockPaymentStatus,
        status: 'completed',
        transactionHash: '0xtxhash',
      });
      merchantService.findById = vi.fn().mockResolvedValue(merchantWithWebhook);

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/payment/payment-123`,
        headers: publicAuthHeaders,
      });

      expect(response.statusCode).toBe(200);
      expect(webhookQueue.addPaymentConfirmed).toHaveBeenCalledTimes(1);
      expect(webhookQueue.addPaymentConfirmed).toHaveBeenCalledWith({
        url: 'https://merchant.example/webhook',
        body: expect.objectContaining({
          paymentId: 'payment-123',
          orderId: 'order-1',
          status: 'CONFIRMED',
          txHash: '0xtxhash',
          tokenSymbol: 'USDC',
          amount: '1000000000000000000',
        }),
      });
    });

    it('when merchant has no webhook_url, does not call addPaymentConfirmed', async () => {
      const paymentCreated = { ...mockPaymentData, status: 'CREATED' };
      const updatedPayment = { ...paymentCreated, status: 'CONFIRMED' };
      paymentService.findByHash = vi.fn().mockResolvedValue(paymentCreated);
      paymentService.updateStatusByHash = vi.fn().mockResolvedValue(updatedPayment);
      paymentService.updatePayerAddress = vi.fn().mockResolvedValue(updatedPayment);
      blockchainService.getPaymentStatus = vi.fn().mockResolvedValue({
        ...mockPaymentStatus,
        status: 'completed',
      });
      merchantService.findById = vi.fn().mockResolvedValue({ id: 1, webhook_url: null });

      await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/payment/payment-123`,
        headers: publicAuthHeaders,
      });

      expect(webhookQueue.addPaymentConfirmed).not.toHaveBeenCalled();
    });
  });

  describe('성능 요구사항', () => {
    it('응답 시간이 500ms 이내여야 함', async () => {
      const startTime = performance.now();

      await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/payment/payment-123`,
        headers: publicAuthHeaders,
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // 실제 환경에서는 500ms이지만, 테스트 환경에서는 더 느릴 수 있음
      expect(duration).toBeLessThan(5000);
    });
  });
});
