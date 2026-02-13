import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { Decimal } from '@solo-pay/database';
import { getRefundListRoute } from '../../../src/routes/refunds/list';
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

const createMockRefund = (id: number, status: string, paymentId: number) => ({
  id,
  refund_hash: '0x' + id.toString().padStart(64, '0'),
  payment_id: paymentId,
  merchant_id: 1,
  amount: new Decimal('1000000000000000000'),
  token_address: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
  payer_address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  status: status as 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'FAILED',
  reason: '테스트 환불',
  tx_hash: status === 'CONFIRMED' || status === 'SUBMITTED' ? '0x' + 'f'.repeat(64) : null,
  error_message: status === 'FAILED' ? '트랜잭션 실패' : null,
  submitted_at: status !== 'PENDING' ? new Date() : null,
  confirmed_at: status === 'CONFIRMED' ? new Date() : null,
  created_at: new Date(Date.now() - id * 1000),
  updated_at: new Date(),
});

const createMockPayment = (id: number) => ({
  id,
  payment_hash: '0xpayment' + id.toString().padStart(58, '0'),
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
  order_id: `order-${id}`,
  success_url: null,
  fail_url: null,
  webhook_url: null,
  origin: null,
  payer_address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  created_at: new Date(),
  updated_at: new Date(),
});

describe('GET /refunds', () => {
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
      findById: vi.fn().mockImplementation((id: number) => Promise.resolve(createMockPayment(id))),
      findByIds: vi
        .fn()
        .mockImplementation((ids: number[]) =>
          Promise.resolve(ids.map((id) => createMockPayment(id)))
        ),
    };

    refundService = {
      findByMerchant: vi.fn().mockResolvedValue({
        items: [
          createMockRefund(1, 'CONFIRMED', 1),
          createMockRefund(2, 'PENDING', 2),
          createMockRefund(3, 'SUBMITTED', 3),
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 3,
          totalPages: 1,
        },
      }),
    };

    await app.register(
      async (scope) => {
        await getRefundListRoute(
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
    it('환불 목록을 조회하면 200 상태 코드와 함께 환불 목록을 반환해야 함', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.items).toHaveLength(3);
      expect(body.data.pagination).toBeDefined();
    });

    it('각 환불 항목에 필요한 필드가 모두 포함되어야 함', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const item = body.data.items[0];

      expect(item).toHaveProperty('refundId');
      expect(item).toHaveProperty('paymentId');
      expect(item).toHaveProperty('amount');
      expect(item).toHaveProperty('tokenAddress');
      expect(item).toHaveProperty('payerAddress');
      expect(item).toHaveProperty('status');
      expect(item).toHaveProperty('reason');
      expect(item).toHaveProperty('txHash');
      expect(item).toHaveProperty('createdAt');
      expect(item).toHaveProperty('confirmedAt');
    });

    it('페이지네이션 정보가 올바르게 반환되어야 함', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      const pagination = body.data.pagination;

      expect(pagination).toHaveProperty('page');
      expect(pagination).toHaveProperty('limit');
      expect(pagination).toHaveProperty('total');
      expect(pagination).toHaveProperty('totalPages');
    });
  });

  describe('페이지네이션 케이스', () => {
    it('page 파라미터로 특정 페이지를 조회할 수 있어야 함', async () => {
      refundService.findByMerchant = vi.fn().mockResolvedValue({
        items: [createMockRefund(4, 'PENDING', 4)],
        pagination: {
          page: 2,
          limit: 20,
          total: 24,
          totalPages: 2,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds?page=2`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.pagination.page).toBe(2);
      expect(refundService.findByMerchant).toHaveBeenCalledWith(
        mockMerchant.id,
        expect.objectContaining({ page: 2 })
      );
    });

    it('limit 파라미터로 페이지당 항목 수를 지정할 수 있어야 함', async () => {
      refundService.findByMerchant = vi.fn().mockResolvedValue({
        items: Array(10)
          .fill(null)
          .map((_, i) => createMockRefund(i + 1, 'PENDING', i + 1)),
        pagination: {
          page: 1,
          limit: 10,
          total: 50,
          totalPages: 5,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds?limit=10`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.items).toHaveLength(10);
      expect(body.data.pagination.limit).toBe(10);
    });

    it('page와 limit을 함께 지정할 수 있어야 함', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds?page=2&limit=5`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      expect(refundService.findByMerchant).toHaveBeenCalledWith(
        mockMerchant.id,
        expect.objectContaining({ page: 2, limit: 5 })
      );
    });
  });

  describe('필터링 케이스', () => {
    it('status 파라미터로 특정 상태의 환불만 조회할 수 있어야 함', async () => {
      refundService.findByMerchant = vi.fn().mockResolvedValue({
        items: [createMockRefund(1, 'CONFIRMED', 1)],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds?status=CONFIRMED`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      expect(refundService.findByMerchant).toHaveBeenCalledWith(
        mockMerchant.id,
        expect.objectContaining({ status: 'CONFIRMED' })
      );
    });

    it('PENDING 상태로 필터링할 수 있어야 함', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds?status=PENDING`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      expect(refundService.findByMerchant).toHaveBeenCalledWith(
        mockMerchant.id,
        expect.objectContaining({ status: 'PENDING' })
      );
    });

    it('SUBMITTED 상태로 필터링할 수 있어야 함', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds?status=SUBMITTED`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      expect(refundService.findByMerchant).toHaveBeenCalledWith(
        mockMerchant.id,
        expect.objectContaining({ status: 'SUBMITTED' })
      );
    });

    it('FAILED 상태로 필터링할 수 있어야 함', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds?status=FAILED`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      expect(refundService.findByMerchant).toHaveBeenCalledWith(
        mockMerchant.id,
        expect.objectContaining({ status: 'FAILED' })
      );
    });

    it('paymentId로 특정 결제의 환불만 조회할 수 있어야 함', async () => {
      const paymentHash = '0x' + 'a'.repeat(64);

      refundService.findByMerchant = vi.fn().mockResolvedValue({
        items: [createMockRefund(1, 'CONFIRMED', 1)],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds?paymentId=${paymentHash}`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      expect(refundService.findByMerchant).toHaveBeenCalledWith(
        mockMerchant.id,
        expect.objectContaining({ paymentId: paymentHash })
      );
    });

    it('status와 paymentId를 함께 지정할 수 있어야 함', async () => {
      const paymentHash = '0x' + 'b'.repeat(64);

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds?status=PENDING&paymentId=${paymentHash}`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      expect(refundService.findByMerchant).toHaveBeenCalledWith(
        mockMerchant.id,
        expect.objectContaining({ status: 'PENDING', paymentId: paymentHash })
      );
    });
  });

  describe('인증 케이스', () => {
    it('API 키가 없으면 401 상태 코드를 반환해야 함', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds`,
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('UNAUTHORIZED');
    });

    it('잘못된 API 키로 요청하면 401 상태 코드를 반환해야 함', async () => {
      merchantService.findByApiKey = vi.fn().mockResolvedValue(null);

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds`,
        headers: { 'x-api-key': 'invalid-api-key' },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('빈 결과 케이스', () => {
    it('환불 내역이 없으면 빈 배열을 반환해야 함', async () => {
      refundService.findByMerchant = vi.fn().mockResolvedValue({
        items: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.items).toHaveLength(0);
      expect(body.data.pagination.total).toBe(0);
    });

    it('필터 조건에 맞는 환불이 없으면 빈 배열을 반환해야 함', async () => {
      refundService.findByMerchant = vi.fn().mockResolvedValue({
        items: [],
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
        },
      });

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds?status=FAILED`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.items).toHaveLength(0);
    });
  });

  describe('기본값 케이스', () => {
    it('page 미지정 시 기본값 1이 적용되어야 함', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      expect(refundService.findByMerchant).toHaveBeenCalledWith(
        mockMerchant.id,
        expect.objectContaining({ page: 1 })
      );
    });

    it('limit 미지정 시 기본값 20이 적용되어야 함', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      expect(refundService.findByMerchant).toHaveBeenCalledWith(
        mockMerchant.id,
        expect.objectContaining({ limit: 20 })
      );
    });
  });

  describe('예외 처리 케이스', () => {
    it('RefundService 오류 발생 시 500 상태 코드를 반환해야 함', async () => {
      refundService.findByMerchant = vi.fn().mockRejectedValue(new Error('Database error'));

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('INTERNAL_ERROR');
    });

    it('PaymentService 오류 발생 시에도 목록은 반환되어야 함', async () => {
      paymentService.findByIds = vi.fn().mockResolvedValue([]);

      const response = await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      // paymentId가 빈 문자열로 반환될 수 있음
      expect(body.data.items).toBeDefined();
    });
  });

  describe('성능 요구사항', () => {
    it('환불 목록 조회 응답 시간이 500ms 이내여야 함', async () => {
      const startTime = performance.now();

      await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(500);
    });

    it('대량 데이터 조회 시에도 응답 시간이 1초 이내여야 함', async () => {
      refundService.findByMerchant = vi.fn().mockResolvedValue({
        items: Array(100)
          .fill(null)
          .map((_, i) => createMockRefund(i + 1, 'PENDING', i + 1)),
        pagination: {
          page: 1,
          limit: 100,
          total: 1000,
          totalPages: 10,
        },
      });

      const startTime = performance.now();

      await app.inject({
        method: 'GET',
        url: `${API_V1_BASE_PATH}/refunds?limit=100`,
        headers: { 'x-api-key': TEST_API_KEY },
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000);
    });
  });
});
