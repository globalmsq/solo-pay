import { ConnectButton } from '../ConnectButton';

interface WalletConnectProps {
  onConnect: () => void;
}

export default function WalletConnect({ onConnect }: WalletConnectProps) {
  return (
    <div className="w-full p-4 sm:p-8">
      {/* Wallet Icon */}
      <div className="flex justify-center mb-6 sm:mb-8">
        <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-50 flex items-center justify-center">
          <svg
            className="w-8 h-8 sm:w-10 sm:h-10 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 12a2.25 2.25 0 0 0-2.25-2.25H15a3 3 0 1 1-6 0H5.25A2.25 2.25 0 0 0 3 12m18 0v6a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 9m18 0V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v3"
            />
          </svg>
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-2">
        <h1 className="text-base sm:text-lg font-bold text-gray-900">Connect Wallet</h1>
      </div>

      {/* Description */}
      <div className="text-center mb-6 sm:mb-8">
        <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
          Please connect your wallet to proceed.
          <br />
          Supports MetaMask and Trust Wallet.
        </p>
      </div>

      {/* Connect Wallet Button */}
      <ConnectButton />
    </div>
  );
}
