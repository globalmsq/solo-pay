import type { FastifyDynamicSwaggerOptions } from '@fastify/swagger';
import type { FastifySwaggerUiOptions } from '@fastify/swagger-ui';

export const swaggerConfig: FastifyDynamicSwaggerOptions = {
  openapi: {
    info: {
      title: 'Faucet Manager API',
      description:
        'One-time gas grant (faucet) per wallet per chain for approve gas. Public Key + Origin auth.',
      version: '0.1.0',
    },
    servers: [{ url: '/', description: 'Current server' }],
    tags: [
      { name: 'Payments', description: 'Request gas for approve' },
      { name: 'Health', description: 'Liveness' },
    ],
  },
};

export const swaggerUiConfig: FastifySwaggerUiOptions = {
  routePrefix: '/api-docs',
  uiConfig: {
    docExpansion: 'list',
    displayRequestDuration: true,
  },
};
