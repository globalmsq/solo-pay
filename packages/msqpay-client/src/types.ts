/**
 * Type definitions for MSQPay Client
 */

import { WalletType } from './constants';

// EIP-1193 Provider interface
export interface EIP1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
  on(event: 'accountsChanged', handler: (accounts: string[]) => void): void;
  on(event: 'chainChanged', handler: (chainId: string) => void): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  removeListener(event: 'accountsChanged', handler: (accounts: string[]) => void): void;
  removeListener(event: 'chainChanged', handler: (chainId: string) => void): void;
  removeListener(event: string, handler: (...args: unknown[]) => void): void;
  isMetaMask?: boolean;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  providers?: EIP1193Provider[];
}

// Ethers.js types (using any for compatibility with CDN-loaded ethers)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EthersProvider = any; // ethers.BrowserProvider - CDN-loaded, type unavailable
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EthersSigner = any; // ethers.JsonRpcSigner - CDN-loaded, type unavailable
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EthersContract = any; // ethers.Contract - CDN-loaded, type unavailable
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type EthersInterface = any; // ethers.Interface - CDN-loaded, type unavailable

export interface MSQPayConfig {
  apiUrl?: string;
  apiKey?: string;
  merchantId?: string;
  infuraAPIKey?: string;
  dappName?: string;
  gaslessDeadline?: number; // Deadline in seconds (default: 600)
  gaslessGasLimit?: number | string; // Gas limit for gasless transactions (default: 300000)
}

export interface Token {
  id?: number;
  address: string;
  symbol: string;
  decimals: number;
  chain_id?: number;
}

export interface Chain {
  id?: number;
  network_id?: number;
  networkId?: number;
  chain_id?: number;
  chainId?: number;
  name?: string;
  is_testnet?: boolean;
}

export interface PaymentMethod {
  id?: number;
  recipient_address?: string;
  recipientAddress?: string;
  token?: Token;
  chain?: Chain;
  is_enabled?: boolean;
}

export interface Payment {
  paymentId: string;
  payment_hash?: string;
  chainId: number;
  tokenAddress: string;
  tokenSymbol?: string;
  tokenDecimals?: number;
  gatewayAddress: string;
  forwarderAddress?: string;
  amount: string; // wei
  status?: string;
  expiresAt?: string;
}

export interface ConnectOptions {
  walletType?: WalletType;
  showSelector?: boolean;
}

export interface ConnectResult {
  address: string;
  chainId: number;
  walletType: WalletType;
}

export interface CreatePaymentOptions {
  amount: number | string;
  currency: string;
  showDialog?: boolean;
}

export interface CreateGaslessPaymentOptions {
  amount: number | string;
  currency: string;
  showDialog?: boolean;
  deadline?: number; // Override config.gaslessDeadline
  gasLimit?: number | string; // Override config.gaslessGasLimit
}

export interface PaymentResult {
  success: boolean;
  payment: Payment;
  txHash: string;
  relayRequestId?: string;
  gasless?: boolean;
}

export interface ForwardRequest {
  from: string;
  to: string;
  value: string;
  gas: string;
  nonce: string;
  deadline: string;
  data: string;
  signature: string;
}

export interface RelayResponse {
  relayRequestId: string;
  status?: string;
}

export interface RelayResult {
  status?: string;
  transactionHash?: string;
  error?: string;
}

export interface NetworkConfig {
  chainName: string;
  rpcUrls: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorerUrls: string[];
}
