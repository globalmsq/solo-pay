export type PaymentStepType =
  | 'wallet-connect'
  | 'token-approval'
  | 'payment-confirm'
  | 'payment-processing'
  | 'payment-complete';

/**
 * URL parameters for widget initialization
 * Matches: /?pk=xxx&orderId=xxx&amount=xxx&successUrl=xxx&failUrl=xxx&webhookUrl=xxx
 */
export interface WidgetUrlParams {
  /** Public key for merchant authentication (required) */
  pk: string;
  /** Merchant order ID (required) */
  orderId: string;
  /** Payment amount in human readable format (required) */
  amount: string;
  /** Redirect URL on success (required) */
  successUrl: string;
  /** Redirect URL on failure (required) */
  failUrl: string;
  /** Server notification URL (optional) */
  webhookUrl?: string;
}

/**
 * Validation result for URL parameters
 */
export interface UrlParamsValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  /** Validated parameters (only if isValid is true) */
  params?: WidgetUrlParams;
  /** Validation errors (only if isValid is false) */
  errors?: string[];
}

/**
 * API response from POST /payments/create
 */
export interface PaymentDetails {
  /** Payment hash for smart contract */
  paymentId: string;
  /** Merchant order ID */
  orderId: string;
  /** Server EIP-712 signature for contract verification */
  serverSignature: string;
  /** Blockchain network ID */
  chainId: number;
  /** ERC20 token contract address */
  tokenAddress: string;
  /** PaymentGateway contract address */
  gatewayAddress: string;
  /** Amount in wei (string) */
  amount: string;
  /** Token decimals */
  tokenDecimals: number;
  /** Token symbol (e.g., USDT) */
  tokenSymbol: string;
  /** Redirect URL on success */
  successUrl: string;
  /** Redirect URL on failure */
  failUrl: string;
  /** Payment expiration time (ISO string) */
  expiresAt: string;
  /** Recipient/treasury address */
  recipientAddress: string;
  /** Merchant ID (bytes32) */
  merchantId: string;
  /** Fee in basis points (e.g., 100 = 1%) */
  feeBps: number;
  /** ERC2771Forwarder contract address (for gasless payments) */
  forwarderAddress?: string;
}

/** Gas payment mode */
export type GasMode = 'direct' | 'gasless';

/**
 * @deprecated Use WidgetUrlParams and PaymentDetails instead
 */
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
