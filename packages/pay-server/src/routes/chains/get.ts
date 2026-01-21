import { FastifyInstance } from 'fastify';
import { ChainService } from '../../services/chain.service';
import { TokenService } from '../../services/token.service';
import { ErrorResponseSchema } from '../../docs/schemas';

export async function getChainsRoute(
  app: FastifyInstance,
  chainService: ChainService,
  tokenService: TokenService
) {
  // GET /chains - Get all available chains (public endpoint)
  app.get(
    '/chains',
    {
      schema: {
        operationId: 'getChains',
        tags: ['Chains'],
        summary: 'Get all chains',
        description: 'Returns all available blockchain networks (public endpoint)',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              chains: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    network_id: { type: 'integer', example: 31337 },
                    name: { type: 'string', example: 'Hardhat Local' },
                    is_testnet: { type: 'boolean' },
                  },
                },
              },
            },
          },
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        // Get all enabled chains
        const chains = await chainService.findAll();

        return reply.code(200).send({
          success: true,
          chains: chains.map((chain) => ({
            id: chain.id,
            network_id: chain.network_id,
            name: chain.name,
            is_testnet: chain.is_testnet,
          })),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get chains';
        request.log.error(error, 'Failed to get chains');
        return reply.code(500).send({
          code: 'INTERNAL_ERROR',
          message,
        });
      }
    }
  );

  // GET /chains/tokens - Get all available chains with their tokens (public endpoint)
  app.get(
    '/chains/tokens',
    {
      schema: {
        operationId: 'getChainsWithTokens',
        tags: ['Chains'],
        summary: 'Get all chains with tokens',
        description:
          'Returns all available blockchain networks with their supported tokens (public endpoint)',
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              chains: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    network_id: { type: 'integer', example: 31337 },
                    name: { type: 'string', example: 'Hardhat Local' },
                    is_testnet: { type: 'boolean' },
                    tokens: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'integer' },
                          address: {
                            type: 'string',
                            example: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
                          },
                          symbol: { type: 'string', example: 'USDT' },
                          decimals: { type: 'integer', example: 6 },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        // Get all enabled chains
        const allChains = await chainService.findAll();
        const chainIds = allChains.map((chain) => chain.id);
        const allTokens = await tokenService.findAllForChains(chainIds, false);

        // Group tokens by chain_id
        const tokensByChainId = new Map<number, typeof allTokens>();
        for (const token of allTokens) {
          if (!tokensByChainId.has(token.chain_id)) {
            tokensByChainId.set(token.chain_id, []);
          }
          tokensByChainId.get(token.chain_id)?.push(token);
        }

        // Return all chains with their tokens
        const chainsWithTokens = allChains.map((chain) => {
          const tokens = tokensByChainId.get(chain.id) || [];
          return {
            id: chain.id,
            network_id: chain.network_id,
            name: chain.name,
            is_testnet: chain.is_testnet,
            tokens: tokens.map((token) => ({
              id: token.id,
              address: token.address,
              symbol: token.symbol,
              decimals: token.decimals,
            })),
          };
        });

        return reply.code(200).send({
          success: true,
          chains: chainsWithTokens,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get chains and tokens';
        request.log.error(error, 'Failed to get chains and tokens');
        return reply.code(500).send({
          code: 'INTERNAL_ERROR',
          message,
        });
      }
    }
  );
}
