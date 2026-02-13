import { useCallback } from 'react';
import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseGwei } from 'viem';
import { PAYMENT_GATEWAY_ABI } from '../lib/contracts';
import type { PaymentDetails } from '../types';

// Polygon networks require higher gas fees (min 25 gwei priority fee)
const POLYGON_CHAIN_IDS = [137, 80002]; // Polygon Mainnet, Polygon Amoy
const POLYGON_GAS_CONFIG = {
  maxPriorityFeePerGas: parseGwei('30'), // 30 gwei (above 25 gwei minimum)
  maxFeePerGas: parseGwei('100'), // 100 gwei max
  gas: BigInt(300000), // Explicit gas limit to avoid estimation failures
};

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
  const recipientAddress = paymentDetails?.recipientAddress as `0x${string}` | undefined;
  const merchantId = paymentDetails?.merchantId as `0x${string}` | undefined;
  const feeBps = paymentDetails?.feeBps ?? 0;
  const serverSignature = paymentDetails?.serverSignature as `0x${string}` | undefined;

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
  const { isLoading: isConfirming, error: receiptError } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Pay function
  const pay = useCallback(() => {
    if (
      !gatewayAddress ||
      !tokenAddress ||
      !paymentId ||
      !amount ||
      !recipientAddress ||
      !merchantId ||
      !serverSignature
    ) {
      console.error('Missing payment details:', {
        gatewayAddress,
        tokenAddress,
        paymentId,
        amount,
        recipientAddress,
        merchantId,
        serverSignature,
      });
      return;
    }

    // Polygon networks require higher gas fees
    const gasConfig =
      paymentDetails?.chainId && POLYGON_CHAIN_IDS.includes(paymentDetails.chainId)
        ? POLYGON_GAS_CONFIG
        : {};

    writeContract({
      address: gatewayAddress,
      abi: PAYMENT_GATEWAY_ABI,
      functionName: 'pay',
      args: [
        paymentId,
        tokenAddress,
        amount,
        recipientAddress,
        merchantId,
        feeBps,
        serverSignature,
      ],
      chainId: paymentDetails?.chainId,
      ...gasConfig,
    });
  }, [
    gatewayAddress,
    tokenAddress,
    paymentId,
    amount,
    recipientAddress,
    merchantId,
    feeBps,
    serverSignature,
    paymentDetails?.chainId,
    writeContract,
  ]);

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
