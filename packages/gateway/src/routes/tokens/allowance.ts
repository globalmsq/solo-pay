import { FastifyInstance } from 'fastify';
import { BlockchainService } from '../../services/blockchain.service';
import { MerchantService } from '../../services/merchant.service';
import { createPublicAuthMiddleware } from '../../middleware/public-auth.middleware';
import { ErrorResponseSchema, TokenAllowanceResponseSchema } from '../../docs/schemas';

export async function getTokenAllowanceRoute(
  app: FastifyInstance,
  blockchainService: BlockchainService,
  merchantService: MerchantService
) {
  const authMiddleware = createPublicAuthMiddleware(merchantService);

  app.get<{
    Params: { tokenAddress: string };
    Querystring: { chainId: string; owner: string; spender: string };
  }>(
    '/tokens/:tokenAddress/allowance',
    {
      schema: {
        operationId: 'getTokenAllowance',
        tags: ['Tokens'],
        summary: 'Get token allowance',
        description:
          'Returns the ERC20 token allowance for a spender address. Requires x-public-key and Origin.',
        headers: {
          type: 'object',
          properties: {
            'x-public-key': {
              type: 'string',
              description: 'Public key (pk_live_xxx or pk_test_xxx)',
            },
            origin: {
              type: 'string',
              description: 'Request origin; must match merchant allowed_domains',
            },
          },
        },
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
            chainId: { type: 'integer', description: 'Blockchain network ID', example: 31337 },
            owner: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Token owner address',
              example: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
            },
            spender: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Spender address (e.g., PaymentGateway)',
              example: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
            },
          },
          required: ['chainId', 'owner', 'spender'],
        },
        response: {
          200: TokenAllowanceResponseSchema,
          400: ErrorResponseSchema,
          401: ErrorResponseSchema,
          403: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
      preHandler: authMiddleware,
    },
    async (request, reply) => {
      try {
        const { tokenAddress } = request.params;
        const { chainId, owner, spender } = request.query;

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

        // owner 주소 검증
        if (!owner || !owner.startsWith('0x') || owner.length !== 42) {
          return reply.code(400).send({
            code: 'INVALID_REQUEST',
            message: '유효한 owner 주소 형식이 아닙니다',
          });
        }

        // spender 주소 검증
        if (!spender || !spender.startsWith('0x') || spender.length !== 42) {
          return reply.code(400).send({
            code: 'INVALID_REQUEST',
            message: '유효한 spender 주소 형식이 아닙니다',
          });
        }

        const allowance = await blockchainService.getTokenAllowance(
          chainIdNum,
          tokenAddress,
          owner,
          spender
        );

        return reply.code(200).send({
          success: true,
          data: { allowance },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '토큰 승인액을 조회할 수 없습니다';
        return reply.code(500).send({
          code: 'INTERNAL_ERROR',
          message,
        });
      }
    }
  );
}
