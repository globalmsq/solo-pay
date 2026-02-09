import { useCallback } from 'react';
import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { ERC20_ABI } from '../lib/contracts';
import { formatUnits, parseGwei } from 'viem';

// Polygon networks require higher gas fees (min 25 gwei priority fee)
const POLYGON_CHAIN_IDS = [137, 80002]; // Polygon Mainnet, Polygon Amoy
const POLYGON_GAS_CONFIG = {
  maxPriorityFeePerGas: parseGwei('30'), // 30 gwei (above 25 gwei minimum)
  maxFeePerGas: parseGwei('100'), // 100 gwei max
  gas: BigInt(100000), // Explicit gas limit for approve (typically ~50k)
};

// ============================================================================
// Types
// ============================================================================

export interface UseTokenParams {
  /** ERC20 token contract address */
  tokenAddress: `0x${string}` | undefined;
  /** Spender address (gateway contract) for allowance check */
  spenderAddress: `0x${string}` | undefined;
  /** User's wallet address */
  userAddress: `0x${string}` | undefined;
  /** Token decimals for formatting */
  decimals?: number;
  /** Chain ID for the transaction */
  chainId?: number;
}

export interface UseTokenReturn {
  /** Raw token balance (bigint) */
  balance: bigint | undefined;
  /** Formatted balance (human readable string) */
  formattedBalance: string;
  /** Raw allowance for spender (bigint) */
  allowance: bigint | undefined;
  /** Whether allowance is sufficient for amount */
  hasAllowance: (amount: bigint) => boolean;
  /** Approve tokens for spender */
  approve: (amount: bigint) => void;
  /** Whether approval is pending */
  isApproving: boolean;
  /** Whether approval transaction is confirming */
  isApprovalConfirming: boolean;
  /** Approval transaction hash */
  approvalTxHash: `0x${string}` | undefined;
  /** Approval error */
  approvalError: Error | null;
  /** Whether balance/allowance is loading */
  isLoading: boolean;
  /** Refetch balance and allowance */
  refetch: () => void;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook for ERC20 token operations
 *
 * Provides balance checking, allowance checking, and token approval functionality.
 *
 * @example
 * ```tsx
 * const {
 *   balance,
 *   formattedBalance,
 *   hasAllowance,
 *   approve,
 *   isApproving,
 * } = useToken({
 *   tokenAddress: '0x...',
 *   spenderAddress: '0x...',
 *   userAddress: '0x...',
 *   decimals: 6,
 * });
 *
 * // Check if user has enough allowance
 * if (!hasAllowance(amount)) {
 *   approve(amount);
 * }
 * ```
 */
export function useToken({
  tokenAddress,
  spenderAddress,
  userAddress,
  decimals = 18,
  chainId,
}: UseTokenParams): UseTokenReturn {
  // Read balance
  const {
    data: balance,
    isLoading: isBalanceLoading,
    refetch: refetchBalance,
  } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: userAddress ? [userAddress] : undefined,
    query: {
      enabled: !!tokenAddress && !!userAddress,
    },
  });

  // Read allowance
  const {
    data: allowance,
    isLoading: isAllowanceLoading,
    refetch: refetchAllowance,
  } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: userAddress && spenderAddress ? [userAddress, spenderAddress] : undefined,
    query: {
      enabled: !!tokenAddress && !!userAddress && !!spenderAddress,
    },
  });

  // Write approve
  const {
    writeContract,
    data: approvalTxHash,
    isPending: isApproving,
    error: approvalWriteError,
  } = useWriteContract();

  // Wait for approval confirmation
  const {
    isLoading: isApprovalConfirming,
    error: approvalReceiptError,
  } = useWaitForTransactionReceipt({
    hash: approvalTxHash,
  });

  // Approve function
  const approve = useCallback(
    (amount: bigint) => {
      if (!tokenAddress || !spenderAddress) return;

      // Polygon networks require higher gas fees
      const gasConfig = chainId && POLYGON_CHAIN_IDS.includes(chainId)
        ? POLYGON_GAS_CONFIG
        : {};

      writeContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spenderAddress, amount],
        chainId,
        ...gasConfig,
      });
    },
    [tokenAddress, spenderAddress, chainId, writeContract]
  );

  // Check if allowance is sufficient
  const hasAllowance = useCallback(
    (amount: bigint): boolean => {
      if (allowance === undefined) return false;
      return allowance >= amount;
    },
    [allowance]
  );

  // Format balance for display
  const formattedBalance = balance !== undefined
    ? formatUnits(balance, decimals)
    : '0';

  // Refetch both balance and allowance
  const refetch = useCallback(() => {
    refetchBalance();
    refetchAllowance();
  }, [refetchBalance, refetchAllowance]);

  return {
    balance,
    formattedBalance,
    allowance,
    hasAllowance,
    approve,
    isApproving,
    isApprovalConfirming,
    approvalTxHash,
    approvalError: approvalWriteError || approvalReceiptError || null,
    isLoading: isBalanceLoading || isAllowanceLoading,
    refetch,
  };
}
