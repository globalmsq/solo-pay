/**
 * Global type definitions for browser environment
 */

// Ethers.js global (loaded via CDN)
declare const ethers: typeof import('ethers');

// MetaMask SDK global (loaded via CDN)
declare namespace MetaMaskSDK {
  class MetaMaskSDK {
    constructor(options: {
      dappMetadata: {
        name: string;
        url: string;
        iconUrl?: string;
      };
      infuraAPIKey?: string;
      checkInstallationImmediately?: boolean;
      useDeeplink?: boolean;
      communicationLayerPreference?: 'socket' | 'rpc';
      openDeeplink?: (link: string) => void;
    });
    init(): Promise<void>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getProvider(): any; // EIP-1193 provider - type varies by implementation
  }
}

// Window extensions
interface Window {
  ethers?: typeof ethers;
  MetaMaskSDK?:
    | typeof MetaMaskSDK
    | {
        MetaMaskSDK?: typeof MetaMaskSDK;
        default?: typeof MetaMaskSDK;
      };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  MSQPay?: any; // MSQPay instance - defined in index.ts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ethereum?: any; // EIP-1193 provider - type varies by wallet implementation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trustwallet?: any; // Trust Wallet provider - type varies
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trustWallet?: any; // Trust Wallet provider (alternative) - type varies
}

// EIP-6963 Provider Info
interface EIP6963ProviderInfo {
  uuid: string;
  name: string;
  icon: string;
  rdns: string;
}

interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  provider: any; // EIP-1193 provider - type varies by wallet implementation
}

// Custom Events
interface MSQPayReadyEvent extends CustomEvent {
  detail: undefined;
}

interface MSQPayConnectedEvent extends CustomEvent {
  detail: {
    address: string;
    chainId: number;
    walletType: string;
  };
}

interface MSQPayDisconnectedEvent extends CustomEvent {
  detail: undefined;
}

interface MSQPayAccountChangedEvent extends CustomEvent {
  detail: {
    address: string;
    chainId: number;
  };
}

interface MSQPaySDKConnectedEvent extends CustomEvent {
  detail: {
    chainId: string;
  };
}

interface MSQPayPaymentCompleteEvent extends CustomEvent {
  detail: {
    paymentId: string;
    txHash: string;
  };
}

interface MSQPayPaymentErrorEvent extends CustomEvent {
  detail: {
    error: string;
  };
}
