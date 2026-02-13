import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { createLogger } from './lib/logger';
import { API_V1_BASE_PATH } from './constants';
import { swaggerConfig, swaggerUiConfig } from './docs/swagger.config';
import { BlockchainService } from './services/blockchain.service';
import { RelayerService } from './services/relayer.service';
import { PaymentService } from './services/payment.service';
import { MerchantService } from './services/merchant.service';
import { ChainService } from './services/chain.service';
import { TokenService } from './services/token.service';
import { PaymentMethodService } from './services/payment-method.service';
import { RelayService } from './services/relay.service';
import { ServerSigningService } from './services/signature-server.service';
import { getPrismaClient, disconnectPrisma } from './db/client';
import { getRedisClient, disconnectRedis } from './db/redis';
import { createWebhookQueue } from '@solo-pay/webhook-manager';
import { createPaymentRoute } from './routes/payments/create';
import { paymentDetailRoute } from './routes/payments/payment-detail';
import { getPaymentStatusRoute } from './routes/payments/status';
import { submitGaslessRoute } from './routes/payments/gasless';
import { getTokenBalanceRoute } from './routes/tokens/balance';
import { getTokenAllowanceRoute } from './routes/tokens/allowance';
import { updateMerchantRoute } from './routes/merchants/update';
import { getMerchantRoute } from './routes/merchants/get';
import { merchantPublicKeyRoute } from './routes/merchants/public-key';
import { paymentMethodsRoute } from './routes/merchants/payment-methods';
import { RefundService } from './services/refund.service';
import { createRefundRoute } from './routes/refunds/create';
import { getRefundStatusRoute } from './routes/refunds/status';
import { getRefundListRoute } from './routes/refunds/list';

const server = Fastify({
  logger: true,
  ajv: {
    customOptions: {
      // Allow OpenAPI keywords like 'example' in JSON Schema
      keywords: ['example'],
    },
  },
});

const logger = createLogger('Server');

// Initialize database clients
const prisma = getPrismaClient();
getRedisClient();

// Initialize database services (ChainService needed for BlockchainService initialization)
const chainService = new ChainService(prisma);

// BlockchainService will be initialized after loading chains from DB
let blockchainService: BlockchainService;

// Server signing services (one per chain)
let signingServices: Map<number, ServerSigningService>;

// Initialize Relayer service for gasless transactions
// Production: msq-relayer-service API
// Local: http://simple-relayer:3001
const relayerApiUrl = process.env.RELAY_API_URL || 'http://localhost:3001';
const relayerApiKey = process.env.RELAY_API_KEY || '';
const relayerService = new RelayerService(relayerApiUrl, relayerApiKey);

// Initialize other database services
const paymentService = new PaymentService(prisma);
const merchantService = new MerchantService(prisma);
const tokenService = new TokenService(prisma);
const paymentMethodService = new PaymentMethodService(prisma);
const relayService = new RelayService(prisma);
const refundService = new RefundService(prisma);

// Route auth: createPayment = public key + Origin; gasless = no auth (validated in handler); others = x-api-key
const registerRoutes = async () => {
  // Health and root: no version prefix
  server.get(
    '/health',
    {
      schema: {
        tags: ['Health'],
        summary: 'Health check',
        description: 'Returns server health status',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string', example: 'ok' },
              timestamp: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
    async () => {
      return { status: 'ok', timestamp: new Date().toISOString() };
    }
  );

  server.get(
    '/',
    {
      schema: {
        tags: ['Health'],
        summary: 'Server info',
        description: 'Returns server information and supported chains',
        response: {
          200: {
            type: 'object',
            properties: {
              service: { type: 'string', example: 'Solo Pay Gateway' },
              version: { type: 'string', example: '0.1.0' },
              status: { type: 'string', example: 'running' },
              supportedChains: {
                type: 'array',
                items: { type: 'number' },
                example: [80002, 137],
              },
            },
          },
        },
      },
    },
    async () => {
      return {
        service: 'Solo Pay Gateway',
        version: '0.1.0',
        status: 'running',
        supportedChains: blockchainService.getSupportedChainIds(),
      };
    }
  );

  const webhookQueue = createWebhookQueue(getRedisClient());
  webhookQueueInstance = webhookQueue;

  // All business routes under API_V1_BASE_PATH
  await server.register(
    async (scope) => {
      await createPaymentRoute(
        scope,
        blockchainService,
        merchantService,
        chainService,
        tokenService,
        paymentMethodService,
        paymentService,
        signingServices
      );
      await paymentDetailRoute(
        scope,
        blockchainService,
        merchantService,
        paymentService,
        webhookQueue
      );
      await getPaymentStatusRoute(
        scope,
        blockchainService,
        paymentService,
        merchantService,
        webhookQueue
      );
      await submitGaslessRoute(
        scope,
        relayerService,
        relayService,
        paymentService,
        merchantService
      );
      await getTokenBalanceRoute(scope, blockchainService, merchantService);
      await getTokenAllowanceRoute(scope, blockchainService, merchantService);
      await updateMerchantRoute(scope, merchantService);
      await getMerchantRoute(
        scope,
        merchantService,
        paymentMethodService,
        tokenService,
        chainService
      );
      await merchantPublicKeyRoute(scope, merchantService);
      await paymentMethodsRoute(
        scope,
        merchantService,
        paymentMethodService,
        tokenService,
        chainService
      );
      await createRefundRoute(
        scope,
        merchantService,
        paymentService,
        refundService,
        blockchainService,
        signingServices
      );
      await getRefundStatusRoute(scope, merchantService, paymentService, refundService);
      await getRefundListRoute(scope, merchantService, paymentService, refundService);
    },
    { prefix: API_V1_BASE_PATH }
  );
};

// Graceful shutdown
let webhookQueueInstance: ReturnType<typeof createWebhookQueue> | null = null;

const gracefulShutdown = async (signal: string) => {
  logger.info(`\n📢 Received ${signal}, shutting down gracefully...`);
  try {
    await server.close();
    if (webhookQueueInstance) {
      await webhookQueueInstance.close();
    }
    await disconnectPrisma();
    await disconnectRedis();
    logger.info('✅ Server closed successfully');
    process.exit(0);
  } catch (err) {
    logger.error({ err }, '❌ Error during shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start server
const start = async () => {
  try {
    // Register CORS
    await server.register(cors, {
      origin: true, // Allow all origins in development
    });

    // Register Swagger documentation (must be before routes)
    await server.register(swagger, swaggerConfig);
    await server.register(swaggerUi, swaggerUiConfig);

    // Load chain configuration from database
    logger.info('📋 Loading chain configuration from database...');
    const chainsWithTokens = await chainService.findAllWithTokens();

    if (chainsWithTokens.length === 0) {
      logger.error('❌ No chains with contract addresses found in database');
      logger.error('💡 Make sure chains table has gateway_address and forwarder_address set');
      process.exit(1);
    }

    // Initialize BlockchainService with DB data
    blockchainService = new BlockchainService(chainsWithTokens);
    logger.info(`🔗 Supported chains: ${blockchainService.getSupportedChainIds().join(', ')}`);

    // Initialize server signing services for each chain
    const signerPrivateKey = process.env.SIGNER_PRIVATE_KEY;
    signingServices = new Map();

    if (signerPrivateKey) {
      for (const chain of chainsWithTokens) {
        if (chain.gateway_address) {
          try {
            const service = new ServerSigningService(
              signerPrivateKey as `0x${string}`,
              chain.network_id,
              chain.gateway_address as `0x${string}`
            );
            signingServices.set(chain.network_id, service);
            logger.info(
              `🔐 Signing service initialized for chain ${chain.network_id} (${chain.name})`
            );
          } catch (error) {
            logger.warn(
              { err: error },
              `Failed to initialize signing service for chain ${chain.network_id}`
            );
          }
        }
      }
    } else {
      logger.warn('⚠️  SIGNER_PRIVATE_KEY not set - server signatures will not be generated');
    }

    // Register all routes
    await registerRoutes();

    // Generate Swagger spec after all routes are registered
    await server.ready();

    const port = Number(process.env.PORT) || 3001;
    const host = process.env.HOST || '0.0.0.0';

    await server.listen({ port, host });
    logger.info(`🚀 Server running on http://${host}:${port}`);
    logger.info(`📚 Swagger UI available at http://${host}:${port}/api-docs`);
  } catch (err) {
    server.log.error(err);
    await disconnectPrisma();
    await disconnectRedis();
    process.exit(1);
  }
};

start();
