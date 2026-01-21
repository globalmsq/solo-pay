import { FastifyInstance } from 'fastify';
import { BlockchainService } from '../../services/blockchain.service';
import { PaymentService } from '../../services/payment.service';
import { RelayService } from '../../services/relay.service';
import { ErrorResponseSchema } from '../../docs/schemas';

export async function getPaymentHistoryRoute(
  app: FastifyInstance,
  blockchainService: BlockchainService,
  paymentService: PaymentService,
  relayService: RelayService
) {
  app.get<{ Querystring: { chainId: string; payer: string; limit?: string } }>(
    '/payments/history',
    {
      schema: {
        operationId: 'getPaymentHistory',
        tags: ['Payments'],
        summary: 'Get payment history',
        description: 'Returns payment history for a payer address from blockchain events',
        querystring: {
          type: 'object',
          properties: {
            chainId: { type: 'integer', description: 'Blockchain network ID', example: 31337 },
            payer: {
              type: 'string',
              pattern: '^0x[a-fA-F0-9]{40}$',
              description: 'Payer wallet address',
            },
            limit: {
              type: 'string',
              description: 'Block range limit (default: 1000)',
              example: '1000',
            },
          },
          required: ['chainId', 'payer'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean', example: true },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    paymentId: { type: 'string', description: 'Payment ID (bytes32)' },
                    payer: { type: 'string', description: 'Payer wallet address' },
                    merchant: { type: 'string', description: 'Merchant wallet address' },
                    token: { type: 'string', description: 'Token contract address' },
                    tokenSymbol: { type: 'string', description: 'Token symbol (e.g., TEST)' },
                    decimals: { type: 'integer', description: 'Token decimals' },
                    amount: { type: 'string', description: 'Payment amount in wei' },
                    timestamp: { type: 'string', description: 'Block timestamp (unix seconds)' },
                    transactionHash: { type: 'string', description: 'Transaction hash' },
                    status: { type: 'string', description: 'Payment status' },
                    isGasless: { type: 'boolean', description: 'Whether payment was gasless' },
                    relayId: {
                      type: 'string',
                      nullable: true,
                      description: 'Relay request ID (gasless only)',
                    },
                  },
                },
              },
            },
          },
          400: ErrorResponseSchema,
          500: ErrorResponseSchema,
        },
      },
    },
    async (request, reply) => {
      try {
        const { chainId, payer, limit } = request.query;

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

        if (!payer || typeof payer !== 'string') {
          return reply.code(400).send({
            code: 'INVALID_REQUEST',
            message: 'payer 주소는 필수입니다',
          });
        }

        // 주소 형식 검증
        if (!payer.startsWith('0x') || payer.length !== 42) {
          return reply.code(400).send({
            code: 'INVALID_REQUEST',
            message: '유효한 지갑 주소 형식이 아닙니다',
          });
        }

        const blockRange = limit ? parseInt(limit, 10) : 1000;
        const payments = await blockchainService.getPaymentHistory(chainIdNum, payer, blockRange);

        // DB에서 각 payment에 대해 relay 정보 조회하여 isGasless 설정
        const enrichedPayments = await Promise.all(
          payments.map(async (payment) => {
            try {
              // payment_hash로 DB에서 payment 조회
              const dbPayment = await paymentService.findByHash(payment.paymentId);
              if (dbPayment) {
                // relay_requests 테이블에서 해당 payment_id로 조회
                const relayRequests = await relayService.findByPaymentId(dbPayment.id);
                if (relayRequests.length > 0) {
                  return {
                    ...payment,
                    isGasless: true,
                    relayId: relayRequests[0].relay_ref,
                  };
                }
              }
              return payment;
            } catch {
              // DB 조회 실패 시 기본값 유지
              return payment;
            }
          })
        );

        return reply.code(200).send({
          success: true,
          data: enrichedPayments,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : '결제 이력을 조회할 수 없습니다';
        return reply.code(500).send({
          code: 'INTERNAL_ERROR',
          message,
        });
      }
    }
  );
}
