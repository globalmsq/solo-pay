// Main client
export { MSQPayClient } from "./MSQPayClient";

// Types
export type {
  MSQPayConfig,
  TokenConfig,
  PaymentParams,
  PaymentTxData,
  MetaTxSignRequest,
  ForwardRequest,
  SignedForwardRequest,
  Payment,
  MerchantStats,
  PaymentQuery,
  PaymentCallback,
  Unsubscribe,
} from "./types";

// Error handling
export { PaymentError, PaymentErrorCode } from "./types";

// Constants
export {
  POLYGON_AMOY,
  TOKENS,
  CONTRACTS,
  SUBGRAPH_URLS,
  DEFAULT_META_TX_GAS,
  DEFAULT_META_TX_DEADLINE_SECONDS,
  getChainConfig,
  getTokenConfig,
  PAYMENT_GATEWAY_ABI,
  FORWARDER_ABI,
  ERC20_ABI,
} from "./constants";

// EIP-712 utilities
export {
  FORWARD_REQUEST_TYPES,
  createForwarderDomain,
  createForwardRequest,
  createMetaTxSignRequest,
  paymentIdToBytes32,
  isDeadlineExpired,
  getDeadlineRemainingSeconds,
} from "./eip712";
