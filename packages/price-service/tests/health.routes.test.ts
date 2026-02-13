import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { healthRoutes } from '../src/routes/health.routes';

const mockIsRedisAvailable = vi.fn();

vi.mock('../src/lib/redis', () => ({
  isRedisAvailable: (...args: unknown[]) => mockIsRedisAvailable(...args),
  getRedisClient: vi.fn(),
  disconnectRedis: vi.fn().mockResolvedValue(undefined),
}));

describe('Health Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = Fastify({ logger: false });
    await app.register(healthRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.restoreAllMocks();
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      mockIsRedisAvailable.mockReturnValue(true);

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('healthy');
      expect(body.service).toBe('price-service');
      expect(body.version).toBe('1.0.0');
      expect(body.redis).toBe(true);
      expect(body.timestamp).toBeDefined();
    });

    it('should show redis as false when unavailable', async () => {
      mockIsRedisAvailable.mockReturnValue(false);

      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      const body = JSON.parse(response.body);
      expect(body.redis).toBe(false);
    });
  });

  describe('GET /ready', () => {
    it('should return ready when redis is available', async () => {
      mockIsRedisAvailable.mockReturnValue(true);

      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.ready).toBe(true);
    });

    it('should return 503 when redis is unavailable', async () => {
      mockIsRedisAvailable.mockReturnValue(false);

      const response = await app.inject({
        method: 'GET',
        url: '/ready',
      });

      expect(response.statusCode).toBe(503);
      const body = JSON.parse(response.body);
      expect(body.ready).toBe(false);
      expect(body.reason).toBe('Redis not available');
    });
  });
});
