import { FastifyDynamicSwaggerOptions } from '@fastify/swagger';
import { FastifySwaggerUiOptions } from '@fastify/swagger-ui';

export const swaggerConfig: FastifyDynamicSwaggerOptions = {
  openapi: {
    info: {
      title: 'Solo Pay Price Service API',
      description: `
## Overview
Token price service that fetches real-time cryptocurrency prices from CoinMarketCap API with Redis caching.

## How It Works
- Tokens are whitelisted in the database with their CoinMarketCap ID (\`cmc_id\`)
- Prices are looked up by chain ID and contract address
- Results are cached in Redis with a configurable TTL (default 60s)
- CoinMarketCap data refreshes approximately every 60 seconds

## Flow
1. Client sends request with \`chainId\` and \`address\`
2. Service checks Redis cache
3. On cache miss: looks up token in DB, fetches price from CMC by \`cmc_id\`
4. Caches result and returns

## Error Codes
- **404 Not Found**: Token not registered in whitelist
- **404 Not Configured**: Token exists but \`cmc_id\` is not set
- **500 Internal Server Error**: CMC API failure or unexpected error
      `,
      version: '1.0.0',
    },
    servers: [
      {
        url: '/',
        description: 'Current Server',
      },
      {
        url: 'http://localhost:3003',
        description: 'Local Development',
      },
    ],
    tags: [
      {
        name: 'Prices',
        description: 'Token price lookup by chain ID and contract address.',
      },
      {
        name: 'Health',
        description: 'Service health and readiness checks.',
      },
    ],
  },
};

export const swaggerUiConfig: FastifySwaggerUiOptions = {
  routePrefix: '/api-docs',
  uiConfig: {
    docExpansion: 'list',
    deepLinking: true,
    displayRequestDuration: true,
    filter: true,
    syntaxHighlight: {
      activate: true,
      theme: 'monokai',
    },
  },
  staticCSP: false,
};
