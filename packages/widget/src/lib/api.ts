import type { WidgetUrlParams, PaymentDetails } from '../types';

// ============================================================================
// Configuration
// ============================================================================

/**
 * Get API URL from environment variable or default to development
 *
 * NOTE: In Next.js, client-side code can only access env vars with NEXT_PUBLIC_ prefix
 */
function getApiUrl(): string {
  return process.env.NEXT_PUBLIC_GATEWAY_API_URL || 'http://localhost:3001';
}

// ============================================================================
// Error Handling
// ============================================================================

/**
 * API error with structured information
 */
export class PaymentApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number,
    public details?: Array<{ field?: string; message: string }>
  ) {
    super(message);
    this.name = 'PaymentApiError';
  }
}

interface ErrorResponse {
  code: string;
  message: string;
  details?: Array<{ field?: string; message: string }>;
}

// ============================================================================
// API Types
// ============================================================================

/**
 * Request body for POST /payments/create-public
 */
export interface CreatePublicPaymentRequest {
  orderId: string;
  amount: number;
  successUrl: string;
  failUrl: string;
  webhookUrl?: string;
}

/**
 * Response from POST /payments/create-public
 * This matches PaymentDetails type
 */
export interface CreatePublicPaymentResponse extends PaymentDetails {}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Create a payment using public key authentication
 *
 * This is the main API call for the widget. It creates a payment record
 * on the server and returns all the information needed to execute the
 * blockchain transaction.
 *
 * @param publicKey - Merchant's public key (pk_live_xxx or pk_test_xxx)
 * @param params - Payment parameters from URL
 * @returns Payment details including paymentId, signature, addresses, etc.
 * @throws PaymentApiError if the API call fails
 *
 * @example
 * ```typescript
 * const payment = await createPublicPayment(
 *   'pk_live_xxx',
 *   {
 *     orderId: '123',
 *     amount: 10,
 *     successUrl: 'https://example.com/success',
 *     failUrl: 'https://example.com/fail',
 *   }
 * );
 * console.log(payment.paymentId, payment.signature);
 * ```
 */
export async function createPublicPayment(
  publicKey: string,
  params: CreatePublicPaymentRequest
): Promise<CreatePublicPaymentResponse> {
  const apiUrl = getApiUrl();

  const response = await fetch(`${apiUrl}/payments/create-public`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-public-key': publicKey,
    },
    body: JSON.stringify(params),
    cache: 'no-store',
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data as ErrorResponse;
    throw new PaymentApiError(
      error.code || 'UNKNOWN_ERROR',
      error.message || 'Failed to create payment',
      response.status,
      error.details
    );
  }

  return data as CreatePublicPaymentResponse;
}

/**
 * Create payment from validated URL parameters
 *
 * Convenience function that takes WidgetUrlParams directly.
 *
 * @param urlParams - Validated URL parameters from validateWidgetUrlParams()
 * @returns Payment details
 * @throws PaymentApiError if the API call fails
 *
 * @example
 * ```typescript
 * const result = validateWidgetUrlParams(searchParams);
 * if (result.isValid) {
 *   const payment = await createPaymentFromUrlParams(result.params);
 * }
 * ```
 */
export async function createPaymentFromUrlParams(
  urlParams: WidgetUrlParams
): Promise<CreatePublicPaymentResponse> {
  return createPublicPayment(urlParams.pk, {
    orderId: urlParams.orderId,
    amount: parseFloat(urlParams.amount),
    successUrl: urlParams.successUrl,
    failUrl: urlParams.failUrl,
    webhookUrl: urlParams.webhookUrl,
  });
}

// ============================================================================
// Payment Status
// ============================================================================

/**
 * Payment status response
 */
export interface PaymentStatusResponse {
  paymentId: string;
  status: 'PENDING' | 'PROCESSING' | 'CONFIRMED' | 'FAILED' | 'EXPIRED';
  txHash?: string;
  confirmedAt?: string;
}

/**
 * Get payment status
 *
 * @param paymentId - Payment ID (hash)
 * @returns Payment status
 *
 * @example
 * ```typescript
 * const status = await getPaymentStatus(payment.paymentId);
 * if (status.status === 'CONFIRMED') {
 *   // Payment completed
 * }
 * ```
 */
export async function getPaymentStatus(paymentId: string): Promise<PaymentStatusResponse> {
  const apiUrl = getApiUrl();

  const response = await fetch(`${apiUrl}/payments/${paymentId}/status`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
  });

  const data = await response.json();

  if (!response.ok) {
    const error = data as ErrorResponse;
    throw new PaymentApiError(
      error.code || 'UNKNOWN_ERROR',
      error.message || 'Failed to get payment status',
      response.status,
      error.details
    );
  }

  return data as PaymentStatusResponse;
}

/**
 * Poll payment status until completion or timeout
 *
 * @param paymentId - Payment ID
 * @param options - Polling options
 * @returns Final payment status
 * @throws PaymentApiError if payment fails or times out
 *
 * @example
 * ```typescript
 * const finalStatus = await pollPaymentStatus(payment.paymentId, {
 *   maxAttempts: 30,
 *   intervalMs: 2000,
 *   onStatusChange: (status) => console.log('Status:', status),
 * });
 * ```
 */
export async function pollPaymentStatus(
  paymentId: string,
  options: {
    maxAttempts?: number;
    intervalMs?: number;
    onStatusChange?: (status: PaymentStatusResponse) => void;
  } = {}
): Promise<PaymentStatusResponse> {
  const { maxAttempts = 30, intervalMs = 2000, onStatusChange } = options;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await getPaymentStatus(paymentId);

    onStatusChange?.(status);

    if (status.status === 'CONFIRMED') {
      return status;
    }

    if (status.status === 'FAILED' || status.status === 'EXPIRED') {
      throw new PaymentApiError(
        `PAYMENT_${status.status}`,
        `Payment ${status.status.toLowerCase()}`,
        400
      );
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new PaymentApiError('TIMEOUT', 'Payment confirmation timeout', 408);
}
