import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount, useConnect, useDisconnect } from 'wagmi';

// ============================================================================
// Types
// ============================================================================

export interface WalletState {
  /** Connected wallet address */
  address: `0x${string}` | undefined;
  /** Whether a wallet is connected */
  isConnected: boolean;
  /** Current chain info */
  chain: { id: number; name: string } | undefined;
  /** Connection in progress */
  isPending: boolean;
  /** Is mobile device or tablet */
  isMobile: boolean;
  /** Inside Trust Wallet browser (mobile) or extension available (desktop) */
  isTrustWalletBrowser: boolean;
  /** Inside MetaMask browser (mobile) or extension available (desktop) */
  isMetaMaskBrowser: boolean;
  /** ID of the connector currently trying to connect */
  pendingConnectorId?: string;
}

export interface WalletActions {
  /** Connect via MetaMask (works on desktop extension & mobile via SDK) */
  connectMetaMask: () => void;
  /** Connect via Trust Wallet (desktop: extension, mobile: deeplink) */
  connectTrustWallet: () => void;
  /** Connect using injected provider (when inside wallet browser) */
  connectInjected: () => void;
  /** Disconnect current wallet */
  disconnect: () => void;
}

export interface UseWalletReturn extends WalletState, WalletActions {}

// ============================================================================
// Provider Types
// ============================================================================

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  isMetaMask?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  isRainbow?: boolean;
  isCoinbaseWallet?: boolean;
  providers?: EthereumProvider[];
}

// Type-safe window access
function getWindowEthereum(): EthereumProvider | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as { ethereum?: EthereumProvider }).ethereum;
}

function getWindowTrustWallet(): EthereumProvider | undefined {
  if (typeof window === 'undefined') return undefined;
  return (window as { trustwallet?: EthereumProvider }).trustwallet;
}

// ============================================================================
// Detection Helpers (matching msqpay.js logic)
// ============================================================================

/**
 * Detect if device is mobile or tablet (touchscreen without extension support)
 * - Checks user agent for mobile/tablet patterns
 * - Handles iPadOS 13+ which uses desktop-like user agent
 * - Uses touch capability as fallback for tablets
 */
function detectMobile(): boolean {
  if (typeof window === 'undefined') return false;

  const ua = navigator.userAgent;

  // Standard mobile/tablet detection
  if (/Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(ua)) {
    return true;
  }

  // iPadOS 13+ detection: Safari on iPad reports as Mac, but has touch support
  // Check for Mac + touch capability (real Macs don't have touch)
  const isMacUA = /Macintosh/i.test(ua);
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  if (isMacUA && hasTouch) {
    return true;
  }

  // Android tablets in desktop mode: check for Android + touch
  // Some Android tablets may not have "Android" in UA when in desktop mode,
  // but they'll have touch support and smaller screen
  if (hasTouch && window.innerWidth <= 1024) {
    return true;
  }

  return false;
}

/**
 * Get Trust Wallet provider from window
 * Checks: window.trustwallet, providers array, window.ethereum
 */
function getTrustWalletProvider(): EthereumProvider | null {
  // Check dedicated trustwallet object first
  const trustwallet = getWindowTrustWallet();
  if (trustwallet) {
    return trustwallet;
  }

  const ethereum = getWindowEthereum();
  if (!ethereum) return null;

  // Check providers array (when multiple extensions installed)
  const providers = ethereum.providers || [];
  for (const p of providers) {
    if (p.isTrust || p.isTrustWallet) {
      return p;
    }
  }

  // Fallback: check window.ethereum directly (if no providers array)
  if (providers.length === 0) {
    if (ethereum.isTrust || ethereum.isTrustWallet) {
      return ethereum;
    }
  }

  return null;
}

/**
 * Get MetaMask provider from window
 * Excludes Trust Wallet and other wallets
 */
function getMetaMaskProvider(): EthereumProvider | null {
  const ethereum = getWindowEthereum();
  if (!ethereum) return null;

  // Check providers array first (when multiple extensions installed)
  const providers = ethereum.providers || [];
  for (const p of providers) {
    if (p.isMetaMask && !p.isTrust && !p.isTrustWallet && !p.isRainbow && !p.isCoinbaseWallet) {
      return p;
    }
  }

  // Fallback: check window.ethereum directly (if no providers array)
  if (providers.length === 0) {
    if (ethereum.isMetaMask && !ethereum.isTrust && !ethereum.isTrustWallet) {
      return ethereum;
    }
  }

  return null;
}

function detectTrustWallet(): boolean {
  return getTrustWalletProvider() !== null;
}

function detectMetaMask(): boolean {
  return getMetaMaskProvider() !== null;
}

// ============================================================================
// Deeplink Generators
// ============================================================================

/**
 * Generate Trust Wallet deeplink to open current page in Trust Wallet browser
 * @see https://developer.trustwallet.com/developer/develop-for-trust/deeplinking
 */
export function getTrustWalletDeeplink(url?: string): string {
  const targetUrl = url ?? (typeof window !== 'undefined' ? window.location.href : '');
  return `trust://open_url?coin_id=60&url=${encodeURIComponent(targetUrl)}`;
}

// ============================================================================
// Hook
// ============================================================================

export function useWallet(): UseWalletReturn {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending, variables: connectVariables } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();

  const [isMobile, setIsMobile] = useState(false);
  const [isTrustWalletBrowser, setIsTrustWalletBrowser] = useState(false);
  const [isMetaMaskBrowser, setIsMetaMaskBrowser] = useState(false);

  // Detect environment on mount
  useEffect(() => {
    setIsMobile(detectMobile());
    setIsTrustWalletBrowser(detectTrustWallet());
    setIsMetaMaskBrowser(detectMetaMask());
  }, []);

  // Find MetaMask connector
  const metaMaskConnector = useMemo(
    () => connectors.find((c) => c.id === 'metaMaskSDK' || c.id === 'metaMask'),
    [connectors]
  );

  // Find injected connector (for use inside wallet browsers or extensions)
  const injectedConnector = useMemo(
    () => connectors.find((c) => c.id === 'injected'),
    [connectors]
  );

  // Connect via MetaMask (SDK handles mobile deeplinks automatically)
  const connectMetaMask = useCallback(() => {
    if (metaMaskConnector) {
      connect({ connector: metaMaskConnector });
    }
  }, [connect, metaMaskConnector]);

  // Connect via Trust Wallet (desktop: extension only, mobile: deeplink)
  const connectTrustWallet = useCallback(() => {
    if (typeof window === 'undefined') return;

    const isMobileDevice = detectMobile();
    const trustProvider = getTrustWalletProvider();

    // If Trust Wallet provider is detected, use wagmi's injected connector
    if (trustProvider && injectedConnector) {
      connect({ connector: injectedConnector });
      return;
    }

    // On mobile/tablet without Trust Wallet browser, use deeplink to open Trust Wallet app
    if (isMobileDevice) {
      window.location.href = getTrustWalletDeeplink();
      return;
    }

    // Desktop without Trust Wallet extension - open download page
    window.open('https://trustwallet.com/browser-extension', '_blank');
  }, [connect, injectedConnector]);

  // Connect using injected provider
  const connectInjected = useCallback(() => {
    if (injectedConnector) {
      connect({ connector: injectedConnector });
    }
  }, [connect, injectedConnector]);

  // Disconnect
  const disconnect = useCallback(() => {
    wagmiDisconnect();
  }, [wagmiDisconnect]);

  return {
    // State
    address,
    isConnected,
    chain: chain ? { id: chain.id, name: chain.name } : undefined,
    isPending,
    isMobile,
    isTrustWalletBrowser,
    isMetaMaskBrowser,
    pendingConnectorId: (connectVariables?.connector as { id?: string })?.id,
    // Actions
    connectMetaMask,
    connectTrustWallet,
    connectInjected,
    disconnect,
  };
}
