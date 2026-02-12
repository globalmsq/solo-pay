/**
 * Ports (dependencies) for GasFaucetService.
 * Implemented by the faucet-manager HTTP service (or any host that runs the faucet logic).
 */

export interface PaymentInfo {
  paymentId: string;
  networkId: number;
  amountWei: bigint;
  tokenAddress: string;
  gatewayAddress: string;
}

export type GetPaymentInfo = (paymentId: string) => Promise<PaymentInfo | null>;

export type FindWalletGasGrant = (
  walletAddress: string,
  chainId: number
) => Promise<{ id: number } | null>;

export type GetNativeBalance = (chainId: number, address: string) => Promise<bigint>;

export type GetTokenBalance = (
  chainId: number,
  tokenAddress: string,
  address: string
) => Promise<bigint>;

export type GetGasPrice = (chainId: number) => Promise<bigint>;

export type SendNative = (chainId: number, toAddress: string, amountWei: bigint) => Promise<string>;

export type CreateWalletGasGrant = (params: {
  walletAddress: string;
  chainId: number;
  amount: string;
  txHash: string | null;
}) => Promise<void>;

export interface GasFaucetPorts {
  getPaymentInfo: GetPaymentInfo;
  findWalletGasGrant: FindWalletGasGrant;
  getTokenBalance: GetTokenBalance;
  getNativeBalance: GetNativeBalance;
  getGasPrice: GetGasPrice;
  sendNative: SendNative;
  createWalletGasGrant: CreateWalletGasGrant;
}
