import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { priceRoutes } from '../src/routes/price.routes';
import { PriceService, TokenNotFoundError, CmcIdMissingError } from '../src/services/price.service';

vi.mock('../src/lib/redis', () => ({
  getCache: vi.fn().mockResolvedValue(null),
  setCache: vi.fn().mockResolvedValue(undefined),
  isRedisAvailable: vi.fn().mockReturnValue(false),
  getRedisClient: vi.fn(),
  disconnectRedis: vi.fn().mockResolvedValue(undefined),
}));

const mockPriceResult = {
  id: 825,
  name: 'Tether',
  symbol: 'USDT',
  address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
  chain_id: 137,
  quote: {
    USD: {
      price: 1.0001,
      volume_24h: 50000000000,
      percent_change_1h: 0.01,
      percent_change_24h: 0.02,
      percent_change_7d: -0.01,
      market_cap: 95000000000,
      last_updated: '2025-01-15T12:00:00.000Z',
    },
  },
};

describe('Price Routes', () => {
  let app: FastifyInstance;
  let priceService: PriceService;

  beforeEach(async () => {
    const mockPrisma = { token: { findUnique: vi.fn() } } as never;
    priceService = new PriceService({ apiKey: 'test-key', cacheTtl: 60 }, mockPrisma);

    app = Fastify({ logger: false });
    await app.register(priceRoutes, { priceService });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/v1/prices/:chainId/:address', () => {
    it('should return price for valid token', async () => {
      vi.spyOn(priceService, 'getPrice').mockResolvedValueOnce(mockPriceResult);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/prices/137/0xdAC17F958D2ee523a2206206994597C13D831ec7',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.data.symbol).toBe('USDT');
      expect(body.data.chain_id).toBe(137);
      expect(body.data.quote.USD.price).toBe(1.0001);
    });

    it('should pass convert parameter', async () => {
      const spy = vi.spyOn(priceService, 'getPrice').mockResolvedValueOnce(mockPriceResult);

      await app.inject({
        method: 'GET',
        url: '/api/v1/prices/137/0xdAC17F958D2ee523a2206206994597C13D831ec7?convert=KRW',
      });

      expect(spy).toHaveBeenCalledWith(137, '0xdAC17F958D2ee523a2206206994597C13D831ec7', 'KRW');
    });

    it('should return 404 when token not found', async () => {
      vi.spyOn(priceService, 'getPrice').mockRejectedValueOnce(
        new TokenNotFoundError('Token not found')
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/prices/137/0x0000000000000000000000000000000000000000',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Not Found');
    });

    it('should return 404 when cmc_id not configured', async () => {
      vi.spyOn(priceService, 'getPrice').mockRejectedValueOnce(
        new CmcIdMissingError('CMC ID not set')
      );

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/prices/137/0xdAC17F958D2ee523a2206206994597C13D831ec7',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Not Configured');
    });

    it('should return 500 on CMC API error', async () => {
      vi.spyOn(priceService, 'getPrice').mockRejectedValueOnce(new Error('CMC API error'));

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/prices/137/0xdAC17F958D2ee523a2206206994597C13D831ec7',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Internal Server Error');
    });

    it('should return 400 for invalid address format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/prices/137/invalid-address',
      });

      expect(response.statusCode).toBe(400);
    });

    it('should return 400 for non-numeric chainId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/prices/abc/0xdAC17F958D2ee523a2206206994597C13D831ec7',
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
