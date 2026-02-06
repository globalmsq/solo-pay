import { describe, it, expect, beforeEach, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { Decimal } from '@prisma/client/runtime/library';
import { createRefundRoute } from '../../../src/routes/refunds/create';
import { MerchantService } from '../../../src/services/merchant.service';
import { PaymentService } from '../../../src/services/payment.service';
import { RefundService } from '../../../src/services/refund.service';
import { BlockchainService } from '../../../src/services/blockchain.service';
import { ServerSigningService } from '../../../src/services/signature-server.service';

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
  reason: null,
  tx_hash: null,
  error_message: null,
  submitted_at: null,
  confirmed_at: null,
  created_at: new Date(),
  updated_at: new Date(),
};

describe('POST /refunds', () => {
  let app: FastifyInstance;
  let merchantService: Partial<MerchantService>;
  let paymentService: Partial<PaymentService>;
  let refundService: Partial<RefundService>;
  let blockchainService: Partial<BlockchainService>;
  let signingServices: Map<number, Partial<ServerSigningService>>;

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
      findByHash: vi.fn().mockResolvedValue(mockPayment),
    };

    refundService = {
      hasCompletedRefund: vi.fn().mockResolvedValue(false),
      hasActiveRefund: vi.fn().mockResolvedValue(false),
      create: vi.fn().mockResolvedValue(mockRefund),
    };

    blockchainService = {
      getChainContracts: vi.fn().mockReturnValue({
        gateway: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
        forwarder: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      }),
      getTokenConfig: vi.fn().mockReturnValue({
        address: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
        decimals: 18,
      }),
    };

    const mockSigningService = {
      signRefundRequest: vi.fn().mockResolvedValue('0x' + 'd'.repeat(130)),
    };

    signingServices = new Map();
    signingServices.set(31337, mockSigningService as unknown as ServerSigningService);

    await createRefundRoute(
      app,
      merchantService as MerchantService,
      paymentService as PaymentService,
      refundService as RefundService,
      blockchainService as BlockchainService,
      signingServices as Map<number, ServerSigningService>
    );
  });

  describe('정상 케이스', () => {
    it('유효한 환불 요청을 받으면 201 상태 코드와 함께 환불 정보를 반환해야 함', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/refunds',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: {
          paymentId: mockPayment.payment_hash,
          reason: '고객 요청에 의한 환불',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
      expect(body.data.refundId).toBeDefined();
      expect(body.data.paymentId).toBe(mockPayment.payment_hash);
      expect(body.data.status).toBe('PENDING');
    });

    it('reason 없이 환불 요청을 해도 성공해야 함', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/refunds',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: {
          paymentId: mockPayment.payment_hash,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.success).toBe(true);
    });

    it('환불 응답에 기본 필드가 포함되어야 함', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/refunds',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: {
          paymentId: mockPayment.payment_hash,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      const data = body.data;

      // 필수 필드 확인
      expect(data).toHaveProperty('refundId');
      expect(data).toHaveProperty('paymentId');
      expect(data).toHaveProperty('amount');
      expect(data).toHaveProperty('tokenAddress');
      expect(data).toHaveProperty('payerAddress');
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('createdAt');
    });
  });

  describe('인증 케이스', () => {
    it('API 키가 없으면 401 상태 코드를 반환해야 함', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/refunds',
        payload: {
          paymentId: mockPayment.payment_hash,
        },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('UNAUTHORIZED');
    });

    it('잘못된 API 키로 요청하면 401 상태 코드를 반환해야 함', async () => {
      merchantService.findByApiKey = vi.fn().mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/refunds',
        headers: { 'x-api-key': 'invalid-api-key' },
        payload: {
          paymentId: mockPayment.payment_hash,
        },
      });

      expect(response.statusCode).toBe(401);
    });
  });

  describe('결제 검증 케이스', () => {
    it('존재하지 않는 결제 ID로 환불 요청하면 404 상태 코드를 반환해야 함', async () => {
      paymentService.findByHash = vi.fn().mockResolvedValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/refunds',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: {
          paymentId: '0x' + 'f'.repeat(64),
        },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('PAYMENT_NOT_FOUND');
    });

    it('다른 가맹점의 결제에 대해 환불 요청하면 403 상태 코드를 반환해야 함', async () => {
      paymentService.findByHash = vi.fn().mockResolvedValue({
        ...mockPayment,
        merchant_id: 999, // 다른 가맹점
      });

      const response = await app.inject({
        method: 'POST',
        url: '/refunds',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: {
          paymentId: mockPayment.payment_hash,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('FORBIDDEN');
    });

    it('CONFIRMED 상태가 아닌 결제에 대해 환불 요청하면 400 상태 코드를 반환해야 함', async () => {
      const testStatuses = ['CREATED', 'PENDING', 'FAILED', 'EXPIRED'];

      for (const status of testStatuses) {
        paymentService.findByHash = vi.fn().mockResolvedValue({
          ...mockPayment,
          status,
        });

        const response = await app.inject({
          method: 'POST',
          url: '/refunds',
          headers: { 'x-api-key': TEST_API_KEY },
          payload: {
            paymentId: mockPayment.payment_hash,
          },
        });

        expect(response.statusCode).toBe(400);
        const body = JSON.parse(response.body);
        expect(body.code).toBe('PAYMENT_NOT_CONFIRMED');
      }
    });

    it('payer_address가 없는 결제에 대해 환불 요청하면 400 상태 코드를 반환해야 함', async () => {
      paymentService.findByHash = vi.fn().mockResolvedValue({
        ...mockPayment,
        payer_address: null,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/refunds',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: {
          paymentId: mockPayment.payment_hash,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('PAYER_ADDRESS_NOT_FOUND');
    });
  });

  describe('중복 환불 방지 케이스', () => {
    it('이미 환불 완료된 결제에 대해 요청하면 400 상태 코드를 반환해야 함', async () => {
      refundService.hasCompletedRefund = vi.fn().mockResolvedValue(true);

      const response = await app.inject({
        method: 'POST',
        url: '/refunds',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: {
          paymentId: mockPayment.payment_hash,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('PAYMENT_ALREADY_REFUNDED');
    });

    it('환불이 진행 중인 결제에 대해 요청하면 400 상태 코드를 반환해야 함', async () => {
      refundService.hasActiveRefund = vi.fn().mockResolvedValue(true);

      const response = await app.inject({
        method: 'POST',
        url: '/refunds',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: {
          paymentId: mockPayment.payment_hash,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('REFUND_IN_PROGRESS');
    });
  });

  describe('체인/토큰 설정 케이스', () => {
    it('체인 설정이 없으면 500 상태 코드를 반환해야 함', async () => {
      blockchainService.getChainContracts = vi.fn().mockReturnValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/refunds',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: {
          paymentId: mockPayment.payment_hash,
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('CHAIN_CONFIG_ERROR');
    });

    it('서명 서비스가 없으면 500 상태 코드를 반환해야 함', async () => {
      signingServices.clear();

      const response = await app.inject({
        method: 'POST',
        url: '/refunds',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: {
          paymentId: mockPayment.payment_hash,
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('SIGNING_SERVICE_ERROR');
    });

    it('토큰 설정이 없으면 500 상태 코드를 반환해야 함', async () => {
      blockchainService.getTokenConfig = vi.fn().mockReturnValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/refunds',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: {
          paymentId: mockPayment.payment_hash,
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('TOKEN_INFO_ERROR');
    });
  });

  describe('입력값 검증 케이스', () => {
    it('paymentId가 누락되면 400 상태 코드를 반환해야 함', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/refunds',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: {
          reason: '테스트',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('빈 body로 요청하면 400 상태 코드를 반환해야 함', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/refunds',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('예외 처리 케이스', () => {
    it('RefundService 오류 발생 시 500 상태 코드를 반환해야 함', async () => {
      refundService.create = vi.fn().mockRejectedValue(new Error('Database error'));

      const response = await app.inject({
        method: 'POST',
        url: '/refunds',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: {
          paymentId: mockPayment.payment_hash,
        },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.code).toBe('INTERNAL_ERROR');
    });

    it('서명 생성 오류 발생 시 500 상태 코드를 반환해야 함', async () => {
      const mockSigningService = {
        signRefundRequest: vi.fn().mockRejectedValue(new Error('Signing error')),
      };
      signingServices.set(31337, mockSigningService as unknown as ServerSigningService);

      const response = await app.inject({
        method: 'POST',
        url: '/refunds',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: {
          paymentId: mockPayment.payment_hash,
        },
      });

      expect(response.statusCode).toBe(500);
    });
  });

  describe('성능 요구사항', () => {
    it('환불 요청 응답 시간이 1초 이내여야 함', async () => {
      const startTime = performance.now();

      await app.inject({
        method: 'POST',
        url: '/refunds',
        headers: { 'x-api-key': TEST_API_KEY },
        payload: {
          paymentId: mockPayment.payment_hash,
        },
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(1000);
    });
  });
});
