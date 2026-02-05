import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FastifyRequest, FastifyReply } from 'fastify';
import { createPublicAuthMiddleware } from '../public-auth.middleware';
import { MerchantService } from '../../services/merchant.service';

const mockMerchant = {
  id: 1,
  merchant_key: 'merchant_demo_001',
  name: 'Demo Store',
  chain_id: 1,
  api_key_hash: 'hashed_key',
  public_key: 'pk_live_abc123',
  public_key_hash: 'hash_of_pk',
  allowed_domains: ['https://checkout.example.com', 'https://shop.example.com'],
  webhook_url: null,
  fee_bps: 0,
  recipient_address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  is_enabled: true,
  is_deleted: false,
  created_at: new Date(),
  updated_at: new Date(),
  deleted_at: null,
};

const createMockMerchantService = () =>
  ({
    findByPublicKey: vi.fn(),
  }) as Partial<MerchantService> as MerchantService;

const createMockRequest = (headers: Record<string, string> = {}): FastifyRequest => {
  const mockLog = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(),
    silent: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
  };
  return {
    headers,
    log: mockLog,
  } as unknown as FastifyRequest;
};

const createMockReply = (): FastifyReply => {
  const sent = { current: false };
  return {
    code: vi.fn().mockReturnThis(),
    send: vi.fn().mockImplementation(() => {
      sent.current = true;
      return this;
    }),
    get sent() {
      return sent.current;
    },
  } as unknown as FastifyReply;
};

describe('createPublicAuthMiddleware', () => {
  let mockMerchantService: MerchantService;

  beforeEach(() => {
    mockMerchantService = createMockMerchantService();
    vi.mocked(mockMerchantService.findByPublicKey).mockReset();
  });

  it('should return 401 when x-public-key header is missing', async () => {
    const middleware = createPublicAuthMiddleware(mockMerchantService);
    const request = createMockRequest({});
    const reply = createMockReply();

    await middleware(request, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid x-public-key header',
    });
    expect(mockMerchantService.findByPublicKey).not.toHaveBeenCalled();
  });

  it('should return 401 when x-public-key header is empty', async () => {
    const middleware = createPublicAuthMiddleware(mockMerchantService);
    const request = createMockRequest({ 'x-public-key': '   ' });
    const reply = createMockReply();

    await middleware(request, reply);

    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      code: 'UNAUTHORIZED',
      message: 'Missing or invalid x-public-key header',
    });
  });

  it('should return 401 when public key is invalid (merchant not found)', async () => {
    const middleware = createPublicAuthMiddleware(mockMerchantService);
    const request = createMockRequest({
      'x-public-key': 'pk_live_invalid',
      origin: 'https://checkout.example.com',
    });
    const reply = createMockReply();

    vi.mocked(mockMerchantService.findByPublicKey).mockResolvedValue(null);

    await middleware(request, reply);

    expect(mockMerchantService.findByPublicKey).toHaveBeenCalledWith('pk_live_invalid');
    expect(reply.code).toHaveBeenCalledWith(401);
    expect(reply.send).toHaveBeenCalledWith({
      code: 'UNAUTHORIZED',
      message: 'Invalid public key',
    });
  });

  it('should return 403 when allowed_domains is empty', async () => {
    const middleware = createPublicAuthMiddleware(mockMerchantService);
    const request = createMockRequest({
      'x-public-key': 'pk_live_abc123',
      origin: 'https://checkout.example.com',
    });
    const reply = createMockReply();

    vi.mocked(mockMerchantService.findByPublicKey).mockResolvedValue({
      ...mockMerchant,
      allowed_domains: [],
    });

    await middleware(request, reply);

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({
      code: 'FORBIDDEN',
      message: 'No allowed domains configured for this public key',
    });
    expect(request.merchant).toBeUndefined();
  });

  it('should return 403 when origin is not in allowed_domains', async () => {
    const middleware = createPublicAuthMiddleware(mockMerchantService);
    const request = createMockRequest({
      'x-public-key': 'pk_live_abc123',
      origin: 'https://evil.example.com',
    });
    const reply = createMockReply();

    vi.mocked(mockMerchantService.findByPublicKey).mockResolvedValue(mockMerchant);

    await middleware(request, reply);

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({
      code: 'FORBIDDEN',
      message: 'Origin not allowed for this public key',
    });
    expect(request.merchant).toBeUndefined();
  });

  it('should return 403 when origin header is missing', async () => {
    const middleware = createPublicAuthMiddleware(mockMerchantService);
    const request = createMockRequest({ 'x-public-key': 'pk_live_abc123' });
    const reply = createMockReply();

    vi.mocked(mockMerchantService.findByPublicKey).mockResolvedValue(mockMerchant);

    await middleware(request, reply);

    expect(reply.code).toHaveBeenCalledWith(403);
    expect(reply.send).toHaveBeenCalledWith({
      code: 'FORBIDDEN',
      message: 'Origin not allowed for this public key',
    });
  });

  it('should attach merchant to request when public key and origin are valid', async () => {
    const middleware = createPublicAuthMiddleware(mockMerchantService);
    const request = createMockRequest({
      'x-public-key': 'pk_live_abc123',
      origin: 'https://checkout.example.com',
    });
    const reply = createMockReply();

    vi.mocked(mockMerchantService.findByPublicKey).mockResolvedValue(mockMerchant);

    await middleware(request, reply);

    expect(mockMerchantService.findByPublicKey).toHaveBeenCalledWith('pk_live_abc123');
    expect(request.merchant).toEqual(mockMerchant);
    expect(reply.sent).toBe(false);
  });

  it('should accept origin that matches second allowed domain', async () => {
    const middleware = createPublicAuthMiddleware(mockMerchantService);
    const request = createMockRequest({
      'x-public-key': 'pk_live_abc123',
      origin: 'https://shop.example.com',
    });
    const reply = createMockReply();

    vi.mocked(mockMerchantService.findByPublicKey).mockResolvedValue(mockMerchant);

    await middleware(request, reply);

    expect(request.merchant).toEqual(mockMerchant);
    expect(reply.sent).toBe(false);
  });

  it('should return 500 when findByPublicKey throws', async () => {
    const middleware = createPublicAuthMiddleware(mockMerchantService);
    const request = createMockRequest({
      'x-public-key': 'pk_live_abc123',
      origin: 'https://checkout.example.com',
    });
    const reply = createMockReply();

    vi.mocked(mockMerchantService.findByPublicKey).mockRejectedValue(new Error('DB error'));

    await middleware(request, reply);

    expect(reply.code).toHaveBeenCalledWith(500);
    expect(reply.send).toHaveBeenCalledWith({
      code: 'INTERNAL_ERROR',
      message: 'Authentication failed',
    });
  });
});
