import { FastifyInstance } from 'fastify';
import { BlockchainService } from '../../services/blockchain.service';

export async function getTransactionStatusRoute(
  app: FastifyInstance,
  blockchainService: BlockchainService
) {
  app.get<{
    Params: { txHash: string };
    Querystring: { chainId: string };
  }>('/transactions/:txHash/status', async (request, reply) => {
    try {
      const { txHash } = request.params;
      const { chainId } = request.query;

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

      // 트랜잭션 해시 검증
      if (!txHash || !txHash.startsWith('0x') || txHash.length !== 66) {
        return reply.code(400).send({
          code: 'INVALID_REQUEST',
          message: '유효한 트랜잭션 해시 형식이 아닙니다',
        });
      }

      const status = await blockchainService.getTransactionStatus(chainIdNum, txHash);

      return reply.code(200).send({
        success: true,
        data: status,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '트랜잭션 상태를 조회할 수 없습니다';
      return reply.code(500).send({
        code: 'INTERNAL_ERROR',
        message,
      });
    }
  });
}
