import { FastifyInstance } from 'fastify';
import { BlockchainService } from '../../services/blockchain.service';
import { TokenBalanceResponseSchema, ErrorResponseSchema } from '../../docs/schemas';

export async function getTokenBalanceRoute(
  app: FastifyInstance,
  blockchainService: BlockchainService
) {
  app.get<{
    Params: { tokenAddress: string };
    Querystring: { chainId: string; address: string };
  }>(
    '/tokens/:tokenAddress/balance',
    {
      schema: {
        operationId: 'getTokenBalance',
        tags: ['Tokens'],
        summary: 'Get token balance',
        description: 'Returns the ERC20 token balance for a wallet address',
        params: {
          type: 'object',
          properties: {
            tokenAddress: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'ERC20 token contract address',
              example: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
            },
          },
          required: ['tokenAddress'],
        },
        querystring: {
          type: 'object',
          properties: {
            chainId: {
              type: 'integer',
              description: 'Blockchain network ID',
              example: 31337,
            },
            address: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Wallet address to check balance',
              example: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
            },
          },
          required: ['chainId', 'address'],
        },
        response: {
          200: TokenBalanceResponseSchema,
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { tokenAddress } = request.params;
        const { chainId, address } = request.query;

        // chainId 필수 검증
        if (!chainId) {
          return reply.code(400).send({
            code: 'INVALID_REQUEST',
            message: 'chainId는 필수입니다',
          });
        }

        const chainIdNum = Number(chainId);
        if (isNaN(chainIdNum)) {
          return reply.code(400).send({
            code: 'INVALID_REQUEST',
            message: '유효한 chainId가 아닙니다',
          });
        }

        // 체인 지원 여부 확인
        if (!blockchainService.isChainSupported(chainIdNum)) {
          return reply.code(400).send({
            code: 'UNSUPPORTED_CHAIN',
            message: 'Unsupported chain',
          });
        }

        // 토큰 주소 검증
        if (!tokenAddress || !tokenAddress.startsWith('0x') || tokenAddress.length !== 42) {
          return reply.code(400).send({
            code: 'INVALID_REQUEST',
            message: '유효한 토큰 주소 형식이 아닙니다',
          });
        }

        // 지갑 주소 검증
        if (!address || !address.startsWith('0x') || address.length !== 42) {
          return reply.code(400).send({
            code: 'INVALID_REQUEST',
            message: '유효한 지갑 주소 형식이 아닙니다',
          });
        }

        const balance = await blockchainService.getTokenBalance(chainIdNum, tokenAddress, address);

        return reply.code(200).send({
          success: true,
          data: { balance },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '토큰 잔액을 조회할 수 없습니다';
        return reply.code(500).send({
          code: 'INTERNAL_ERROR',
          message,
        });
      }
    }
  );
}
