import Fastify, { FastifyInstance } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { PriceService, PriceServiceConfig } from './services/price.service';
import { priceRoutes } from './routes/price.routes';
import { healthRoutes } from './routes/health.routes';
import { swaggerConfig, swaggerUiConfig } from './docs/swagger.config';
import { getPrismaClient, disconnectPrisma } from './db/client';
import { disconnectRedis } from './lib/redis';

export interface ServerConfig {
  host: string;
  port: number;
  priceService: PriceServiceConfig;
}

export async function buildServer(config: ServerConfig): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
              },
            }
          : undefined,
    },
  });

  await fastify.register(swagger, swaggerConfig);
  await fastify.register(swaggerUi, swaggerUiConfig);

  const prisma = getPrismaClient();
  const priceService = new PriceService(config.priceService, prisma);

  await fastify.register(priceRoutes, { priceService });
  await fastify.register(healthRoutes);

  fastify.addHook('onClose', async () => {
    fastify.log.info('Server shutting down...');
    await disconnectPrisma();
    await disconnectRedis();
  });

  return fastify;
}

export async function startServer(): Promise<void> {
  const apiKey = process.env.CMC_API_KEY;

  if (!apiKey) {
    console.error('CMC_API_KEY environment variable is required');
    process.exit(1);
  }

  const config: ServerConfig = {
    host: process.env.HOST ?? '0.0.0.0',
    port: parseInt(process.env.PORT ?? '3003', 10),
    priceService: {
      apiKey,
      cacheTtl: parseInt(process.env.CACHE_TTL ?? '60', 10),
    },
  };

  try {
    const server = await buildServer(config);

    await server.listen({ host: config.host, port: config.port });

    console.log(`
╔══════════════════════════════════════════════════════════╗
║                   Price Service                          ║
╠══════════════════════════════════════════════════════════╣
║  Status:     Running                                     ║
║  Host:       ${config.host.padEnd(43)}║
║  Port:       ${String(config.port).padEnd(43)}║
║  Cache TTL:  ${String(config.priceService.cacheTtl + 's').padEnd(43)}║
╠══════════════════════════════════════════════════════════╣
║  Endpoints:                                              ║
║    GET /api/v1/prices/:chainId/:address  - Token price   ║
║    GET /health                           - Health check  ║
║    GET /ready                            - Readiness     ║
║    GET /api-docs                         - Swagger UI    ║
╚══════════════════════════════════════════════════════════╝
    `);

    const signals = ['SIGINT', 'SIGTERM'];
    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`\nReceived ${signal}, shutting down gracefully...`);
        await server.close();
        process.exit(0);
      });
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}
