import { FastifyInstance } from 'fastify';
import { Address } from 'viem';
import { ZodError } from 'zod';
import {
  GaslessRequestSchema,
  ForwardRequest,
  createAmountValidationSchema,
} from '../../schemas/payment.schema';
import { RelayerService } from '../../services/relayer.service';
import { RelayService } from '../../services/relay.service';
import { PaymentService } from '../../services/payment.service';
import { MerchantService } from '../../services/merchant.service';
import { createPaymentAuthMiddleware } from '../../middleware/auth.middleware';

export interface SubmitGaslessRequest {
  paymentId: string;
  forwarderAddress: string;
  forwardRequest: ForwardRequest;
}

export async function submitGaslessRoute(
  app: FastifyInstance,
  relayerService: RelayerService,
  relayService: RelayService,
  paymentService: PaymentService,
  merchantService: MerchantService
) {
  // Auth + payment ownership middleware
  const authMiddleware = createPaymentAuthMiddleware(merchantService, paymentService);

  app.post<{ Params: { id: string }; Body: SubmitGaslessRequest }>(
    '/payments/:id/gasless',
    { preHandler: authMiddleware },
    async (request, reply) => {
      try {
        const { id } = request.params;

        if (!id || typeof id !== 'string') {
          return reply.code(400).send({
            code: 'INVALID_REQUEST',
            message: '결제 ID는 필수입니다',
          });
        }

        // 입력 검증
        let validatedData;
        try {
          validatedData = GaslessRequestSchema.parse(request.body);
        } catch (error) {
          if (error instanceof ZodError) {
            return reply.code(400).send({
              code: 'VALIDATION_ERROR',
              message: '입력 검증 실패',
              details: error.errors,
            });
          }
          throw error;
        }

        // Payment 조회
        const payment = await paymentService.findByHash(id);
        if (!payment) {
          return reply.code(404).send({
            code: 'PAYMENT_NOT_FOUND',
            message: '결제를 찾을 수 없습니다',
          });
        }

        // Validate forwardRequest.data amount matches DB amount prevent frontend manipulation
        const dbAmount = BigInt(payment.amount.toString());
        try {
          validatedData = createAmountValidationSchema(dbAmount).parse(validatedData);
        } catch (error) {
          if (error instanceof ZodError) {
            return reply.code(400).send({
              code: 'VALIDATION_ERROR',
              message: '입력 검증 실패',
              details: error.errors,
            });
          }
          throw error;
        }

        // 이미 처리된 결제인지 확인
        if (payment.status !== 'CREATED' && payment.status !== 'PENDING') {
          return reply.code(400).send({
            code: 'INVALID_PAYMENT_STATUS',
            message: `결제 상태가 ${payment.status}입니다. Gasless 요청은 CREATED 또는 PENDING 상태에서만 가능합니다.`,
          });
        }

        // ForwardRequest 서명 검증
        if (!relayerService.validateTransactionData(validatedData.forwardRequest.signature)) {
          return reply.code(400).send({
            code: 'INVALID_SIGNATURE',
            message: '유효하지 않은 서명 형식입니다',
          });
        }

        // Gasless 거래 제출 (ForwardRequest 포함)
        const result = await relayerService.submitForwardTransaction(
          id,
          validatedData.forwarderAddress as Address,
          validatedData.forwardRequest
        );

        // DB에 RelayRequest 저장
        await relayService.create({
          relay_ref: result.relayRequestId,
          payment_id: payment.id,
        });

        // Payment 상태를 PENDING으로 업데이트
        if (payment.status === 'CREATED') {
          await paymentService.updateStatus(payment.id, 'PENDING');
        }

        return reply.code(202).send({
          success: true,
          relayRequestId: result.relayRequestId,
          status: result.status,
          message: 'Gasless 거래가 제출되었습니다',
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Gasless 거래를 제출할 수 없습니다';
        return reply.code(500).send({
          code: 'INTERNAL_ERROR',
          message,
        });
      }
    }
  );
}
