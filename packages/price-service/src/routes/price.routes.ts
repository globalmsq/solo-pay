import { FastifyInstance } from 'fastify';
import { PriceService, TokenNotFoundError, CmcIdMissingError } from '../services/price.service';

export async function priceRoutes(
  fastify: FastifyInstance,
  options: { priceService: PriceService }
): Promise<void> {
  const { priceService } = options;

  const tokenQuoteSchema = {
    type: 'object',
    properties: {
      price: { type: 'number' },
      volume_24h: { type: 'number' },
      percent_change_1h: { type: 'number' },
      percent_change_24h: { type: 'number' },
      percent_change_7d: { type: 'number' },
      market_cap: { type: 'number' },
      last_updated: { type: 'string' },
    },
  };

  const dataResponseSchema = {
    type: 'object',
    properties: {
      data: {
        type: 'object',
        properties: {
          id: { type: 'number' },
          name: { type: 'string' },
          symbol: { type: 'string' },
          address: { type: 'string' },
          chain_id: { type: 'number' },
          quote: {
            type: 'object',
            additionalProperties: tokenQuoteSchema,
          },
        },
      },
    },
  };

  const errorResponseSchema = {
    type: 'object',
    properties: {
      error: { type: 'string' },
      message: { type: 'string' },
    },
  };

  /**
   * GET /api/v1/prices/:chainId/:address
   * Get token price by chain ID and contract address
   * Query: convert=USD
   */
  fastify.get<{
    Params: { chainId: string; address: string };
    Querystring: { convert?: string };
  }>(
    '/api/v1/prices/:chainId/:address',
    {
      schema: {
        tags: ['Prices'],
        summary: 'Get token price',
        description:
          'Look up the current price of a whitelisted token by chain ID and contract address. Results are cached in Redis with a 60s TTL.',
        params: {
          type: 'object',
          required: ['chainId', 'address'],
          properties: {
            chainId: {
              type: 'string',
              pattern: '^[0-9]+$',
              description: 'EIP-155 chain ID (e.g. 137 for Polygon)',
            },
            address: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Token contract address',
            },
          },
        },
        querystring: {
          type: 'object',
          properties: {
            convert: {
              type: 'string',
              default: 'USD',
              description: 'Fiat currency to convert price to (e.g. USD, KRW, EUR)',
            },
          },
        },
        response: {
          200: {
            description: 'Token price data',
            ...dataResponseSchema,
          },
          400: {
            description: 'Invalid request parameters',
            ...errorResponseSchema,
          },
          404: {
            description: 'Token not found or CMC ID not configured',
            ...errorResponseSchema,
          },
          500: {
            description: 'CMC API error or internal server error',
            ...errorResponseSchema,
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const chainId = parseInt(request.params.chainId, 10);
        const { address } = request.params;
        const { convert } = request.query;

        const data = await priceService.getPrice(chainId, address, convert);
        return { data };
      } catch (error) {
        if (error instanceof TokenNotFoundError) {
          reply.status(404);
          return { error: 'Not Found', message: error.message };
        }
        if (error instanceof CmcIdMissingError) {
          reply.status(404);
          return { error: 'Not Configured', message: error.message };
        }
        fastify.log.error(error, 'Failed to get token price');
        reply.status(500);
        return {
          error: 'Internal Server Error',
          message: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );
}
