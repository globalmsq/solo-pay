import { useState, useEffect, useRef, useCallback } from 'react';
import TokenApproval from './TokenApproval';
import PaymentConfirm from './PaymentConfirm';
import PaymentProcessing from './PaymentProcessing';
import PaymentComplete from './PaymentComplete';
import { usePaymentApi } from '../../hooks/usePaymentApi';
import { useWallet } from '../../hooks/useWallet';
import { useToken } from '../../hooks/useToken';
import { usePayment } from '../../hooks/usePayment';
import { ConnectButton } from '../ConnectButton';
import type {
  PaymentStepType,
  WidgetUrlParams,
} from '../../types/index';

interface PaymentStepProps {
  /** Validated URL parameters from widget initialization */
  urlParams?: WidgetUrlParams;
}

/**
 * Get human-readable network name from chain ID
 */
function getNetworkName(chainId: number): string {
  const networks: Record<number, string> = {
    1: 'Ethereum',
    11155111: 'Sepolia',
    137: 'Polygon',
    80002: 'Polygon Amoy',
    56: 'BSC',
    97: 'BSC Testnet',
    42161: 'Arbitrum',
    10: 'Optimism',
    8453: 'Base',
  };
  return networks[chainId] ?? `Chain ${chainId}`;
}

/**
 * Format number with commas for display
 */
function formatBalance(value: string, maxDecimals = 2): string {
  const num = parseFloat(value);
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  });
}

function formatAddress(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function PaymentStep({ urlParams }: PaymentStepProps) {
  const [currentStep, setCurrentStep] = useState<PaymentStepType>('wallet-connect');
  const [completionDate, setCompletionDate] = useState<string>('');

  // Wallet connection state from wagmi
  const { address, isConnected, disconnect, error: walletError } = useWallet();

  // API hook for payment operations
  const {
    payment: paymentDetails,
    isLoading,
    error: apiError,
    createPayment,
  } = usePaymentApi();

  // Token operations (balance, allowance, approve)
  const {
    formattedBalance,
    hasAllowance,
    approve,
    isApproving,
    isApprovalConfirming,
    approvalTxHash,
    approvalError,
    refetch: refetchToken,
  } = useToken({
    tokenAddress: paymentDetails?.tokenAddress as `0x${string}` | undefined,
    spenderAddress: paymentDetails?.gatewayAddress as `0x${string}` | undefined,
    userAddress: address,
    decimals: paymentDetails?.tokenDecimals,
  });

  // Payment transaction
  const {
    pay,
    isPaying,
    isConfirming: isPaymentConfirming,
    txHash,
    error: paymentError,
  } = usePayment({ paymentDetails });

  // Prevent double API call in React Strict Mode
  const isInitialized = useRef(false);

  // Create payment on mount when urlParams is available
  useEffect(() => {
    if (urlParams && !isInitialized.current) {
      isInitialized.current = true;
      createPayment(urlParams);
    }
  }, [urlParams, createPayment]);

  // Human-readable amount (for display)
  const displayAmount = urlParams?.amount ?? (
    paymentDetails
      ? (parseInt(paymentDetails.amount) / Math.pow(10, paymentDetails.tokenDecimals)).toString()
      : '0'
  );

  // Payment amount in wei (bigint)
  const paymentAmountWei = paymentDetails ? BigInt(paymentDetails.amount) : BigInt(0);

  // Check if user has sufficient allowance
  const needsApproval = !hasAllowance(paymentAmountWei);

  // Step navigation handlers
  const goToWalletConnect = () => setCurrentStep('wallet-connect');
  const goToTokenApproval = () => setCurrentStep('token-approval');
  const goToPaymentConfirm = () => setCurrentStep('payment-confirm');
  const goToPaymentProcessing = () => setCurrentStep('payment-processing');
  const goToPaymentComplete = () => setCurrentStep('payment-complete');

  // Auto-advance to token-approval when wallet connects
  useEffect(() => {
    if (isConnected && address && paymentDetails) {
      setCurrentStep('token-approval');
    }
  }, [isConnected, address, paymentDetails]);

  // Auto-advance after approval confirmation
  useEffect(() => {
    // Only advance if we submitted an approval tx and it finished confirming
    if (approvalTxHash && !isApprovalConfirming && !approvalError) {
      refetchToken();
      goToPaymentConfirm();
    }
  }, [approvalTxHash, isApprovalConfirming, approvalError, refetchToken]);

  // Auto-advance when payment confirms
  useEffect(() => {
    if (txHash && !isPaymentConfirming && !paymentError) {
      // Set completion date on client only to avoid hydration mismatch
      setCompletionDate(new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }));
      goToPaymentComplete();
    }
  }, [txHash, isPaymentConfirming, paymentError]);

  // Show alert when wallet connection fails
  useEffect(() => {
    if (walletError) {
      alert('Failed to connect wallet. Please try again.');
    }
  }, [walletError]);

  // Disconnect handler
  const handleDisconnect = useCallback(() => {
    disconnect();
    goToWalletConnect();
  }, [disconnect]);

  // Approve handler
  const handleApprove = useCallback(() => {
    if (needsApproval) {
      // Approve max amount for better UX (user won't need to approve again)
      const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      approve(maxUint256);
    } else {
      // Already approved, go to confirm
      goToPaymentConfirm();
    }
  }, [needsApproval, approve]);

  // Pay handler
  const handlePay = useCallback(() => {
    goToPaymentProcessing();
    pay();
  }, [pay]);

  // Confirm/redirect handler
  const handleConfirm = useCallback(() => {
    if (paymentDetails?.successUrl) {
      window.location.href = paymentDetails.successUrl;
      return;
    }
    goToWalletConnect();
  }, [paymentDetails?.successUrl]);

  // Loading state
  if (isLoading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-sm text-gray-600">Loading payment...</p>
      </div>
    );
  }

  // API Error state
  if (apiError) {
    return (
      <div className="text-center py-8">
        <div className="text-red-500 mb-4">
          <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="font-medium">Payment Error</p>
        </div>
        <p className="text-sm text-gray-600 mb-4">{apiError}</p>
        {urlParams?.failUrl && (
          <button
            onClick={() => window.location.href = urlParams.failUrl}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200"
          >
            Go Back
          </button>
        )}
      </div>
    );
  }

  // No payment details yet
  if (!paymentDetails) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-gray-600">Initializing payment...</p>
      </div>
    );
  }

  const renderStep = () => {
    switch (currentStep) {
      case 'wallet-connect':
        return <ConnectButton />;

      case 'token-approval':
        return (
          <TokenApproval
            walletAddress={address ? formatAddress(address) : ''}
            balance={formatBalance(formattedBalance)}
            token={paymentDetails.tokenSymbol}
            onGetGas={() => { /* TODO: Implement gas sponsorship API */ }}
            onApprove={handleApprove}
            onDisconnect={handleDisconnect}
            isApproving={isApproving || isApprovalConfirming}
            needsApproval={needsApproval}
            error={approvalError?.message}
          />
        );

      case 'payment-confirm':
        return (
          <PaymentConfirm
            product={`Order #${paymentDetails.orderId}`}
            amount={displayAmount}
            token={paymentDetails.tokenSymbol}
            network={getNetworkName(paymentDetails.chainId)}
            onPay={handlePay}
            onBack={goToTokenApproval}
          />
        );

      case 'payment-processing':
        return (
          <PaymentProcessing
            amount={displayAmount}
            token={paymentDetails.tokenSymbol}
            onComplete={goToPaymentComplete}
            isPending={isPaying || isPaymentConfirming}
            error={paymentError?.message}
          />
        );

      case 'payment-complete':
        return (
          <PaymentComplete
            amount={displayAmount}
            token={paymentDetails.tokenSymbol}
            date={completionDate}
            txHash={txHash || ''}
            onConfirm={handleConfirm}
          />
        );

      default:
        return null;
    }
  };

  return <div className="w-full">{renderStep()}</div>;
}
