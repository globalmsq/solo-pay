type StepStatus = 'waiting' | 'processing' | 'completed';

interface StepProps {
  label: string;
  status: StepStatus;
}

interface PaymentProcessingProps {
  amount: string;
  token: string;
  /** Retry payment after error */
  onRetry?: () => void;
  /** Cancel and redirect to failUrl */
  onCancel?: () => void;
  /** Whether payment transaction is pending */
  isPending?: boolean;
  /** Error message from payment */
  error?: string;
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

export default function PaymentProcessing({
  amount,
  token,
  onRetry,
  onCancel,
  isPending = true,
  error,
}: PaymentProcessingProps) {
  // Note: Auto-advance to payment-complete is handled in PaymentStep.tsx
  // based on actual transaction confirmation (txHash && !isConfirming)

  // Determine step statuses based on isPending state
  const getStepStatus = (step: 'requesting' | 'signing' | 'confirming'): StepStatus => {
    if (error) {
      // On error, show the signing step as where we stopped
      if (step === 'requesting') return 'completed';
      return 'waiting';
    }
    if (isPending) {
      if (step === 'requesting') return 'completed';
      if (step === 'signing') return 'processing';
      return 'waiting';
    }
    // All done
    return 'completed';
  };

  return (
    <div className="w-full p-4 sm:p-8">
      {/* Title */}
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-base sm:text-lg font-bold text-gray-900">Processing Payment</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">Please wait a moment</p>
      </div>

      {!error && (
        <>
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
              <StepItem label="Requesting Payment" status={getStepStatus('requesting')} />
              <StepItem label="Signing Transaction" status={getStepStatus('signing')} />
              <StepItem label="Confirming Payment" status={getStepStatus('confirming')} />
            </div>
          </div>
        </>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 sm:mb-6 p-4 rounded-xl bg-red-50 border border-red-200">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-red-500 shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-700">Transaction Failed</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons - shown on error */}
      {error && (
        <div className="mt-4 sm:mt-6 space-y-3">
          {onRetry && (
            <button
              type="button"
              className="w-full py-3 sm:py-3.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition-colors cursor-pointer"
              onClick={onRetry}
            >
              Try Again
            </button>
          )}
          {onCancel && (
            <button
              type="button"
              className="w-full py-3 sm:py-3.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors cursor-pointer"
              onClick={onCancel}
            >
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
