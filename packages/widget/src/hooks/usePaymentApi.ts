import { useState, useCallback } from 'react';
import type { WidgetUrlParams, PaymentDetails } from '../types';
import {
  createPaymentFromUrlParams,
  getPaymentStatus,
  pollPaymentStatus,
  PaymentApiError,
  type PaymentStatusResponse,
} from '../lib/api';

// ============================================================================
// Types
// ============================================================================

export interface UsePaymentApiState {
  /** Payment details from API (null until createPayment succeeds) */
  payment: PaymentDetails | null;
  /** Current payment status */
  status: PaymentStatusResponse | null;
  /** Loading state */
  isLoading: boolean;
  /** Error message (null if no error) */
  error: string | null;
  /** Error code (null if no error) */
  errorCode: string | null;
}

export interface UsePaymentApiActions {
  /** Create a new payment from URL parameters */
  createPayment: (urlParams: WidgetUrlParams) => Promise<PaymentDetails | null>;
  /** Check payment status */
  checkStatus: (paymentId: string) => Promise<PaymentStatusResponse | null>;
  /** Poll status until completion */
  waitForConfirmation: (
    paymentId: string,
    onStatusChange?: (status: PaymentStatusResponse) => void
  ) => Promise<PaymentStatusResponse | null>;
  /** Clear error state */
  clearError: () => void;
  /** Reset all state */
  reset: () => void;
}

export interface UsePaymentApiReturn extends UsePaymentApiState, UsePaymentApiActions {}

// ============================================================================
// Hook
// ============================================================================

/**
 * React hook for payment API operations
 *
 * Provides easy-to-use functions for creating payments, checking status,
 * and waiting for confirmation.
 *
 * @example
 * ```tsx
 * function PaymentComponent({ urlParams }: { urlParams: WidgetUrlParams }) {
 *   const {
 *     payment,
 *     status,
 *     isLoading,
 *     error,
 *     createPayment,
 *     waitForConfirmation,
 *   } = usePaymentApi();
 *
 *   useEffect(() => {
 *     createPayment(urlParams);
 *   }, [urlParams]);
 *
 *   if (isLoading) return <Loading />;
 *   if (error) return <Error message={error} />;
 *   if (!payment) return null;
 *
 *   return <PaymentInfo payment={payment} />;
 * }
 * ```
 */
export function usePaymentApi(): UsePaymentApiReturn {
  const [payment, setPayment] = useState<PaymentDetails | null>(null);
  const [status, setStatus] = useState<PaymentStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  /** Stored for getPaymentStatus public auth (from urlParams when createPayment was called) */
  const [publicAuth, setPublicAuth] = useState<{
    publicKey: string;
    origin: string;
  } | null>(null);

  /**
   * Create a new payment
   */
  const createPayment = useCallback(
    async (urlParams: WidgetUrlParams): Promise<PaymentDetails | null> => {
      setIsLoading(true);
      setError(null);
      setErrorCode(null);

      try {
        const result = await createPaymentFromUrlParams(urlParams);
        setPayment(result);
        setPublicAuth({
          publicKey: urlParams.pk,
          origin: typeof window !== 'undefined' ? window.location.origin : '',
        });
        return result;
      } catch (err) {
        console.error(err);
        if (err instanceof PaymentApiError) {
          setError(err.message);
          setErrorCode(err.code);
        } else {
          setError(err instanceof Error ? err.message : 'Failed to create payment');
          setErrorCode('UNKNOWN_ERROR');
        }
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Check payment status once
   */
  const checkStatus = useCallback(
    async (paymentId: string): Promise<PaymentStatusResponse | null> => {
      setIsLoading(true);
      setError(null);
      setErrorCode(null);

      try {
        const options =
          publicAuth && (publicAuth.publicKey || publicAuth.origin)
            ? { publicKey: publicAuth.publicKey, origin: publicAuth.origin }
            : undefined;
        const result = await getPaymentStatus(paymentId, options);
        setStatus(result);
        return result;
      } catch (err) {
        if (err instanceof PaymentApiError) {
          setError(err.message);
          setErrorCode(err.code);
        } else {
          setError(err instanceof Error ? err.message : 'Failed to get status');
          setErrorCode('UNKNOWN_ERROR');
        }
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [publicAuth]
  );

  /**
   * Poll status until confirmed/failed
   */
  const waitForConfirmation = useCallback(
    async (
      paymentId: string,
      onStatusChange?: (status: PaymentStatusResponse) => void
    ): Promise<PaymentStatusResponse | null> => {
      setIsLoading(true);
      setError(null);
      setErrorCode(null);

      try {
        const result = await pollPaymentStatus(paymentId, {
          onStatusChange: (s) => {
            setStatus(s);
            onStatusChange?.(s);
          },
          publicKey: publicAuth?.publicKey,
          origin: publicAuth?.origin,
        });
        return result;
      } catch (err) {
        if (err instanceof PaymentApiError) {
          setError(err.message);
          setErrorCode(err.code);
        } else {
          setError(err instanceof Error ? err.message : 'Failed to confirm payment');
          setErrorCode('UNKNOWN_ERROR');
        }
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [publicAuth]
  );

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
    setErrorCode(null);
  }, []);

  /**
   * Reset all state
   */
  const reset = useCallback(() => {
    setPayment(null);
    setStatus(null);
    setPublicAuth(null);
    setIsLoading(false);
    setError(null);
    setErrorCode(null);
  }, []);

  return {
    // State
    payment,
    status,
    isLoading,
    error,
    errorCode,
    // Actions
    createPayment,
    checkStatus,
    waitForConfirmation,
    clearError,
    reset,
  };
}
