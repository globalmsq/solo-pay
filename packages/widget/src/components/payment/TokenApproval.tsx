interface TokenApprovalProps {
  walletAddress: string;
  balance: string;
  token: string;
  onApprove?: () => void;
  onGetGas?: () => void;
  onBack?: () => void;
}

export default function TokenApproval({
  walletAddress,
  balance,
  token,
  onApprove,
  onGetGas,
  onBack,
}: TokenApprovalProps) {
  return (
    <div className="w-full p-4 sm:p-8">
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-xs sm:text-sm text-gray-500 hover:text-gray-700 mb-4 sm:mb-6 cursor-pointer"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back
        </button>
      )}

      {/* Title */}
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-base sm:text-lg font-bold text-gray-900">Token Approval</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">
          Please approve token spending permission to proceed
        </p>
      </div>

      {/* Wallet Info */}
      <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 sm:p-5 mb-4 sm:mb-6">
        <div className="flex items-center justify-between mb-3 sm:mb-4">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Connected Wallet
          </span>
          <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            Connected
          </span>
        </div>

        {/* Address */}
        <div className="mb-3 sm:mb-4">
          <p className="text-xs sm:text-sm font-mono text-gray-900 truncate">{walletAddress}</p>
        </div>

        {/* Balance */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-200">
          <span className="text-xs sm:text-sm text-gray-500">Balance</span>
          <span className="text-xs sm:text-sm font-semibold text-gray-900">
            {balance} {token}
          </span>
        </div>
      </div>

      {/* GET GAS Section */}
      <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 sm:p-5 mb-4 sm:mb-6">
        <div className="flex items-start gap-2 sm:gap-3 mb-3 sm:mb-4">
          <div className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center">
            <svg
              className="w-3 h-3 text-blue-600"
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
          </div>
          <p className="text-xs text-blue-700 leading-relaxed">
            We provide free gas for token approval once per account. If you do not have enough gas,
            click the button below to receive it.
          </p>
        </div>
        <button
          type="button"
          className="w-full py-2 sm:py-2.5 rounded-lg bg-white border border-blue-200 text-xs sm:text-sm font-semibold text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer"
          onClick={onGetGas}
        >
          GET GAS
        </button>
      </div>

      {/* Approve Button */}
      <button
        type="button"
        className="w-full py-3 sm:py-3.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 active:bg-blue-700 transition-colors cursor-pointer"
        onClick={onApprove}
      >
        Approve Token
      </button>
    </div>
  );
}
