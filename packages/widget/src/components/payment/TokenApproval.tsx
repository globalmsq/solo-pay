interface TokenApprovalProps {
  walletAddress: string;
  balance: string;
  token: string;
  onApprove?: () => void;
  onGetGas?: () => void;
  onDisconnect?: () => void;
  /** Cancel handler - redirects to failUrl */
  onCancel?: () => void;
  /** Whether approval transaction is pending */
  isApproving?: boolean;
  /** Whether user needs to approve (false if already approved) */
  needsApproval?: boolean;
  /** Error message from approval */
  error?: string;
  /** Whether gas faucet request is in progress */
  isRequestingGas?: boolean;
  /** Error message from gas request */
  gasRequestError?: string | null;
  /** Gas was successfully received from faucet */
  gasReceived?: boolean;
}

export default function TokenApproval({
  walletAddress,
  balance,
  token,
  onApprove,
  onGetGas,
  onDisconnect,
  onCancel,
  isApproving = false,
  needsApproval = true,
  error,
  isRequestingGas = false,
  gasRequestError = null,
  gasReceived = false,
}: TokenApprovalProps) {
  return (
    <div className="w-full p-4 sm:p-8">
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
          {onDisconnect && (
            <button
              type="button"
              onClick={onDisconnect}
              className="inline-flex items-center gap-1 p-1.5 sm:px-2.5 sm:py-1 rounded-full bg-gray-100 text-gray-600 text-xs font-medium hover:bg-gray-200 transition-colors cursor-pointer"
            >
              <svg
                className="w-3.5 h-3.5 sm:w-3 sm:h-3"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
                />
              </svg>
              <span className="hidden sm:inline">Disconnect</span>
            </button>
          )}
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
      <div
        className={`rounded-xl border p-4 sm:p-5 mb-4 sm:mb-6 ${
          gasReceived ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-100'
        }`}
      >
        {gasReceived ? (
          <div className="flex items-center gap-3">
            <div className="shrink-0 w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <svg
                className="w-4 h-4 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-green-800">Gas received</p>
              <p className="text-xs text-green-700 mt-0.5">
                Native token has been sent to your wallet. You can now approve the token below.
              </p>
            </div>
          </div>
        ) : (
          <>
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
                We provide free gas for token approval once per account. If you do not have enough
                gas, click the button below to receive it.
              </p>
            </div>
            <button
              type="button"
              className="w-full py-2 sm:py-2.5 rounded-lg bg-white border border-blue-200 text-xs sm:text-sm font-semibold text-blue-600 hover:bg-blue-100 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={onGetGas}
              disabled={isRequestingGas}
            >
              {isRequestingGas ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  Requesting gas...
                </span>
              ) : (
                'GET GAS'
              )}
            </button>
            {gasRequestError && <p className="mt-2 text-xs text-red-600">{gasRequestError}</p>}
          </>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Approve Button */}
      <button
        type="button"
        className={`w-full py-3 sm:py-3.5 rounded-xl text-white text-sm font-semibold transition-colors ${
          isApproving || error
            ? 'bg-blue-400 cursor-not-allowed'
            : needsApproval
              ? 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 cursor-pointer'
              : 'bg-green-600 hover:bg-green-500 cursor-pointer'
        }`}
        onClick={onApprove}
        disabled={isApproving || !!error}
      >
        {isApproving ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            Approving...
          </span>
        ) : needsApproval ? (
          'Approve Token'
        ) : (
          'Continue to Payment'
        )}
      </button>

      {/* Cancel Button - shown when there's an error */}
      {error && onCancel && (
        <button
          type="button"
          className="w-full mt-3 py-3 sm:py-3.5 rounded-xl bg-gray-100 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-colors cursor-pointer"
          onClick={onCancel}
        >
          Cancel Payment
        </button>
      )}
    </div>
  );
}
