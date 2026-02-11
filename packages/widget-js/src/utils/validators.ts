import type { PaymentRequest } from '../types';

/** Validation result */
export interface ValidationResult {
  valid: boolean;
  errors: Record<string, string>;
}

/** Validate a payment request */
export function validatePaymentRequest(request: PaymentRequest): ValidationResult {
  const errors: Record<string, string> = {};

  if (!request.orderId || request.orderId.trim() === '') {
    errors.orderId = 'Order ID is required';
  }

  const amountStr = request.amount != null ? String(request.amount).trim() : '';
  if (!amountStr) {
    errors.amount = 'Amount is required';
  } else if (isNaN(parseFloat(amountStr)) || parseFloat(amountStr) <= 0) {
    errors.amount = 'Amount must be a positive number';
  }

  if (!request.tokenAddress || request.tokenAddress.trim() === '') {
    errors.tokenAddress = 'Token address is required';
  } else if (!/^0x[a-fA-F0-9]{40}$/.test(request.tokenAddress)) {
    errors.tokenAddress = 'Invalid token address format';
  }

  if (!request.successUrl || request.successUrl.trim() === '') {
    errors.successUrl = 'Success URL is required';
  } else if (!isValidUrl(request.successUrl)) {
    errors.successUrl = 'Invalid success URL';
  }

  if (!request.failUrl || request.failUrl.trim() === '') {
    errors.failUrl = 'Fail URL is required';
  } else if (!isValidUrl(request.failUrl)) {
    errors.failUrl = 'Invalid fail URL';
  }

  if (request.webhookUrl && !isValidUrl(request.webhookUrl)) {
    errors.webhookUrl = 'Invalid webhook URL';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/** Check if a string is a valid URL */
function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/** Format amount for display */
export function formatAmount(amount: string, decimals: number = 2): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return '0';
  return num.toFixed(decimals);
}

/** Truncate address for display */
export function truncateAddress(address: string, chars: number = 4): string {
  if (!address || address.length < chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}
