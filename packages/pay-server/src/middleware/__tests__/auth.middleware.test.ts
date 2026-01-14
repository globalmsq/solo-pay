import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FastifyRequest, FastifyReply } from 'fastify';
import {
  createAuthMiddleware,
  createMerchantAuthMiddleware,
  createPaymentAuthMiddleware,
} from '../auth.middleware';
import { MerchantService } from '../../services/merchant.service';
import { PaymentService } from '../../services/payment.service';

// Mock merchant data
const mockMerchant = {
  id: 1,
  merchant_key: 'merchant_demo_001',
  name: 'Demo Store',
  api_key_hash: 'hashed_key',
  webhook_url: null,
  is_enabled: true,
  is_deleted: false,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
};

const mockMerchant2 = {
  id: 2,
  merchant_key: 'merchant_metastar_001',
  name: 'Metastar Global',
  api_key_hash: 'hashed_key_2',
  webhook_url: null,
  is_enabled: true,
  is_deleted: false,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
};

// Mock payment data
const mockPayment = {
  id: 1,
  payment_hash: '0x123abc',
  merchant_id: 1, // belongs to merchant 1
  payment_method_id: 1,
  amount: BigInt(1000),
  token_decimals: 18,
  token_symbol: 'TEST',
  network_id: 31337,
  status: 'CREATED',
  tx_hash: null,
  expires_at: new Date(),
  confirmed_at: null,
  created_at: new Date(),
  updated_at: new Date(),
};

// Create mock services
const createMockMerchantService = () => ({
  findByApiKey: vi.fn(),
  findByMerchantKey: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  verifyApiKey: vi.fn(),
  softDelete: vi.fn(),
}) as unknown as MerchantService;

const createMockPaymentService = () => ({
  findByHash: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  updateStatus: vi.fn(),
}) as unknown as PaymentService;

// Create mock request/reply
const createMockRequest = (headers: Record<string, string> = {}, body: unknown = {}, params: unknown = {}): FastifyRequest => ({
  headers,
  body,
  params,
  merchant: undefined,
  log: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
} as unknown as FastifyRequest);

const createMockReply = () => {
  const reply = {
    sent: false,
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockImplementation(() => {
      reply.sent = true;
      return reply;
    }),
  };
  return reply as unknown as FastifyReply & { sent: boolean };
};

describe('Auth Middleware', () => {
  let mockMerchantService: MerchantService;
  let mockPaymentService: PaymentService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMerchantService = createMockMerchantService();
    mockPaymentService = createMockPaymentService();
  });

  describe('createAuthMiddleware', () => {
    it('should return 401 when X-API-Key header is missing', async () => {
      const middleware = createAuthMiddleware(mockMerchantService);
      const request = createMockRequest({});
      const reply = createMockReply();

      await middleware(request, reply);

      expect(reply.code).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid X-API-Key header',
      });
    });

    it('should return 401 when X-API-Key header is empty', async () => {
      const middleware = createAuthMiddleware(mockMerchantService);
      const request = createMockRequest({ 'x-api-key': '   ' });
      const reply = createMockReply();

      await middleware(request, reply);

      expect(reply.code).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid X-API-Key header',
      });
    });

    it('should return 401 when API key is invalid', async () => {
      const middleware = createAuthMiddleware(mockMerchantService);
      const request = createMockRequest({ 'x-api-key': 'invalid_key' });
      const reply = createMockReply();

      vi.mocked(mockMerchantService.findByApiKey).mockResolvedValue(null);

      await middleware(request, reply);

      expect(mockMerchantService.findByApiKey).toHaveBeenCalledWith('invalid_key');
      expect(reply.code).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        code: 'UNAUTHORIZED',
        message: 'Invalid API key',
      });
    });

    it('should attach merchant to request when API key is valid', async () => {
      const middleware = createAuthMiddleware(mockMerchantService);
      const request = createMockRequest({ 'x-api-key': 'valid_key' });
      const reply = createMockReply();

      vi.mocked(mockMerchantService.findByApiKey).mockResolvedValue(mockMerchant);

      await middleware(request, reply);

      expect(mockMerchantService.findByApiKey).toHaveBeenCalledWith('valid_key');
      expect(request.merchant).toEqual(mockMerchant);
      expect(reply.sent).toBe(false);
    });

    it('should return 500 when database error occurs', async () => {
      const middleware = createAuthMiddleware(mockMerchantService);
      const request = createMockRequest({ 'x-api-key': 'valid_key' });
      const reply = createMockReply();

      vi.mocked(mockMerchantService.findByApiKey).mockRejectedValue(new Error('DB error'));

      await middleware(request, reply);

      expect(reply.code).toHaveBeenCalledWith(500);
      expect(reply.send).toHaveBeenCalledWith({
        code: 'INTERNAL_ERROR',
        message: 'Authentication failed',
      });
    });
  });

  describe('createMerchantAuthMiddleware', () => {
    it('should return 401 when API key is missing', async () => {
      const middleware = createMerchantAuthMiddleware(mockMerchantService);
      const request = createMockRequest({}, { merchantId: 'merchant_demo_001' });
      const reply = createMockReply();

      await middleware(request, reply);

      expect(reply.code).toHaveBeenCalledWith(401);
    });

    it('should return 403 when merchantId does not match API key owner', async () => {
      const middleware = createMerchantAuthMiddleware(mockMerchantService);
      const request = createMockRequest(
        { 'x-api-key': 'valid_key' },
        { merchantId: 'merchant_metastar_001' } // different merchant
      );
      const reply = createMockReply();

      vi.mocked(mockMerchantService.findByApiKey).mockResolvedValue(mockMerchant); // returns merchant_demo_001

      await middleware(request, reply);

      expect(reply.code).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith({
        code: 'FORBIDDEN',
        message: 'API key does not match the requested merchant',
      });
    });

    it('should pass when merchantId matches API key owner', async () => {
      const middleware = createMerchantAuthMiddleware(mockMerchantService);
      const request = createMockRequest(
        { 'x-api-key': 'valid_key' },
        { merchantId: 'merchant_demo_001' }
      );
      const reply = createMockReply();

      vi.mocked(mockMerchantService.findByApiKey).mockResolvedValue(mockMerchant);

      await middleware(request, reply);

      expect(request.merchant).toEqual(mockMerchant);
      expect(reply.sent).toBe(false);
    });
  });

  describe('createPaymentAuthMiddleware', () => {
    it('should return 401 when API key is missing', async () => {
      const middleware = createPaymentAuthMiddleware(mockMerchantService, mockPaymentService);
      const request = createMockRequest({}, {}, { id: '0x123abc' });
      const reply = createMockReply();

      await middleware(request, reply);

      expect(reply.code).toHaveBeenCalledWith(401);
    });

    it('should return 403 when payment does not belong to API key owner', async () => {
      const middleware = createPaymentAuthMiddleware(mockMerchantService, mockPaymentService);
      const request = createMockRequest(
        { 'x-api-key': 'metastar_key' },
        {},
        { id: '0x123abc' }
      );
      const reply = createMockReply();

      vi.mocked(mockMerchantService.findByApiKey).mockResolvedValue(mockMerchant2); // merchant 2
      vi.mocked(mockPaymentService.findByHash).mockResolvedValue(mockPayment); // belongs to merchant 1

      await middleware(request, reply);

      expect(mockPaymentService.findByHash).toHaveBeenCalledWith('0x123abc');
      expect(reply.code).toHaveBeenCalledWith(403);
      expect(reply.send).toHaveBeenCalledWith({
        code: 'FORBIDDEN',
        message: 'Payment does not belong to this merchant',
      });
    });

    it('should pass when payment belongs to API key owner', async () => {
      const middleware = createPaymentAuthMiddleware(mockMerchantService, mockPaymentService);
      const request = createMockRequest(
        { 'x-api-key': 'demo_key' },
        {},
        { id: '0x123abc' }
      );
      const reply = createMockReply();

      vi.mocked(mockMerchantService.findByApiKey).mockResolvedValue(mockMerchant); // merchant 1
      vi.mocked(mockPaymentService.findByHash).mockResolvedValue(mockPayment); // belongs to merchant 1

      await middleware(request, reply);

      expect(request.merchant).toEqual(mockMerchant);
      expect(reply.sent).toBe(false);
    });

    it('should pass when payment is not found (let route handler deal with it)', async () => {
      const middleware = createPaymentAuthMiddleware(mockMerchantService, mockPaymentService);
      const request = createMockRequest(
        { 'x-api-key': 'demo_key' },
        {},
        { id: '0x999' }
      );
      const reply = createMockReply();

      vi.mocked(mockMerchantService.findByApiKey).mockResolvedValue(mockMerchant);
      vi.mocked(mockPaymentService.findByHash).mockResolvedValue(null);

      await middleware(request, reply);

      expect(request.merchant).toEqual(mockMerchant);
      expect(reply.sent).toBe(false); // Let route handler return 404
    });
  });
});
