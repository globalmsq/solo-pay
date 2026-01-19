import { FastifyInstance } from 'fastify';
import { ChainService } from '../../services/chain.service';
import { TokenService } from '../../services/token.service';

export async function getChainsRoute(
  app: FastifyInstance,
  chainService: ChainService,
  tokenService: TokenService
) {
  // GET /chains - Get all available chains (public endpoint)
  app.get('/chains', async (request, reply) => {
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
  });

  // GET /chains/tokens - Get all available chains with their tokens (public endpoint)
  app.get('/chains/tokens', async (request, reply) => {
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
  });
}
