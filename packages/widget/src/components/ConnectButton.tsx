import { useWallet } from '../hooks/useWallet';

// Wallet button styles
const WALLET_BUTTON_BASE =
  'w-full rounded-xl px-6 py-3 sm:py-4 text-sm sm:text-lg font-semibold text-white shadow-sm disabled:opacity-50 transition-colors';

const WALLET_STYLES = {
  metaMask: 'bg-[#F6851B] hover:bg-[#e2761b] active:bg-[#cd6116]',
  trustWallet: 'bg-[#3375BB] hover:bg-[#2a5f99] active:bg-[#1e4a7a]',
} as const;

export function ConnectButton({ className }: { className?: string }) {
  const {
    isPending,
    isMobile,
    isTrustWalletBrowser,
    isMetaMaskBrowser,
    connectMetaMask,
    connectTrustWallet,
    connectInjected,
    pendingConnectorId,
  } = useWallet();

  const isMetaMaskPending =
    isPending && (pendingConnectorId === 'metaMask' || pendingConnectorId === 'metaMaskSDK');
  const isTrustWalletPending =
    isPending &&
    (pendingConnectorId === 'injected' ||
      pendingConnectorId === 'trust' ||
      pendingConnectorId === 'trustWallet');

  const renderWalletButtons = () => {
    // Inside Trust Wallet browser (mobile/tablet) - show single connect button
    if (isMobile && isTrustWalletBrowser) {
      return (
        <button
          onClick={connectTrustWallet}
          disabled={isTrustWalletPending}
          type="button"
          className={`${WALLET_BUTTON_BASE} ${WALLET_STYLES.trustWallet}`}
        >
          {isTrustWalletPending ? 'Connecting...' : 'Connect Wallet'}
        </button>
      );
    }

    // Inside MetaMask browser (mobile) - show single connect button
    if (isMobile && isMetaMaskBrowser) {
      return (
        <button
          onClick={connectInjected}
          disabled={isMetaMaskPending}
          type="button"
          className={`${WALLET_BUTTON_BASE} ${WALLET_STYLES.metaMask}`}
        >
          {isMetaMaskPending ? 'Connecting...' : 'Connect Wallet'}
        </button>
      );
    }

    // Mobile without wallet browser OR Desktop - show both wallet options
    return (
      <div className="flex flex-col gap-2">
        {/* MetaMask */}
        <button
          onClick={connectMetaMask}
          disabled={isMetaMaskPending}
          type="button"
          className={`${WALLET_BUTTON_BASE} ${WALLET_STYLES.metaMask}`}
        >
          {isMetaMaskPending ? 'Connecting...' : 'MetaMask'}
        </button>

        {/* Trust Wallet */}
        <button
          onClick={connectTrustWallet}
          disabled={isTrustWalletPending}
          type="button"
          className={`${WALLET_BUTTON_BASE} ${WALLET_STYLES.trustWallet}`}
        >
          {isTrustWalletPending ? 'Connecting...' : 'Trust Wallet'}
        </button>
      </div>
    );
  };

  return (
    <div className={['w-full', className].filter(Boolean).join(' ')}>
      {/* Wallet Icon */}
      <div className="flex justify-center mb-8 sm:mb-10">
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
      <div className="text-center mb-5">
        <h1 className="text-base sm:text-lg font-bold text-gray-900">Connect Wallet</h1>
      </div>

      {/* Description */}
      <div className="text-center mb-10 sm:mb-12">
        <p className="text-xs sm:text-sm text-gray-500 leading-relaxed">
          Please connect your wallet to proceed.
          <br />
          Supports MetaMask and Trust Wallet.
        </p>
      </div>

      {/* Wallet Buttons */}
      {renderWalletButtons()}
    </div>
  );
}
