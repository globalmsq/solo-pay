import type { WidgetUrlParams, UrlParamsValidationResult } from '../types';

/**
 * Validate URL parameters for widget initialization
 *
 * Required params: pk, orderId, amount, successUrl, failUrl
 * Optional params: webhookUrl
 *
 * @example
 * ```tsx
 * // In any React component
 * const searchParams = useSearchParams();
 * const result = validateWidgetUrlParams(searchParams);
 *
 * if (!result.isValid) {
 *   return <ErrorPage errors={result.errors} />;
 * }
 *
 * const { pk, orderId, amount, successUrl, failUrl, webhookUrl } = result.params;
 * ```
 */
export function validateWidgetUrlParams(
  searchParams: URLSearchParams | { get: (key: string) => string | null }
): UrlParamsValidationResult {
  const errors: string[] = [];

  // Extract all parameters
  const pk = searchParams.get('pk');
  const orderId = searchParams.get('orderId');
  const amount = searchParams.get('amount');
  const successUrl = searchParams.get('successUrl');
  const failUrl = searchParams.get('failUrl');
  const webhookUrl = searchParams.get('webhookUrl');

  // Validate required fields
  if (!pk || pk.trim() === '') {
    errors.push('pk (public key) is required');
  } else if (!pk.startsWith('pk_')) {
    errors.push('pk must start with "pk_"');
  }

  if (!orderId || orderId.trim() === '') {
    errors.push('orderId is required');
  }

  if (!amount || amount.trim() === '') {
    errors.push('amount is required');
  } else {
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      errors.push('amount must be a positive number');
    }
  }

  if (!successUrl || successUrl.trim() === '') {
    errors.push('successUrl is required');
  } else if (!isValidUrl(successUrl)) {
    errors.push('successUrl must be a valid URL');
  }

  if (!failUrl || failUrl.trim() === '') {
    errors.push('failUrl is required');
  } else if (!isValidUrl(failUrl)) {
    errors.push('failUrl must be a valid URL');
  }

  // Validate optional fields
  if (webhookUrl && webhookUrl.trim() !== '' && !isValidUrl(webhookUrl)) {
    errors.push('webhookUrl must be a valid URL');
  }

  // Return result
  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  return {
    isValid: true,
    params: {
      pk: pk!,
      orderId: orderId!,
      amount: amount!,
      successUrl: successUrl!,
      failUrl: failUrl!,
      webhookUrl: webhookUrl && webhookUrl.trim() !== '' ? webhookUrl : undefined,
    },
  };
}

/**
 * Check if a string is a valid URL
 */
function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get widget URL parameters from URLSearchParams (convenience wrapper)
 *
 * @returns Validated params or null if validation fails
 *
 * @example
 * ```tsx
 * const params = getWidgetParams(searchParams);
 * if (!params) {
 *   return <div>Invalid parameters</div>;
 * }
 * ```
 */
export function getWidgetParams(
  searchParams: URLSearchParams | { get: (key: string) => string | null }
): WidgetUrlParams | null {
  const result = validateWidgetUrlParams(searchParams);
  return result.isValid ? result.params! : null;
}
