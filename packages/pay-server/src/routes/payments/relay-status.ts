import { FastifyInstance } from 'fastify';
import { RelayerService } from '../../services/relayer.service';

/**
 * Get relay transaction status
 *
 * Polls the relayer for transaction status
 */
export async function getRelayStatusRoute(
  app: FastifyInstance,
  relayerService: RelayerService
) {
  app.get<{ Params: { relayRequestId: string } }>(
    '/payments/relay/:relayRequestId/status',
    async (request, reply) => {
      try {
        const { relayRequestId } = request.params;

        if (!relayRequestId || typeof relayRequestId !== 'string') {
          return reply.code(400).send({
            success: false,
            code: 'INVALID_REQUEST',
            message: '릴레이 요청 ID는 필수입니다',
          });
        }

        // Query Defender for relay status
        const result = await relayerService.getRelayStatus(relayRequestId);

        return reply.code(200).send({
          success: true,
          relayRequestId: result.relayRequestId,
          transactionHash: result.transactionHash,
          status: result.status,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '릴레이 상태를 조회할 수 없습니다';

        // Check if it's a "not found" error
        if (message.includes('찾을 수 없습니다') || message.includes('not found')) {
          return reply.code(404).send({
            success: false,
            code: 'RELAY_NOT_FOUND',
            message,
          });
        }

        return reply.code(500).send({
          success: false,
          code: 'INTERNAL_ERROR',
          message,
        });
      }
    }
  );
}
