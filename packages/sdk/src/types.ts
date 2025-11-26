import type { Address, Hash, Hex } from "viem";

/**
 * Configuration for MSQPayClient
 */
export interface MSQPayConfig {
  /** Chain ID (e.g., 80002 for Polygon Amoy) */
  chainId: number;
  /** RPC URL for the chain */
  rpcUrl: string;
  /** PaymentGateway proxy contract address */
  gatewayAddress: Address;
  /** ERC2771Forwarder contract address */
  forwarderAddress: Address;
  /** OpenZeppelin Defender relay URL (for meta-transactions) */
  defenderRelayUrl?: string;
  /** Subgraph URL for querying payment history */
  subgraphUrl?: string;
}

/**
 * Token configuration
 */
export interface TokenConfig {
  address: Address;
  symbol: string;
  decimals: number;
}

/**
 * Parameters for creating a payment
 */
export interface PaymentParams {
  /** Unique payment/order ID (will be hashed to bytes32) */
  paymentId: string;
  /** ERC20 token address */
  token: Address;
  /** Amount to pay (in token's smallest unit, e.g., wei) */
  amount: bigint;
  /** Merchant address to receive the payment */
  merchant: Address;
}

/**
 * Transaction request for direct payment
 */
export interface PaymentTxData {
  to: Address;
  data: Hex;
  value: bigint;
}

/**
 * EIP-712 signature request for meta-transaction
 */
export interface MetaTxSignRequest {
  domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: Address;
  };
  types: {
    ForwardRequest: Array<{ name: string; type: string }>;
  };
  primaryType: "ForwardRequest";
  message: ForwardRequest;
}

/**
 * ERC2771 Forward Request structure
 */
export interface ForwardRequest {
  from: Address;
  to: Address;
  value: bigint;
  gas: bigint;
  nonce: bigint;
  deadline: bigint;
  data: Hex;
}

/**
 * Signed forward request ready for submission
 */
export interface SignedForwardRequest {
  request: ForwardRequest;
  signature: Hex;
}

/**
 * Payment status from blockchain/subgraph
 */
export interface Payment {
  id: string;
  paymentId: Hash;
  payer: Address;
  merchant: Address;
  token: Address;
  amount: bigint;
  timestamp: bigint;
  transactionHash: Hash;
  blockNumber: bigint;
  gasMode: "Direct" | "MetaTx";
}

/**
 * Merchant statistics from subgraph
 */
export interface MerchantStats {
  address: Address;
  totalReceived: bigint;
  paymentCount: number;
  lastPaymentAt?: bigint;
}

/**
 * Payment query parameters
 */
export interface PaymentQuery {
  merchant?: Address;
  payer?: Address;
  fromTimestamp?: bigint;
  toTimestamp?: bigint;
  first?: number;
  skip?: number;
}

/**
 * Payment event callback
 */
export type PaymentCallback = (payment: Payment) => void;

/**
 * Unsubscribe function
 */
export type Unsubscribe = () => void;

/**
 * Error codes for SDK operations
 */
export enum PaymentErrorCode {
  INVALID_PAYMENT_ID = "INVALID_PAYMENT_ID",
  INVALID_AMOUNT = "INVALID_AMOUNT",
  INVALID_MERCHANT = "INVALID_MERCHANT",
  INVALID_TOKEN = "INVALID_TOKEN",
  PAYMENT_ALREADY_PROCESSED = "PAYMENT_ALREADY_PROCESSED",
  INSUFFICIENT_BALANCE = "INSUFFICIENT_BALANCE",
  INSUFFICIENT_ALLOWANCE = "INSUFFICIENT_ALLOWANCE",
  SIGNATURE_INVALID = "SIGNATURE_INVALID",
  SIGNATURE_EXPIRED = "SIGNATURE_EXPIRED",
  RELAY_ERROR = "RELAY_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

/**
 * Custom error class for payment operations
 */
export class PaymentError extends Error {
  constructor(
    public code: PaymentErrorCode,
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = "PaymentError";
  }

  /**
   * Whether this error is recoverable (can retry)
   */
  get recoverable(): boolean {
    return [
      PaymentErrorCode.NETWORK_ERROR,
      PaymentErrorCode.RELAY_ERROR,
    ].includes(this.code);
  }
}
