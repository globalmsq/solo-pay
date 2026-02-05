/**
 * Example ConnectButton component using useWallet hook
 * This is a reference implementation - UI team can build their own
 */
import { useWallet } from '../hooks/useWallet';

export function ConnectButton({ className }: { className?: string }) {
  const {
    address,
    chain,
    isConnected,
    isPending,
    isMobile,
    isTrustWalletBrowser,
    isMetaMaskBrowser,
    connectMetaMask,
    connectTrustWallet,
    connectInjected,
    disconnect,
  } = useWallet();

  // Connected state
  if (isConnected && address) {
    return (
      <div className={className}>
        <div className="space-y-3">
          {chain && (
            <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 text-center">
              {chain.name}
            </div>
          )}
          <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 text-center">
            {address.slice(0, 6)}...{address.slice(-4)}
          </div>
          <button
            onClick={disconnect}
            type="button"
            className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
    );
  }

  // Inside Trust Wallet browser (mobile/tablet) - show single connect button
  if (isMobile && isTrustWalletBrowser) {
    return (
      <div className={className}>
        <button
          onClick={connectTrustWallet}
          disabled={isPending}
          type="button"
          className="w-full rounded-xl bg-[#3375BB] px-6 py-4 text-lg font-semibold text-white shadow-sm hover:bg-[#2a5f99] active:bg-[#1e4a7a] disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Connecting...' : 'Connect Wallet'}
        </button>
      </div>
    );
  }

  // Inside MetaMask browser (mobile) - show single connect button
  if (isMobile && isMetaMaskBrowser) {
    return (
      <div className={className}>
        <button
          onClick={connectInjected}
          disabled={isPending}
          type="button"
          className="w-full rounded-xl bg-[#F6851B] px-6 py-4 text-lg font-semibold text-white shadow-sm hover:bg-[#e2761b] active:bg-[#cd6116] disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Connecting...' : 'Connect Wallet'}
        </button>
      </div>
    );
  }

  // Mobile without wallet browser - show deeplink options
  if (isMobile) {
    return (
      <div className={[className, 'flex flex-col gap-2'].join(' ')}>
        <button
          onClick={connectMetaMask}
          disabled={isPending}
          type="button"
          className="w-full rounded-xl bg-[#F6851B] px-6 py-4 text-lg font-semibold text-white shadow-sm hover:bg-[#e2761b] active:bg-[#cd6116] disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Connecting...' : 'MetaMask'}
        </button>
        <button
          onClick={connectTrustWallet}
          disabled={isPending}
          type="button"
          className="w-full rounded-xl bg-[#3375BB] px-6 py-4 text-lg font-semibold text-white shadow-sm hover:bg-[#2a5f99] active:bg-[#1e4a7a] disabled:opacity-50 transition-colors"
        >
          {isPending ? 'Connecting...' : 'Trust Wallet'}
        </button>
      </div>
    );
  }

  // Desktop: show wallet options (both MetaMask and Trust Wallet)
  return (
    <div className={[className, 'flex flex-col gap-2'].join(' ')}>
      {/* MetaMask */}
      <button
        onClick={connectMetaMask}
        disabled={isPending}
        type="button"
        className="w-full rounded-xl bg-[#F6851B] px-6 py-4 text-lg font-semibold text-white shadow-sm hover:bg-[#e2761b] active:bg-[#cd6116] disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Connecting...' : 'MetaMask'}
      </button>

      {/* Trust Wallet - works on both desktop (extension) and mobile (deeplink) */}
      <button
        onClick={connectTrustWallet}
        disabled={isPending}
        type="button"
        className="w-full rounded-xl bg-[#3375BB] px-6 py-4 text-lg font-semibold text-white shadow-sm hover:bg-[#2a5f99] active:bg-[#1e4a7a] disabled:opacity-50 transition-colors"
      >
        {isPending ? 'Connecting...' : 'Trust Wallet'}
      </button>
    </div>
  );
}
