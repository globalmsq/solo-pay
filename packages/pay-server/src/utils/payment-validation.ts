import { decodeFunctionData } from 'viem';
import PaymentGatewayV1Artifact from '@msq/pay-contracts/artifacts/src/PaymentGatewayV1.sol/PaymentGatewayV1.json';

export type ValidationResult =
  | { success: true }
  | {
      success: false;
      code: string;
      message: string;
      details?: Record<string, unknown>;
    };

/**
 * Validates the forwardRequest.data by:
 * 1. Decoding the encoded pay() function call
 * 2. Extracting the amount parameter
 * 3. Comparing with DB amount to prevent frontend manipulation
 */
export function validateForwardRequestAmount(
  encodedData: string,
  dbAmount: bigint
): ValidationResult {
  try {
    const decoded = decodeFunctionData({
      abi: PaymentGatewayV1Artifact.abi,
      data: encodedData as `0x${string}`,
    });

    // Verify it's a pay() function call
    if (decoded.functionName !== 'pay') {
      return {
        success: false,
        code: 'INVALID_FUNCTION',
        message: 'forwardRequest.data는 pay() 함수 호출이어야 합니다',
      };
    }

    // Extract amount from decoded function arguments (3rd parameter, index 2)
    const decodedAmount = decoded?.args?.[2] as bigint;

    // Compare amounts - reject if mismatch (prevent gas waste from frontend manipulation)
    if (decodedAmount !== dbAmount) {
      return {
        success: false,
        code: 'AMOUNT_MISMATCH',
        message: `결제 금액이 일치하지 않습니다. DB: ${dbAmount.toString()}, 요청: ${decodedAmount.toString()}`,
        details: {
          dbAmount: dbAmount.toString(),
          requestedAmount: decodedAmount.toString(),
        },
      };
    }

    return { success: true };
  } catch (error) {
    // If decoding fails, the data is invalid
    return {
      success: false,
      code: 'INVALID_CALL_DATA',
      message: 'forwardRequest.data를 파싱할 수 없습니다. 유효한 pay() 함수 호출 데이터여야 합니다.',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}
