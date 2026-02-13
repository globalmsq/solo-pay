import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { Decimal } from '@solo-pay/database';
import { getRefundStatusRoute } from '../../../src/routes/refunds/status';
import { MerchantService } from '../../../src/services/merchant.service';
import { PaymentService } from '../../../src/services/payment.service';
import { RefundService } from '../../../src/services/refund.service';
import { API_V1_BASE_PATH } from '../../../src/constants';

const TEST_API_KEY = 'test-api-key-123';

const mockMerchant = {
  id: 1,
  merchant_key: 'merchant_demo_001',
  name: 'Demo Store',
  chain_id: 1,
  api_key_hash: 'hashed',
  public_key: null,
  public_key_hash: null,
  allowed_domains: null,
  webhook_url: null,
  fee_bps: 0,
  recipient_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  is_enabled: true,
  is_deleted: false,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
};

const mockPayment = {
  id: 1,
  payment_hash: '0x' + 'a'.repeat(64),
  merchant_id: 1,
  payment_method_id: 1,
  amount: new Decimal('1000000000000000000'),
  token_decimals: 18,
  token_symbol: 'TEST',
  network_id: 31337,
  status: 'CONFIRMED' as const,
  tx_hash: '0x' + 'b'.repeat(64),
  expires_at: new Date(Date.now() + 3600000),
  confirmed_at: new Date(),
  order_id: 'order-123',
  success_url: null,
  fail_url: null,
  webhook_url: null,
  origin: null,
  payer_address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  created_at: new Date(),
  updated_at: new Date(),
};

const mockRefund = {
  id: 1,
  refund_hash: '0x' + 'c'.repeat(64),
  payment_id: 1,
  merchant_id: 1,
  amount: new Decimal('1000000000000000000'),
  token_address: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
  payer_address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  status: 'PENDING' as const,
  reason: '고객 요청',
  tx_hash: null,
  error_message: null,
  submitted_at: null,
  confirmed_at: null,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('GET /refunds/:refundId', () => {
  let app: FastifyInstance;
  let merchantService: Partial<MerchantService>;
  let paymentService: Partial<PaymentService>;
  let refundService: Partial<RefundService>;

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

    merchantService = {
      findByApiKey: vi.fn().mockResolvedValue(mockMerchant),
    };

    paymentService = {
      findById: vi.fn().mockResolvedValue(mockPayment),
    };

    refundService = {
      findByHash: vi.fn().mockResolvedValue(mockRefund),
    };

    await app.register(
      async (scope) => {
        await getRefundStatusRoute(
          scope,
          merchantService as MerchantService,
          paymentService as PaymentService,
          refundService as RefundService
        );
      },
      { prefix: API_V1_BASE_PATH }
    );
  });

  describe('정상 케이스', () => {
    it('유효한 환불 ID로 조회하면 200 상태 코드와 함께 환불 정보를 반환해야 함', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds/${mockRefund.refund_hash}`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.refundId).toBe(mockRefund.refund_hash);
      expect(body.data.paymentId).toBe(mockPayment.payment_hash);
    });

    it('응답에 환불의 모든 필드가 포함되어야 함', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds/${mockRefund.refund_hash}`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const data = body.data;

      expect(data).toHaveProperty('refundId');
      expect(data).toHaveProperty('paymentId');
      expect(data).toHaveProperty('amount');
      expect(data).toHaveProperty('tokenAddress');
      expect(data).toHaveProperty('tokenSymbol');
      expect(data).toHaveProperty('tokenDecimals');
      expect(data).toHaveProperty('payerAddress');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('reason');
      expect(data).toHaveProperty('txHash');
      expect(data).toHaveProperty('errorMessage');
      expect(data).toHaveProperty('createdAt');
      expect(data).toHaveProperty('submittedAt');
      expect(data).toHaveProperty('confirmedAt');
    });
  });

  describe('다양한 상태 케이스', () => {
    it('PENDING 상태의 환불 정보를 올바르게 반환해야 함', async () => {
      refundService.findByHash = vi.fn().mockResolvedValue({
        ...mockRefund,
        status: 'PENDING',
        tx_hash: null,
        submitted_at: null,
        confirmed_at: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds/${mockRefund.refund_hash}`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.status).toBe('PENDING');
      expect(body.data.txHash).toBeNull();
      expect(body.data.submittedAt).toBeNull();
    });

    it('SUBMITTED 상태의 환불 정보를 올바르게 반환해야 함', async () => {
      const submittedAt = new Date();
      refundService.findByHash = vi.fn().mockResolvedValue({
        ...mockRefund,
        status: 'SUBMITTED',
        tx_hash: '0x' + 'd'.repeat(64),
        submitted_at: submittedAt,
        confirmed_at: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds/${mockRefund.refund_hash}`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.status).toBe('SUBMITTED');
      expect(body.data.txHash).toBe('0x' + 'd'.repeat(64));
      expect(body.data.submittedAt).toBe(submittedAt.toISOString());
    });

    it('CONFIRMED 상태의 환불 정보를 올바르게 반환해야 함', async () => {
      const submittedAt = new Date(Date.now() - 60000);
      const confirmedAt = new Date();
      refundService.findByHash = vi.fn().mockResolvedValue({
        ...mockRefund,
        status: 'CONFIRMED',
        tx_hash: '0x' + 'e'.repeat(64),
        submitted_at: submittedAt,
        confirmed_at: confirmedAt,
      });

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds/${mockRefund.refund_hash}`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.status).toBe('CONFIRMED');
      expect(body.data.confirmedAt).toBe(confirmedAt.toISOString());
    });

    it('FAILED 상태의 환불 정보와 오류 메시지를 올바르게 반환해야 함', async () => {
      refundService.findByHash = vi.fn().mockResolvedValue({
        ...mockRefund,
        status: 'FAILED',
        tx_hash: '0x' + 'f'.repeat(64),
        error_message: 'Transaction reverted: insufficient balance',
        submitted_at: new Date(),
        confirmed_at: null,
      });

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds/${mockRefund.refund_hash}`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.status).toBe('FAILED');
      expect(body.data.errorMessage).toBe('Transaction reverted: insufficient balance');
    });
  });

  describe('인증 케이스', () => {
    it('API 키가 없으면 401 상태 코드를 반환해야 함', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds/${mockRefund.refund_hash}`,
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('UNAUTHORIZED');
    });

    it('잘못된 API 키로 요청하면 401 상태 코드를 반환해야 함', async () => {
      merchantService.findByApiKey = vi.fn().mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds/${mockRefund.refund_hash}`,
        headers: { 'x-api-key': 'invalid-api-key' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('권한 검증 케이스', () => {
    it('다른 가맹점의 환불에 대해 조회하면 403 상태 코드를 반환해야 함', async () => {
      refundService.findByHash = vi.fn().mockResolvedValue({
        ...mockRefund,
        merchant_id: 999, // 다른 가맹점
      });

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds/${mockRefund.refund_hash}`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('FORBIDDEN');
    });
  });

  describe('경계 케이스', () => {
    it('존재하지 않는 환불 ID로 조회하면 404 상태 코드를 반환해야 함', async () => {
      refundService.findByHash = vi.fn().mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds/${mockRefund.refund_hash}`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('REFUND_NOT_FOUND');
    });

    it('연관된 결제가 없으면 404 상태 코드를 반환해야 함', async () => {
      paymentService.findById = vi.fn().mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds/${mockRefund.refund_hash}`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('PAYMENT_NOT_FOUND');
    });

    it('잘못된 형식의 환불 ID로 조회해도 서비스에서 처리되어야 함', async () => {
      refundService.findByHash = vi.fn().mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds/invalid-hash`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      // 잘못된 hash는 DB에서 찾지 못해 404 반환
      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('REFUND_NOT_FOUND');
    });
  });

  describe('예외 처리 케이스', () => {
    it('RefundService 오류 발생 시 500 상태 코드를 반환해야 함', async () => {
      refundService.findByHash = vi.fn().mockRejectedValue(new Error('Database error'));

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds/${mockRefund.refund_hash}`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('INTERNAL_ERROR');
    });

    it('PaymentService 오류 발생 시 500 상태 코드를 반환해야 함', async () => {
      paymentService.findById = vi.fn().mockRejectedValue(new Error('Database error'));

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds/${mockRefund.refund_hash}`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('INTERNAL_ERROR');
    });
  });

  describe('성능 요구사항', () => {
    it('환불 상태 조회 응답 시간이 500ms 이내여야 함', async () => {
      const startTime = performance.now();

      await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds/${mockRefund.refund_hash}`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500);
    });
  });
});
