export type Environment = 'development' | 'staging' | 'production' | 'custom';

export interface MSQPayConfig {
  environment: Environment;
  apiKey: string;
  apiUrl?: string;
}

// Request types
export interface CreatePaymentParams {
  amount: number;
  currency: string;
  chainId: number;
  recipientAddress: string;
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

// Response types
export interface CreatePaymentResponse {
  success: boolean;
  paymentId: string;
  tokenAddress: string;
  gatewayAddress: string;
  forwarderAddress: string;
  amount: string; // wei
  status: string;
}

export interface PaymentStatusResponse {
  success: true;
  data: {
    id: string;
    userId: string;
    amount: number;
    currency: 'USD' | 'EUR' | 'KRW';
    tokenAddress: string;
    recipientAddress: string;
    status: 'pending' | 'confirmed' | 'failed' | 'completed';
    transactionHash?: string;
    blockNumber?: number;
    createdAt: string;
    updatedAt: string;
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

export interface ErrorResponse {
  success: false;
  code: string;
  message: string;
  details?: unknown;
}
