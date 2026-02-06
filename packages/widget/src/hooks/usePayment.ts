import { useCallback } from 'react';
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useReadContract,
} from 'wagmi';
import { PAYMENT_GATEWAY_ABI } from '../lib/contracts';
import type { PaymentDetails } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface UsePaymentParams {
  /** Payment details from API */
  paymentDetails: PaymentDetails | null;
}

export interface UsePaymentReturn {
  /** Execute payment transaction */
  pay: () => void;
  /** Whether payment transaction is pending user signature */
  isPaying: boolean;
  /** Whether payment transaction is confirming on-chain */
  isConfirming: boolean;
  /** Payment transaction hash */
  txHash: `0x${string}` | undefined;
  /** Payment error */
  error: Error | null;
  /** Whether payment is already processed */
  isAlreadyProcessed: boolean;
  /** Check if payment was processed */
  checkIfProcessed: () => Promise<boolean>;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for executing payment transactions
 *
 * Calls the PaymentGateway.pay() function with the payment details from API.
 *
 * @example
 * ```tsx
 * const { pay, isPaying, isConfirming, txHash, error } = usePayment({
 *   paymentDetails,
 * });
 *
 * // Execute payment
 * const handlePay = () => {
 *   pay();
 * };
 *
 * // Show transaction hash when complete
 * if (txHash) {
 *   console.log('Payment submitted:', txHash);
 * }
 * ```
 */
export function usePayment({ paymentDetails }: UsePaymentParams): UsePaymentReturn {
  const gatewayAddress = paymentDetails?.gatewayAddress as `0x${string}` | undefined;
  const tokenAddress = paymentDetails?.tokenAddress as `0x${string}` | undefined;
  const paymentId = paymentDetails?.paymentId as `0x${string}` | undefined;
  const amount = paymentDetails?.amount ? BigInt(paymentDetails.amount) : undefined;

  // Check if payment is already processed
  const { data: isProcessed, refetch: refetchProcessed } = useReadContract({
    address: gatewayAddress,
    abi: PAYMENT_GATEWAY_ABI,
    functionName: 'processedPayments',
    args: paymentId ? [paymentId] : undefined,
    query: {
      enabled: !!gatewayAddress && !!paymentId,
    },
  });

  // Write pay
  const {
    writeContract,
    data: txHash,
    isPending: isPaying,
    error: writeError,
  } = useWriteContract();

  // Wait for transaction confirmation
  const {
    isLoading: isConfirming,
    error: receiptError,
  } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Pay function
  const pay = useCallback(() => {
    if (!gatewayAddress || !tokenAddress || !paymentId || !amount) {
      console.error('Missing payment details for pay transaction');
      return;
    }

    writeContract({
      address: gatewayAddress,
      abi: PAYMENT_GATEWAY_ABI,
      functionName: 'pay',
      args: [paymentId, tokenAddress, amount],
    });
  }, [gatewayAddress, tokenAddress, paymentId, amount, writeContract]);

  // Check if payment was processed
  const checkIfProcessed = useCallback(async (): Promise<boolean> => {
    const result = await refetchProcessed();
    return result.data === true;
  }, [refetchProcessed]);

  return {
    pay,
    isPaying,
    isConfirming,
    txHash,
    error: writeError || receiptError || null,
    isAlreadyProcessed: isProcessed === true,
    checkIfProcessed,
  };
}
