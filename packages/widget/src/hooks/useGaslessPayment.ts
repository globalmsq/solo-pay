import { useCallback, useState } from 'react';
import { useReadContract, useWalletClient } from 'wagmi';
import { encodeFunctionData } from 'viem';
import { PAYMENT_GATEWAY_ABI, FORWARDER_ABI } from '../lib/contracts';
import {
  submitGaslessPayment,
  waitForRelayTransaction,
  type ForwardRequest,
} from '../lib/api';
import type { PaymentDetails } from '../types';

// ============================================================================
// Types
// ============================================================================

export interface UseGaslessPaymentParams {
  /** Payment details from API */
  paymentDetails: PaymentDetails | null;
  /** Merchant public key for API authentication */
  publicKey?: string;
}

export interface UseGaslessPaymentReturn {
  /** Execute gasless payment */
  payGasless: () => Promise<void>;
  /** Whether gasless payment is in progress */
  isPayingGasless: boolean;
  /** Whether waiting for relay confirmation */
  isRelayConfirming: boolean;
  /** Relay transaction hash (when confirmed) */
  relayTxHash: string | undefined;
  /** Gasless payment error */
  error: Error | null;
  /** Whether gasless is supported (forwarder configured) */
  isGaslessSupported: boolean;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for executing gasless (meta-transaction) payments
 *
 * Uses ERC2771 forwarder for meta-transactions where the relayer pays gas fees.
 *
 * @example
 * ```tsx
 * const { payGasless, isPayingGasless, isRelayConfirming, error } = useGaslessPayment({
 *   paymentDetails,
 * });
 *
 * // Execute gasless payment
 * const handleGaslessPayment = async () => {
 *   await payGasless();
 * };
 * ```
 */
export function useGaslessPayment({
  paymentDetails,
  publicKey,
}: UseGaslessPaymentParams): UseGaslessPaymentReturn {
  const [isPayingGasless, setIsPayingGasless] = useState(false);
  const [isRelayConfirming, setIsRelayConfirming] = useState(false);
  const [relayTxHash, setRelayTxHash] = useState<string>();
  const [error, setError] = useState<Error | null>(null);

  const { data: walletClient } = useWalletClient();

  const forwarderAddress = paymentDetails?.forwarderAddress as `0x${string}` | undefined;
  const gatewayAddress = paymentDetails?.gatewayAddress as `0x${string}` | undefined;
  const tokenAddress = paymentDetails?.tokenAddress as `0x${string}` | undefined;
  const paymentId = paymentDetails?.paymentId as `0x${string}` | undefined;
  const amount = paymentDetails?.amount ? BigInt(paymentDetails.amount) : undefined;
  const recipientAddress = paymentDetails?.recipientAddress as `0x${string}` | undefined;
  const merchantId = paymentDetails?.merchantId as `0x${string}` | undefined;
  const feeBps = paymentDetails?.feeBps ?? 0;
  const serverSignature = paymentDetails?.serverSignature as `0x${string}` | undefined;

  // Check if gasless is supported
  const isGaslessSupported = !!forwarderAddress;

  // Get nonce from forwarder contract
  const { data: nonce, refetch: refetchNonce } = useReadContract({
    address: forwarderAddress,
    abi: FORWARDER_ABI,
    functionName: 'nonces',
    args: walletClient?.account?.address ? [walletClient.account.address] : undefined,
    query: {
      enabled: !!forwarderAddress && !!walletClient?.account?.address,
    },
  });

  const payGasless = useCallback(async () => {
    if (
      !walletClient ||
      !walletClient.account ||
      !forwarderAddress ||
      !gatewayAddress ||
      !tokenAddress ||
      !paymentId ||
      !amount ||
      !recipientAddress ||
      !merchantId ||
      !serverSignature
    ) {
      console.error('Missing gasless payment details');
      return;
    }

    try {
      setIsPayingGasless(true);
      setError(null);
      setRelayTxHash(undefined);

      // Refetch nonce to ensure fresh value
      const { data: freshNonce } = await refetchNonce();
      if (freshNonce === undefined) {
        throw new Error('Failed to fetch nonce from Forwarder contract');
      }

      // 1. Encode the PaymentGateway.pay() function call
      const payCallData = encodeFunctionData({
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
          {
            deadline: 0n,
            v: 0,
            r: '0x0000000000000000000000000000000000000000000000000000000000000000',
            s: '0x0000000000000000000000000000000000000000000000000000000000000000',
          },
        ],
      });

      // 2. Create EIP-712 typed data for gasless payment forward request
      const domain = {
        name: 'SoloForwarder',
        version: '1',
        chainId: BigInt(paymentDetails?.chainId ?? 0),
        verifyingContract: forwarderAddress,
      };

      const types = {
        ForwardRequest: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'gas', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint48' },
          { name: 'data', type: 'bytes' },
        ],
      };

      // Deadline: 10 minutes from now
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

      const forwardMessage = {
        from: walletClient.account.address,
        to: gatewayAddress,
        value: BigInt(0),
        gas: BigInt(300000),
        nonce: freshNonce,
        deadline,
        data: payCallData,
      };

      // 3. Request EIP-712 signature from user
      const signature = await walletClient.signTypedData({
        domain,
        types,
        primaryType: 'ForwardRequest',
        message: forwardMessage,
      });

      // 4. Create ForwardRequest for relay
      const forwardRequest: ForwardRequest = {
        from: walletClient.account.address,
        to: gatewayAddress,
        value: '0',
        gas: '300000',
        nonce: freshNonce.toString(),
        deadline: deadline.toString(),
        data: payCallData,
        signature,
      };

      // 5. Submit to relay service
      setIsPayingGasless(false);
      setIsRelayConfirming(true);

      const origin = typeof window !== 'undefined' ? window.location.origin : undefined;
      const submitResponse = await submitGaslessPayment(
        paymentId,
        forwarderAddress,
        forwardRequest,
        publicKey ?? '',
        { origin }
      );

      // 6. Poll relay status until CONFIRMED/FAILED
      const relayOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
      const relayResult = await waitForRelayTransaction(paymentId, {
        timeout: 120000,
        interval: 3000,
        publicKey: publicKey ?? undefined,
        origin: relayOrigin,
      });

      setRelayTxHash(relayResult.transactionHash ?? '');
      setIsRelayConfirming(false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Gasless payment failed'));
      setIsPayingGasless(false);
      setIsRelayConfirming(false);
    }
  }, [
    walletClient,
    forwarderAddress,
    gatewayAddress,
    tokenAddress,
    paymentId,
    amount,
    recipientAddress,
    merchantId,
    feeBps,
    serverSignature,
    paymentDetails?.chainId,
    publicKey,
    refetchNonce,
  ]);

  return {
    payGasless,
    isPayingGasless,
    isRelayConfirming,
    relayTxHash,
    error,
    isGaslessSupported,
  };
}
