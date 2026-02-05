export type PaymentStepType =
  | 'wallet-connect'
  | 'token-approval'
  | 'payment-confirm'
  | 'payment-processing'
  | 'payment-complete';

export interface PaymentInfo {
  product: string;
  amount: string;
  token: string;
  network: string;
  merchantId?: string;
}

export interface WalletInfo {
  address: string;
  balance: string;
}

export interface TransactionResult {
  txHash: string;
  date: string;
}
