import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FastifyRequest, FastifyReply } from 'fastify';
import { createAuthMiddleware } from '../auth.middleware';
import { MerchantService } from '../../services/merchant.service';

// Mock merchant data
const mockMerchant = {
  id: 1,
  merchant_key: 'merchant_demo_001',
  name: 'Demo Store',
  chain_id: 1,
  api_key_hash: 'hashed_key',
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


// Create mock services
const createMockMerchantService = () =>
  ({
    findByApiKey: vi.fn(),
    findByMerchantKey: vi.fn(),
    findById: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    verifyApiKey: vi.fn(),
    softDelete: vi.fn(),
  }) as Partial<MerchantService> as MerchantService;

// Create mock request/reply
const createMockRequest = (
  headers: Record<string, string> = {},
  body: object = {},
  params: object = {}
): FastifyRequest => {
  const mockLog = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
    silent: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    level: 'info',
  };
  return {
    headers,
    body,
    params,
    merchant: undefined,
    log: mockLog,
  } as Partial<FastifyRequest> as FastifyRequest;
};

const createMockReply = () => {
  const reply = {
    sent: false,
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockImplementation(() => {
      reply.sent = true;
      return reply;
    }),
  };
  return reply as Partial<FastifyReply> & { sent: boolean } as FastifyReply & { sent: boolean };
};

describe('Auth Middleware', () => {
  let mockMerchantService: MerchantService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockMerchantService = createMockMerchantService();
  });

  describe('createAuthMiddleware', () => {
    it('should return 401 when x-api-key header is missing', async () => {
      const middleware = createAuthMiddleware(mockMerchantService);
      const request = createMockRequest({});
      const reply = createMockReply();

      await middleware(request, reply);

      expect(reply.code).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid x-api-key header',
      });
    });

    it('should return 401 when x-api-key header is empty', async () => {
      const middleware = createAuthMiddleware(mockMerchantService);
      const request = createMockRequest({ 'x-api-key': '   ' });
      const reply = createMockReply();

      await middleware(request, reply);

      expect(reply.code).toHaveBeenCalledWith(401);
      expect(reply.send).toHaveBeenCalledWith({
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid x-api-key header',
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

});
