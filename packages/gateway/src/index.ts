import Fastify from 'fastify';
import cors from '@fastify/cors';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { createLogger } from './lib/logger';
import { swaggerConfig, swaggerUiConfig } from './docs/swagger.config';
import { BlockchainService } from './services/blockchain.service';
import { RelayerService } from './services/relayer.service';
import { PaymentService } from './services/payment.service';
import { MerchantService } from './services/merchant.service';
import { ChainService } from './services/chain.service';
import { TokenService } from './services/token.service';
import { PaymentMethodService } from './services/payment-method.service';
import { RelayService } from './services/relay.service';
import { GasFaucetService } from './services/gas-faucet.service';
import { ServerSigningService } from './services/signature-server.service';
import { getPrismaClient, disconnectPrisma } from './db/client';
import { getRedisClient, disconnectRedis } from './db/redis';
import { createPaymentRoute } from './routes/payments/create';
import { createPublicPaymentRoute } from './routes/payments/create-public';
import { prepareWalletRoute } from './routes/payments/prepare-wallet';
import { paymentDetailRoute } from './routes/payments/payment-detail';
import { paymentInfoRoute } from './routes/payments/info';
import { getPaymentStatusRoute } from './routes/payments/status';
import { submitGaslessRoute } from './routes/payments/gasless';
import { getRelayStatusRoute } from './routes/payments/relay-status';
import { getPaymentHistoryRoute } from './routes/payments/history';
import { getTokenBalanceRoute } from './routes/tokens/balance';
import { getTokenAllowanceRoute } from './routes/tokens/allowance';
import { getTransactionStatusRoute } from './routes/transactions/status';
import { updateMerchantRoute } from './routes/merchants/update';
import { getMerchantRoute } from './routes/merchants/get';
import { merchantPublicKeyRoute } from './routes/merchants/public-key';
import { paymentMethodsRoute } from './routes/merchants/payment-methods';
import { getChainsRoute } from './routes/chains/get';

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

// Route auth (same merchant key and API):
// - createMerchantAuthMiddleware: POST /payments/create, POST /payments/info (body.merchantId must match x-api-key owner)
// - createPaymentAuthMiddleware: POST /payments/:id/gasless, POST /payments/:id/relay (payment must belong to x-api-key owner)
// - createAuthMiddleware: GET /merchants/me, PATCH /merchants/me, payment-methods (no body.merchantId; uses request.merchant only)
const registerRoutes = async () => {
  const gasFaucetService = new GasFaucetService(blockchainService, chainService, prisma);

  // Health check endpoint
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

  // Root endpoint
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

  await createPaymentRoute(
    server,
    blockchainService,
    merchantService,
    chainService,
    tokenService,
    paymentMethodService,
    paymentService,
    signingServices
  );
  await createPublicPaymentRoute(
    server,
    blockchainService,
    merchantService,
    chainService,
    tokenService,
    paymentMethodService,
    paymentService,
    signingServices
  );
  await prepareWalletRoute(
    server,
    blockchainService,
    merchantService,
    paymentService,
    paymentMethodService,
    tokenService,
    gasFaucetService
  );
  await paymentDetailRoute(server, blockchainService, merchantService, paymentService);
  await paymentInfoRoute(
    server,
    blockchainService,
    merchantService,
    chainService,
    tokenService,
    paymentMethodService
  );
  await getPaymentStatusRoute(server, blockchainService, paymentService);
  await submitGaslessRoute(server, relayerService, relayService, paymentService, merchantService);
  await getRelayStatusRoute(server, relayerService);
  await getPaymentHistoryRoute(server, blockchainService, paymentService, relayService);
  await getTokenBalanceRoute(server, blockchainService);
  await getTokenAllowanceRoute(server, blockchainService);
  await getTransactionStatusRoute(server, blockchainService);
  await getChainsRoute(server, chainService, tokenService);
  await updateMerchantRoute(server, merchantService);
  await getMerchantRoute(server, merchantService, paymentMethodService, tokenService, chainService);
  await merchantPublicKeyRoute(server, merchantService);
  await paymentMethodsRoute(
    server,
    merchantService,
    paymentMethodService,
    tokenService,
    chainService
  );
};

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  logger.info(`\n📢 Received ${signal}, shutting down gracefully...`);
  try {
    await server.close();
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
