import { FastifyInstance } from 'fastify';
import { parseUnits, keccak256, toHex } from 'viem';
import { CreatePaymentSchema } from '../../schemas/payment.schema';
import { BlockchainService } from '../../services/blockchain.service';

export interface CreatePaymentRequest {
  merchantId: string;
  orderId: string;
  amount: number;
  currency: string;
  chainId: number;
  tokenAddress: string;
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

      // 1. 체인 지원 여부 확인
      if (!blockchainService.isChainSupported(validatedData.chainId)) {
        return reply.code(400).send({
          code: 'UNSUPPORTED_CHAIN',
          message: 'Unsupported chain',
        });
      }

      // 2. 토큰 검증: 심볼 존재 + 주소 일치 확인
      const tokenAddress = validatedData.tokenAddress;
      if (!tokenAddress) {
        return reply.code(400).send({
          code: 'INVALID_REQUEST',
          message: 'tokenAddress is required',
        });
      }

      if (!blockchainService.validateToken(validatedData.chainId, validatedData.currency, tokenAddress)) {
        return reply.code(400).send({
          code: 'UNSUPPORTED_TOKEN',
          message: 'Unsupported token',
        });
      }

      // 3. 토큰 설정 가져오기 (decimals 등)
      const tokenConfig = blockchainService.getTokenConfig(validatedData.chainId, validatedData.currency);
      if (!tokenConfig) {
        return reply.code(400).send({
          code: 'UNSUPPORTED_TOKEN',
          message: 'Unsupported token',
        });
      }

      // amount를 wei로 변환 (설정된 decimals 사용)
      const amountInWei = parseUnits(validatedData.amount.toString(), tokenConfig.decimals);

      // 체인 컨트랙트 정보 조회
      const contracts = blockchainService.getChainContracts(validatedData.chainId);

      // 결제 생성: merchantId + orderId + timestamp 기반 bytes32 해시 생성
      const paymentId = keccak256(
        toHex(`${validatedData.merchantId}:${validatedData.orderId}:${Date.now()}`)
      );

      return reply.code(201).send({
        success: true,
        paymentId,
        chainId: validatedData.chainId,
        tokenAddress: tokenConfig.address,
        gatewayAddress: contracts?.gateway,
        forwarderAddress: contracts?.forwarder,
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
