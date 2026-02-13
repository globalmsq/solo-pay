interface PaymentConfirmProps {
  product: string;
  amount: string;
  token: string;
  network: string;
  onPay?: () => void;
}

export default function PaymentConfirm({
  product,
  amount,
  token,
  network,
  onPay,
}: PaymentConfirmProps) {
  return (
    <div className="w-full px-4 pt-0 pb-4 sm:px-8 sm:pt-0 sm:pb-8">
      {/* Title */}
      <div className="text-center mb-8 sm:mb-10">
        <h1 className="text-base sm:text-lg font-bold text-gray-900">Confirm Payment</h1>
        <p className="text-xs sm:text-sm text-gray-500 mt-1">Please review your payment details</p>
      </div>

      {/* Payment Details */}
      <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 sm:p-5 mb-7 sm:mb-8">
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3 sm:mb-4">
          Payment Details
        </h2>

        <div className="space-y-2 sm:space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-gray-500">Product</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900">{product}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-gray-500">Amount</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900">
              {amount} {token}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm text-gray-500">Network</span>
            <span className="text-xs sm:text-sm font-medium text-gray-900">{network}</span>
          </div>

          <div className="border-t border-gray-200 pt-2 sm:pt-3 mt-2 sm:mt-3">
            <div className="flex items-center justify-between">
              <span className="text-xs sm:text-sm text-gray-500">Gas Fee</span>
              <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                Free (Covered by Solo Pay)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Total */}
      <div className="rounded-xl bg-blue-50 border border-blue-100 p-4 sm:p-5 mb-8 sm:mb-10">
        <div className="flex items-center justify-between">
          <span className="text-xs sm:text-sm font-medium text-blue-700">Total Amount</span>
          <span className="text-base sm:text-lg font-bold text-blue-700">
            {amount} {token}
          </span>
        </div>
      </div>

      {/* Pay Button */}
      <button
        type="button"
        className="w-full py-3 sm:py-3.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 active:bg-blue-700 transition-colors cursor-pointer"
        onClick={onPay}
      >
        Pay Now
      </button>
    </div>
  );
}
