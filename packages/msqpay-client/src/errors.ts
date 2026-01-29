/**
 * Custom error classes for MSQPay SDK
 */

/**
 * Base error class for MSQPay SDK
 */
export class MSQPayError extends Error {
  constructor(
    message: string,
    public code?: string | number
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Wallet connection error
 * Thrown when wallet connection fails or is rejected by user
 *
 * @example
 * ```typescript
 * throw new WalletConnectionError('Connection rejected by user', 4001);
 * ```
 */
export class WalletConnectionError extends MSQPayError {
  // Constructor is required for proper type safety and API documentation
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(message: string, code?: string | number) {
    super(message, code);
  }
}

/**
 * Wallet not found error
 */
export class WalletNotFoundError extends MSQPayError {
  constructor(walletType?: string) {
    super(
      walletType
        ? `Wallet "${walletType}" is not available. Please install it.`
        : 'No wallet detected. Please install MetaMask or Trust Wallet.',
      'WALLET_NOT_FOUND'
    );
  }
}

/**
 * Payment error
 * Thrown when payment processing fails (validation, transaction, etc.)
 *
 * @example
 * ```typescript
 * throw new PaymentError('Invalid payment amount', 'INVALID_AMOUNT');
 * ```
 */
export class PaymentError extends MSQPayError {
  // Constructor is required for proper type safety and API documentation
  // eslint-disable-next-line @typescript-eslint/no-useless-constructor
  constructor(message: string, code?: string | number) {
    super(message, code);
  }
}

/**
 * Network error
 * Thrown when network-related operations fail (wrong chain, network switch failed, etc.)
 *
 * @example
 * ```typescript
 * throw new NetworkError('Unsupported network', 137);
 * ```
 */
export class NetworkError extends MSQPayError {
  constructor(
    message: string,
    public chainId?: number,
    code?: string | number
  ) {
    super(message, code);
  }
}

/**
 * API error
 * Thrown when API requests fail
 *
 * @example
 * ```typescript
 * throw new APIError('Failed to create payment', 400, 'INVALID_REQUEST');
 * ```
 */
export class APIError extends MSQPayError {
  constructor(
    message: string,
    public statusCode?: number,
    code?: string | number
  ) {
    super(message, code);
  }
}
