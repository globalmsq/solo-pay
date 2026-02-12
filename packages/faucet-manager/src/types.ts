/**
 * Input for requesting a one-time gas grant (faucet).
 */
export interface RequestGasParams {
  paymentId: string;
  walletAddress: string;
}

/**
 * Result of a successful gas grant.
 */
export interface RequestGasResult {
  txHash: string;
  amount: string;
  chainId: number;
}

/**
 * Error codes for request gas failures.
 */
export type RequestGasErrorCode =
  | 'PAYMENT_NOT_FOUND'
  | 'INSUFFICIENT_TOKEN_BALANCE'
  | 'ALREADY_HAS_GAS'
  | 'ALREADY_GRANTED'
  | 'CHAIN_NOT_CONFIGURED'
  | 'SEND_FAILED';

export class RequestGasError extends Error {
  constructor(
    public code: RequestGasErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'RequestGasError';
  }
}
