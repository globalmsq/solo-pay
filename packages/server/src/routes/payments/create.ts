import { FastifyInstance } from 'fastify';
import { parseUnits } from 'viem';
import { CreatePaymentSchema } from '../../schemas/payment.schema';
import { BlockchainService } from '../../services/blockchain.service';
import { SUPPORTED_CHAINS } from '../../config/chains';

export interface CreatePaymentRequest {
  amount: number;
  currency: string;
  chainId: number;
  recipientAddress: string;
}

export async function createPaymentRoute(
  app: FastifyInstance,
  blockchainService: BlockchainService
) {
  app.post<{ Body: CreatePaymentRequest }>('/payments/create', async (request, reply) => {
    try {
      // 입력 검증
      const validatedData = CreatePaymentSchema.parse(request.body);

      // 체인 검증 - 지원하는 체인인지 확인
      const chain = SUPPORTED_CHAINS.find(c => c.id === validatedData.chainId);
      if (!chain) {
        return reply.code(400).send({
          code: 'UNSUPPORTED_CHAIN',
          message: `Chain ID ${validatedData.chainId} is not supported`,
        });
      }

      // 토큰 주소 조회
      const tokenAddress = blockchainService.getTokenAddress(validatedData.chainId, validatedData.currency);
      if (!tokenAddress) {
        return reply.code(400).send({
          code: 'UNSUPPORTED_TOKEN',
          message: `Token ${validatedData.currency} is not supported on chain ${validatedData.chainId}`,
        });
      }

      // decimals 조회 (fallback: 18)
      const decimals = await blockchainService.getDecimals(
        validatedData.chainId,
        tokenAddress
      );

      // amount를 wei로 변환
      const amountInWei = parseUnits(validatedData.amount.toString(), decimals);

      // 결제 생성
      const paymentId = `pay_${Date.now()}`;

      return reply.code(201).send({
        success: true,
        paymentId,
        tokenAddress,
        gatewayAddress: chain.contracts.gateway,
        forwarderAddress: chain.contracts.forwarder,
        amount: amountInWei.toString(),
        status: 'pending',
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'ZodError') {
        return reply.code(400).send({
          code: 'VALIDATION_ERROR',
          message: '입력 검증 실패',
          details: (error as { errors?: unknown[] }).errors,
        });
      }
      const message = error instanceof Error ? error.message : '결제를 생성할 수 없습니다';
      return reply.code(500).send({
        code: 'INTERNAL_ERROR',
        message,
      });
    }
  });
}
