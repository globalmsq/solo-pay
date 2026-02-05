import { useState } from 'react';
import WalletConnect from './WalletConnect';
import TokenApproval from './TokenApproval';
import PaymentConfirm from './PaymentConfirm';
import PaymentProcessing from './PaymentProcessing';
import PaymentComplete from './PaymentComplete';
import type {
  PaymentStepType,
  PaymentInfo,
  WalletInfo,
  TransactionResult,
} from '../../types/index';

interface PaymentStepProps {
  initialPaymentInfo?: PaymentInfo;
}

// Default mock data (used when URL params not provided)
const DEFAULT_PAYMENT_INFO: PaymentInfo = {
  product: 'Premium Plan',
  amount: '100.00',
  token: 'USDT',
  network: 'Polygon',
};

export default function PaymentStep({ initialPaymentInfo }: PaymentStepProps) {
  const [currentStep, setCurrentStep] = useState<PaymentStepType>('wallet-connect');

  // Payment info from props or default (mock data for UI preview)
  const [paymentInfo] = useState<PaymentInfo>(initialPaymentInfo ?? DEFAULT_PAYMENT_INFO);

  // TODO: Replace with actual wallet data from RainbowKit/wagmi after connection
  // Mock wallet info for UI preview
  const [walletInfo] = useState<WalletInfo>({
    address: '0x1234...abcd',
    balance: '1,000.00',
  });

  // TODO: Replace with actual transaction result after payment completion
  // Mock transaction result for UI preview
  const [txResult] = useState<TransactionResult>({
    txHash: '0xabcdef1234567890abcdef1234567890abcdef12',
    date: new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
  });

  // Step navigation handlers
  const goToWalletConnect = () => setCurrentStep('wallet-connect');
  const goToTokenApproval = () => setCurrentStep('token-approval');
  const goToPaymentConfirm = () => setCurrentStep('payment-confirm');
  const goToPaymentProcessing = () => setCurrentStep('payment-processing');
  const goToPaymentComplete = () => setCurrentStep('payment-complete');

  const handleGetGas = () => {
    console.log('Get gas for approval');
    // TODO: API call to request gas
  };

  const handleConfirm = () => {
    // TODO: Replace with postMessage to parent window or redirect to successUrl
    // For UI preview: reset to wallet-connect step
    goToWalletConnect();
  };

  const renderStep = () => {
    switch (currentStep) {
      case 'wallet-connect':
        return <WalletConnect onConnect={goToTokenApproval} />;

      case 'token-approval':
        return (
          <TokenApproval
            walletAddress={walletInfo.address}
            balance={walletInfo.balance}
            token={paymentInfo.token}
            onGetGas={handleGetGas}
            onApprove={goToPaymentConfirm}
            onBack={goToWalletConnect}
          />
        );

      case 'payment-confirm':
        return (
          <PaymentConfirm
            product={paymentInfo.product}
            amount={paymentInfo.amount}
            token={paymentInfo.token}
            network={paymentInfo.network}
            onPay={goToPaymentProcessing}
            onBack={goToTokenApproval}
          />
        );

      case 'payment-processing':
        return (
          <PaymentProcessing
            amount={paymentInfo.amount}
            token={paymentInfo.token}
            onComplete={goToPaymentComplete}
          />
        );

      case 'payment-complete':
        return (
          <PaymentComplete
            amount={paymentInfo.amount}
            token={paymentInfo.token}
            date={txResult.date}
            txHash={txResult.txHash}
            onConfirm={handleConfirm}
          />
        );

      default:
        return null;
    }
  };

  return <div className="w-full">{renderStep()}</div>;
}
