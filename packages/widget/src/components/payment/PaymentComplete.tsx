import { useState } from 'react';

interface PaymentCompleteProps {
  amount: string;
  token: string;
  date: string;
  txHash: string;
  onConfirm?: () => void;
}

export default function PaymentComplete({
  amount,
  token,
  date,
  txHash,
  onConfirm,
}: PaymentCompleteProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyTxHash = async () => {
    await navigator.clipboard.writeText(txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full p-4 sm:p-8">
      {/* Success Icon */}
      <div className="flex justify-center mb-4 sm:mb-6">
        <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-green-50 flex items-center justify-center">
          <svg
            className="w-6 h-6 sm:w-8 sm:h-8 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-base sm:text-lg font-bold text-gray-900">Payment Complete</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Your payment has been successfully processed
        </p>
      </div>

      {/* Payment Details */}
      <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 sm:p-5 mb-6 sm:mb-8">
        <div className="space-y-3 sm:space-y-4">
          {/* Date */}
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-gray-500">Date</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900">{date}</span>
          </div>

          {/* Amount */}
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-gray-500">Amount</span>
            <span className="text-xs sm:text-sm font-bold text-gray-900">
              {amount} {token}
            </span>
          </div>

          {/* Transaction Hash */}
          <div className="border-t border-gray-200 pt-3 sm:pt-4">
            <span className="text-xs text-gray-500 block mb-2">Transaction Hash</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-gray-700 truncate">{txHash}</span>
              <button
                type="button"
                className="shrink-0 p-1 rounded hover:bg-gray-200 transition-colors cursor-pointer"
                aria-label="Copy transaction hash"
                onClick={handleCopyTxHash}
              >
                {copied ? (
                  <svg
                    className="w-4 h-4 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                ) : (
                  <svg
                    className="w-4 h-4 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirm Button */}
      <button
        type="button"
        className="w-full py-3 sm:py-3.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 active:bg-blue-700 transition-colors cursor-pointer"
        onClick={onConfirm}
      >
        Confirm
      </button>
    </div>
  );
}
