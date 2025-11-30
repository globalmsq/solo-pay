import { z } from 'zod';

// 결제 생성 요청 스키마
export const CreatePaymentSchema = z.object({
  amount: z.number().positive('금액은 양수여야 합니다'),
  currency: z.string().min(1, '토큰 심볼은 필수입니다'),
  chainId: z.number().int().positive('지원하는 체인 ID여야 합니다'),
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

// Gasless 요청 스키마
export const GaslessRequestSchema = z.object({
  paymentId: z.string(),
  forwarderAddress: z.string().startsWith('0x').length(42),
  signature: z.string().startsWith('0x'),
});

export type GaslessRequest = z.infer<typeof GaslessRequestSchema>;

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
