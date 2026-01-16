import { z } from 'zod';
import { decodeFunctionData } from 'viem';
import PaymentGatewayV1Artifact from '@msq/pay-contracts/artifacts/src/PaymentGatewayV1.sol/PaymentGatewayV1.json';

// 결제 생성 요청 스키마
export const CreatePaymentSchema = z.object({
  merchantId: z.string().min(1, '상점 ID는 필수입니다'),
  amount: z.number().positive('금액은 양수여야 합니다'),
  chainId: z.number().int().positive('지원하는 체인 ID여야 합니다'),
  tokenAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, '유효한 토큰 주소여야 합니다 (0x + 40자 hex)'),
  recipientAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/, '유효한 Ethereum 주소여야 합니다 (0x + 40자 hex)'),
});

export type CreatePaymentRequest = z.infer<typeof CreatePaymentSchema>;

// 결제 상태 조회 응답 스키마
export const PaymentStatusSchema = z.object({
  paymentId: z.string(),
  userId: z.string(),
  amount: z.number(),
  tokenAddress: z.string(),
  tokenSymbol: z.string(),
  recipientAddress: z.string(),
  status: z.enum(['pending', 'confirmed', 'failed', 'completed']),
  transactionHash: z.string().optional(),
  blockNumber: z.number().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PaymentStatus = z.infer<typeof PaymentStatusSchema>;

/**
 * ERC2771 ForwardRequest 스키마
 * OZ ERC2771Forwarder.execute()에 전달되는 파라미터
 *
 * nonce는 클라이언트가 서명 시 사용한 값을 그대로 전달해야 함.
 * 서버에서 재조회하면 서명 검증이 실패함.
 */
export const ForwardRequestSchema = z.object({
  from: z.string().startsWith('0x').length(42),
  to: z.string().startsWith('0x').length(42),
  value: z.string(),
  gas: z.string(),
  nonce: z.string(), // 클라이언트가 서명 시 사용한 nonce
  deadline: z.string(),
  data: z.string().startsWith('0x'),
  signature: z.string().startsWith('0x'),
});

export type ForwardRequest = z.infer<typeof ForwardRequestSchema>;

// Gasless 요청 스키마
export const GaslessRequestSchema = z.object({
  paymentId: z.string(),
  forwarderAddress: z.string().startsWith('0x').length(42),
  forwardRequest: ForwardRequestSchema,
});

export type GaslessRequest = z.infer<typeof GaslessRequestSchema>;

/**
 * Creates a refined GaslessRequestSchema that validates the forwardRequest.data
 * amount matches the expected DB amount.
 * This prevents frontend manipulation and gas waste.
 */
export function createAmountValidationSchema(
  expectedAmount: bigint
): z.ZodType<GaslessRequest> {
  return GaslessRequestSchema.superRefine((data, ctx) => {
    try {
      const decoded = decodeFunctionData({
        abi: PaymentGatewayV1Artifact.abi,
        data: data.forwardRequest.data as `0x${string}`,
      });

      // Verify it's a pay() function call
      if (decoded.functionName !== 'pay') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'forwardRequest.data는 pay() 함수 호출이어야 합니다',
          path: ['forwardRequest', 'data'],
        });
        return;
      }

      // Extract amount from decoded function arguments (3rd parameter, index 2)
      const decodedAmount = decoded?.args?.[2] as bigint;

      // Compare amounts - reject if mismatch
      if (decodedAmount !== expectedAmount) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `결제 금액이 일치하지 않습니다. DB: ${expectedAmount.toString()}, 요청: ${decodedAmount.toString()}`,
          path: ['forwardRequest', 'data'],
        });
      }
    } catch {
      // If decoding fails, the data is invalid
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'forwardRequest.data를 파싱할 수 없습니다. 유효한 pay() 함수 호출 데이터여야 합니다.',
        path: ['forwardRequest', 'data'],
      });
    }
  });
}

// 릴레이 실행 요청 스키마
export const RelayExecutionSchema = z.object({
  paymentId: z.string(),
  transactionData: z.string().startsWith('0x'),
  gasEstimate: z.number(),
});

export type RelayExecution = z.infer<typeof RelayExecutionSchema>;

// 에러 응답 스키마
export const ErrorResponseSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.any()).optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
