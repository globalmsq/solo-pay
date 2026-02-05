import { useEffect } from 'react';

type StepStatus = 'waiting' | 'processing' | 'completed';

interface StepProps {
  label: string;
  status: StepStatus;
}

interface PaymentProcessingProps {
  amount: string;
  token: string;
  onComplete?: () => void;
}

function StepIndicator({ status }: { status: StepStatus }) {
  if (status === 'completed') {
    return (
      <div className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shrink-0">
        <svg
          className="w-3.5 h-3.5 text-white"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </div>
    );
  }

  if (status === 'processing') {
    return (
      <div className="w-6 h-6 rounded-full border-2 border-blue-100 border-t-blue-600 animate-spin shrink-0" />
    );
  }

  return <div className="w-6 h-6 rounded-full border-2 border-gray-300 shrink-0" />;
}

function StepItem({ label, status }: StepProps) {
  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <StepIndicator status={status} />
      <span
        className={`text-xs sm:text-sm ${
          status === 'processing'
            ? 'text-blue-700 font-semibold'
            : status === 'completed'
              ? 'text-green-700 font-medium'
              : 'text-gray-400'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export default function PaymentProcessing({ amount, token, onComplete }: PaymentProcessingProps) {
  // Simulate payment processing - auto-complete after 3 seconds (will be updated)
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete?.();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="w-full p-4 sm:p-8">
      {/* Title */}
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-base sm:text-lg font-bold text-gray-900">Processing Payment</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">Please wait a moment</p>
      </div>

      {/* Spinner */}
      <div className="flex justify-center mb-4 sm:mb-6">
        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-4 border-blue-100 border-t-blue-600 animate-spin" />
      </div>

      {/* Amount */}
      <div className="text-center mb-6 sm:mb-8">
        <p className="text-xs text-gray-500 mb-1">Payment Amount</p>
        <p className="text-xl sm:text-2xl font-bold text-gray-900">
          {amount} {token}
        </p>
      </div>

      {/* Progress Steps */}
      <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 sm:p-5">
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 sm:mb-4">
          Payment Status
        </h2>
        <div className="space-y-3 sm:space-y-4">
          <StepItem label="Requesting Payment" status="completed" />
          <StepItem label="Signing Transaction" status="processing" />
          <StepItem label="Confirming Payment" status="waiting" />
        </div>
      </div>
    </div>
  );
}
