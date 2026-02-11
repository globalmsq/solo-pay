/** SDK Configuration options */
export interface SoloPayConfig {
  /** Public key for merchant authentication (pk_xxx) */
  publicKey: string;
  /** Widget base URL (default: https://widget.solo-pay.com) */
  widgetUrl?: string;
  /** Enable debug logging */
  debug?: boolean;
  /** Default redirect mode */
  redirectMode?: RedirectMode;
}

/** How to open the payment widget
 * - 'auto': iframe on PC, redirect on mobile (default)
 * - 'iframe': Always open in iframe modal
 * - 'redirect': Always redirect to widget page
 */
export type RedirectMode = 'auto' | 'redirect' | 'iframe';

/** Payment request options - matches widget URL parameters */
export interface PaymentRequest {
  /** Merchant order ID (required) */
  orderId: string;
  /** Payment amount in human readable format, e.g., "10", "10.50", or 10 (required) */
  amount: string | number;
  /** ERC-20 token contract address (required) */
  tokenAddress: string;
  /** Redirect URL on success (required) */
  successUrl: string;
  /** Redirect URL on failure (required) */
  failUrl: string;
  /** Server notification URL (optional) */
  webhookUrl?: string;
}

/** Payment result from callback */
export interface PaymentResult {
  /** Whether payment was successful */
  success: boolean;
  /** Payment ID from contract */
  paymentId?: string;
  /** Transaction hash */
  txHash?: string;
  /** Order ID */
  orderId: string;
  /** Error message (if failed) */
  error?: string;
}

/** Token information for display */
export interface TokenInfo {
  /** Token contract address */
  address: string;
  /** Token symbol (e.g., USDT) */
  symbol: string;
  /** Token decimals */
  decimals: number;
  /** Token name */
  name?: string;
  /** Token icon URL */
  iconUrl?: string;
}
