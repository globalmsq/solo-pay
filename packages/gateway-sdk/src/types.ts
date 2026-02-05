export type Environment = 'development' | 'staging' | 'production' | 'custom';

export interface SoloPayConfig {
  environment: Environment;
  apiKey: string;
  apiUrl?: string;
}

// Request types
// Note: recipientAddress 제거됨 - 컨트랙트가 treasury로 고정 결제
export interface CreatePaymentParams {
  /** 상점 고유 식별자 */
  merchantId: string;
  /** 결제 금액 (토큰 단위) */
  amount: number;
  /** 블록체인 체인 ID */
  chainId: number;
  /** 결제 토큰 컨트랙트 주소 */
  tokenAddress: string;
}

/**
 * ERC2771 ForwardRequest for gasless meta-transactions
 * Matches OZ ERC2771Forwarder.execute() parameters
 */
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

export interface GaslessParams {
  paymentId: string;
  forwarderAddress: string;
  forwardRequest: ForwardRequest;
}

export interface RelayParams {
  paymentId: string;
  transactionData: string;
  gasEstimate: number;
}

export interface GetPaymentHistoryParams {
  /** 블록체인 체인 ID */
  chainId: number;
  /** 결제자 지갑 주소 */
  payer: string;
  /** 조회할 블록 범위 (기본값: 1000) */
  limit?: number;
}

// Response types
export interface CreatePaymentResponse {
  success: boolean;
  paymentId: string;
  chainId: number;
  tokenAddress: string;
  /** Token symbol fetched from on-chain */
  tokenSymbol: string;
  /** Token decimals fetched from on-chain */
  tokenDecimals: number;
  gatewayAddress: string;
  forwarderAddress: string;
  amount: string; // wei
  status: string;
  expiresAt: string;
  /** Recipient address (merchant's wallet to receive payment) */
  recipientAddress?: string;
  /** Merchant identifier (bytes32, keccak256 of merchant_key) */
  merchantId?: string;
  /** Fee in basis points (0-10000, where 10000 = 100%) */
  feeBps?: number;
  /** Server EIP-712 signature for payment authorization */
  serverSignature?: string;
}

export interface PaymentStatusResponse {
  success: true;
  data: {
    paymentId: string;
    /** Payer wallet address (from chain) */
    payerAddress: string;
    amount: number;
    tokenAddress: string;
    tokenSymbol: string;
    /** 결제를 받는 treasury 주소 (컨트랙트 배포 시 설정) */
    treasuryAddress: string;
    status: string;
    transactionHash?: string;
    blockNumber?: number;
    createdAt: string;
    updatedAt: string;
    payment_hash: string;
    network_id: number;
    token_symbol: string;
  };
}

export interface GaslessResponse {
  success: true;
  relayRequestId: string;
  status: 'submitted' | 'mined' | 'failed';
  message: string;
}

export interface RelayResponse {
  success: true;
  relayRequestId: string;
  transactionHash?: string;
  status: 'submitted' | 'mined' | 'failed';
  message: string;
}

export interface RelayStatusResponse {
  success: true;
  relayRequestId: string;
  transactionHash?: string;
  status: 'submitted' | 'pending' | 'mined' | 'confirmed' | 'failed';
}

export interface ErrorDetails {
  message?: string;
  path?: (string | number)[];
  [key: string]: string | number | boolean | (string | number)[] | undefined;
}

export interface ErrorResponse {
  success: false;
  code: string;
  message: string;
  details?: ErrorDetails[];
}

// Payment History types
export interface PaymentHistoryItem {
  /** 결제 ID (bytes32 해시) */
  paymentId: string;
  /** 결제자 주소 */
  payer: string;
  /** 트레저리 주소 */
  treasury: string;
  /** 토큰 컨트랙트 주소 */
  token: string;
  /** 토큰 심볼 */
  tokenSymbol: string;
  /** 토큰 소수점 자리수 */
  decimals: number;
  /** 결제 금액 (Wei 단위) */
  amount: string;
  /** 결제 완료 시간 (Unix timestamp) */
  timestamp: string;
  /** 트랜잭션 해시 */
  transactionHash: string;
  /** 결제 상태 */
  status: string;
  /** Gasless 결제 여부 */
  isGasless: boolean;
  /** Relay 요청 ID (Gasless인 경우) */
  relayId?: string;
}

export interface PaymentHistoryResponse {
  success: true;
  data: PaymentHistoryItem[];
}
