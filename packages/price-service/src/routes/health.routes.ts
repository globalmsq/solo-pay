import { FastifyInstance } from 'fastify';
import { isRedisAvailable } from '../lib/redis';
import { readFileSync } from 'fs';
import { join } from 'path';

const { version } = JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));

export async function healthRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /health
   */
  fastify.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Returns service health status including Redis connectivity.',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              service: { type: 'string' },
              version: { type: 'string' },
              timestamp: { type: 'string' },
              redis: { type: 'boolean' },
            },
          },
        },
      },
    },
    async () => {
      return {
        status: 'healthy',
        service: 'price-service',
        version,
        timestamp: new Date().toISOString(),
        redis: isRedisAvailable(),
      };
    }
  );

  /**
   * GET /ready
   */
  fastify.get(
    '/ready',
    {
      schema: {
        tags: ['Health'],
        summary: 'Readiness check',
        description: 'Returns 200 if Redis is available, 503 otherwise.',
        response: {
          200: {
            type: 'object',
            properties: {
              ready: { type: 'boolean' },
            },
          },
          503: {
            type: 'object',
            properties: {
              ready: { type: 'boolean' },
              reason: { type: 'string' },
            },
          },
        },
      },
    },
    async (_request, reply) => {
      if (!isRedisAvailable()) {
        reply.status(503);
        return { ready: false, reason: 'Redis not available' };
      }
      return { ready: true };
    }
  );
}
