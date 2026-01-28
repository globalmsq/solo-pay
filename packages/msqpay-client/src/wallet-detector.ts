/**
 * Wallet Detection - Clean implementation
 */

import { WALLET_TYPES, WalletType } from './constants';
import type { EIP1193Provider } from './types';

export interface Wallet {
  type: WalletType;
  name: string;
  icon: string;
}

export class WalletDetector {
  detectedProviders: EIP6963ProviderDetail[];
  mmsdk: MetaMaskSDK.MetaMaskSDK | null;

  constructor() {
    this.detectedProviders = [];
    this.mmsdk = null;
    this.initEIP6963();
  }

  /**
   * Initialize EIP-6963 provider discovery
   */
  initEIP6963(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('eip6963:announceProvider', ((
      event: CustomEvent<EIP6963ProviderDetail>
    ) => {
      this.detectedProviders.push(event.detail);
    }) as EventListener);

    window.dispatchEvent(new Event('eip6963:requestProvider'));
  }

  /**
   * Check if MetaMask is available
   */
  isMetaMaskAvailable(): boolean {
    if (typeof window === 'undefined') return false;

    // Check extension
    if (window.ethereum?.isMetaMask) {
      return true;
    }

    // Check providers array
    if (Array.isArray(window.ethereum?.providers)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return window.ethereum.providers.some((p: any) => p.isMetaMask);
    }

    // Check EIP-6963
    return this.detectedProviders.some(
      (p) => p.info.name.toLowerCase().includes('metamask') || p.info.rdns === 'io.metamask'
    );
  }

  /**
   * Check if Trust Wallet is available
   */
  isTrustWalletAvailable(): boolean {
    if (typeof window === 'undefined') return false;

    // Check window.trustwallet (lowercase)
    if (window.trustwallet) return true;

    // Check window.trustWallet (capital W)
    if (window.trustWallet) return true;

    // Check window.ethereum
    if (window.ethereum?.isTrust || window.ethereum?.isTrustWallet) {
      return true;
    }

    // Check providers array
    if (Array.isArray(window.ethereum?.providers)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return window.ethereum.providers.some((p: any) => p.isTrust || p.isTrustWallet);
    }

    // Check EIP-6963
    return this.detectedProviders.some(
      (p) => p.info.name.toLowerCase().includes('trust') || p.info.rdns === 'com.trustwallet.app'
    );
  }

  /**
   * Get available wallets
   */
  getAvailableWallets(): Wallet[] {
    const wallets: Wallet[] = [];

    if (this.isMetaMaskAvailable()) {
      wallets.push({
        type: WALLET_TYPES.METAMASK,
        name: 'MetaMask',
        icon: 'https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg',
      });
    }

    if (this.isTrustWalletAvailable()) {
      wallets.push({
        type: WALLET_TYPES.TRUST,
        name: 'Trust Wallet',
        icon: 'https://uxwing.com/wp-content/themes/uxwing/download/brands-and-social-media/trust-wallet-icon.png',
      });
    }

    return wallets;
  }

  /**
   * Get provider for wallet type
   * @param walletType - The wallet type to get provider for
   * @returns EIP-1193 compatible provider or null if not available
   */
  getProviderForWallet(walletType: WalletType): EIP1193Provider | null {
    switch (walletType) {
      case WALLET_TYPES.METAMASK: {
        // MetaMask SDK will show browser/mobile dialog automatically when eth_requestAccounts is called
        // Prefer SDK provider for MetaMask (like msqpay.js) - this shows browser/mobile dialog
        if (this.mmsdk) {
          try {
            const sdkProvider = this.mmsdk.getProvider();
            if (sdkProvider) {
              return sdkProvider;
            }
          } catch {
            // SDK might not be ready, fall through to extension
          }
        }

        // Fallback to extension
        // IMPORTANT: Check providers array FIRST when multiple wallets installed
        if (Array.isArray(window.ethereum?.providers)) {
          const mmProvider = window.ethereum.providers.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic wallet provider types
            (p: any) => p.isMetaMask && !p.isTrust && !p.isTrustWallet
          );
          if (mmProvider) {
            return mmProvider;
          }
        }

        // Check extension - but only if it's NOT Trust Wallet
        if (
          window.ethereum?.isMetaMask &&
          !window.ethereum?.isTrust &&
          !window.ethereum?.isTrustWallet
        ) {
          return window.ethereum;
        }

        // Check EIP-6963
        const mmProvider = this.detectedProviders.find(
          (p) =>
            (p.info.name.toLowerCase().includes('metamask') || p.info.rdns === 'io.metamask') &&
            !p.info.name.toLowerCase().includes('trust')
        );
        return mmProvider?.provider || null;
      }

      case WALLET_TYPES.TRUST: {
        // Check window.trustwallet first (most reliable)
        if (window.trustwallet) return window.trustwallet;
        if (window.trustWallet) return window.trustWallet;

        // Check providers array FIRST when multiple wallets installed
        if (Array.isArray(window.ethereum?.providers)) {
          const twProvider = window.ethereum.providers.find(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic wallet provider types
            (p: any) => (p.isTrust || p.isTrustWallet) && !p.isMetaMask
          );
          if (twProvider) {
            return twProvider;
          }
        }

        // Check window.ethereum - but only if it's NOT MetaMask
        if (
          (window.ethereum?.isTrust || window.ethereum?.isTrustWallet) &&
          !window.ethereum?.isMetaMask
        ) {
          return window.ethereum;
        }

        // Check EIP-6963
        const twProvider = this.detectedProviders.find(
          (p) =>
            (p.info.name.toLowerCase().includes('trust') ||
              p.info.rdns === 'com.trustwallet.app') &&
            !p.info.name.toLowerCase().includes('metamask')
        );
        return twProvider?.provider || null;
      }

      default:
        return window.ethereum || null;
    }
  }
}
