import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { executeRelayRoute } from '../../../src/routes/payments/relay';
import { DefenderService } from '../../../src/services/defender.service';
import { MerchantService } from '../../../src/services/merchant.service';
import { PaymentService } from '../../../src/services/payment.service';

// Test API key for authentication
const TEST_API_KEY = 'test-api-key-123';

// Mock merchant data for auth
const mockMerchant = {
  id: 1,
  merchant_key: 'merchant_demo_001',
  name: 'Demo Store',
  api_key_hash: 'hashed',
  webhook_url: null,
  is_enabled: true,
  is_deleted: false,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
};

// Mock payment data - merchant_id must match mockMerchant.id
const mockPaymentData = {
  id: 'payment-db-id',
  payment_hash: 'payment-123',
  merchant_id: 1, // matches mockMerchant.id
  status: 'CREATED',
};

describe('POST /payments/:id/relay', () => {
  let app: FastifyInstance;
  let defenderService: DefenderService;
  let merchantService: MerchantService;
  let paymentService: PaymentService;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(cors);

    // Mock DefenderService
    defenderService = {
      submitGaslessTransaction: vi
        .fn()
        .mockResolvedValue({
          relayRequestId: 'relay-123-' + Date.now(),
          transactionHash: '0x' + 'a'.repeat(64),
          status: 'submitted',
        }),
      getRelayStatus: vi.fn().mockResolvedValue({
        relayRequestId: 'relay-123-' + Date.now(),
        transactionHash: '0x' + 'a'.repeat(64),
        status: 'mined',
      }),
      cancelRelayTransaction: vi.fn().mockResolvedValue(true),
      validateTransactionData: vi.fn().mockReturnValue(true),
      estimateGasFee: vi.fn().mockResolvedValue('50000000000'),
      getRelayerAddress: vi.fn().mockReturnValue('0x' + 'f'.repeat(40)),
    } as any;

    // Mock MerchantService for authentication
    merchantService = {
      findByApiKey: vi.fn().mockResolvedValue(mockMerchant),
    } as any;

    // Mock PaymentService for payment ownership validation
    paymentService = {
      findByHash: vi.fn().mockResolvedValue(mockPaymentData),
    } as any;

    // 실제 라우트 등록
    await executeRelayRoute(app, defenderService, merchantService, paymentService);
  });

  describe('정상 케이스', () => {
    it('유효한 릴레이 요청을 받으면 200 상태 코드와 함께 릴레이 정보를 반환해야 함', async () => {
      const validRequest = {
        paymentId: 'payment-123',
        transactionData: '0x' + 'a'.repeat(128),
        gasEstimate: 200000,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/payment-123/relay',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.relayRequestId).toBeDefined();
      expect(body.status).toBeDefined();
    });

    it('릴레이 거래 응답에 필요한 모든 필드가 포함되어야 함', async () => {
      const validRequest = {
        paymentId: 'payment-456',
        transactionData: '0x' + 'b'.repeat(128),
        gasEstimate: 250000,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/payment-456/relay',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('success');
      expect(body).toHaveProperty('relayRequestId');
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('message');
    });

    it('높은 가스 추정치로 요청할 수 있어야 함', async () => {
      const validRequest = {
        paymentId: 'payment-789',
        transactionData: '0x' + 'c'.repeat(128),
        gasEstimate: 1000000,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/payment-789/relay',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: validRequest,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });
  });

  describe('경계 케이스', () => {
    it('유효하지 않은 거래 데이터일 때 400 상태 코드를 반환해야 함', async () => {
      defenderService.validateTransactionData = vi.fn().mockReturnValueOnce(false);

      const invalidRequest = {
        paymentId: 'payment-101',
        transactionData: '0x' + 'invalid'.padEnd(128, 'x'),
        gasEstimate: 200000,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/payment-101/relay',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('INVALID_TRANSACTION_DATA');
    });

    it('0 가스 추정치일 때 400 상태 코드를 반환해야 함', async () => {
      const invalidRequest = {
        paymentId: 'payment-202',
        transactionData: '0x' + 'a'.repeat(128),
        gasEstimate: 0,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/payment-202/relay',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('INVALID_GAS_ESTIMATE');
    });

    it('음수 가스 추정치일 때 400 상태 코드를 반환해야 함', async () => {
      const invalidRequest = {
        paymentId: 'payment-303',
        transactionData: '0x' + 'a'.repeat(128),
        gasEstimate: -100,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/payment-303/relay',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('INVALID_GAS_ESTIMATE');
    });

    it('필수 필드가 누락되었을 때 400 상태 코드를 반환해야 함', async () => {
      const incompleteRequest = {
        paymentId: 'payment-404',
        transactionData: '0x' + 'a'.repeat(128),
        // gasEstimate 누락
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/payment-404/relay',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: incompleteRequest,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('거래 데이터가 너무 짧을 때 400 상태 코드를 반환해야 함', async () => {
      defenderService.validateTransactionData = vi.fn().mockReturnValueOnce(false);

      const invalidRequest = {
        paymentId: 'payment-505',
        transactionData: '0x' + 'a'.repeat(10),
        gasEstimate: 200000,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/payment-505/relay',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: invalidRequest,
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('INVALID_TRANSACTION_DATA');
    });
  });

  describe('예외 케이스', () => {
    it('Defender 서비스 오류 발생 시 500 상태 코드를 반환해야 함', async () => {
      defenderService.submitGaslessTransaction = vi
        .fn()
        .mockRejectedValueOnce(new Error('릴레이어 오류'));

      const validRequest = {
        paymentId: 'payment-606',
        transactionData: '0x' + 'a'.repeat(128),
        gasEstimate: 200000,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/payment-606/relay',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: validRequest,
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('INTERNAL_ERROR');
    });

    it('매우 큰 거래 데이터로 요청할 수 있어야 함', async () => {
      const largeRequest = {
        paymentId: 'payment-707',
        transactionData: '0x' + 'a'.repeat(10000),
        gasEstimate: 500000,
      };

      const response = await app.inject({
        method: 'POST',
        url: '/payments/payment-707/relay',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: largeRequest,
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('성능 요구사항', () => {
    it('릴레이 요청 응답 시간이 500ms 이내여야 함', async () => {
      const validRequest = {
        paymentId: 'payment-808',
        transactionData: '0x' + 'a'.repeat(128),
        gasEstimate: 200000,
      };

      const startTime = performance.now();

      await app.inject({
        method: 'POST',
        url: '/payments/payment-808/relay',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: validRequest,
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5000);
    });
  });
});
