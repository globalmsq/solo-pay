/**
 * @solo-pay/widget-js
 * Lightweight, framework-agnostic payment widget
 *
 * @example Script tag usage:
 * ```html
 * <script src="https://cdn.jsdelivr.net/npm/@solo-pay/widget-js/dist/widget.min.js"></script>
 * <script>
 *   const soloPay = new SoloPay({ publicKey: 'pk_live_xxx' });
 *   soloPay.requestPayment({
 *     orderId: 'order-123',
 *     amount: '10',
 *     tokenAddress: '0x...',
 *     successUrl: 'https://example.com/success',
 *     failUrl: 'https://example.com/fail'
 *   });
 * </script>
 * ```
 *
 * @example ESM usage:
 * ```typescript
 * import { SoloPay } from '@solo-pay/widget-js';
 *
 * const soloPay = new SoloPay({ publicKey: 'pk_live_xxx' });
 * soloPay.requestPayment({
 *   orderId: 'order-123',
 *   amount: '10',
 *   tokenAddress: '0x...',
 *   successUrl: 'https://example.com/success',
 *   failUrl: 'https://example.com/fail'
 * });
 * ```
 */

// Core
import { SoloPay } from './core/SoloPay';
export { SoloPay };
export type { RequestPaymentOptions } from './core/SoloPay';

// Types
export type {
  SoloPayConfig,
  PaymentRequest,
  PaymentResult,
  RedirectMode,
  TokenInfo,
} from './types';

// Utilities (for advanced usage)
export { formatAmount, validatePaymentRequest, truncateAddress } from './utils/validators';
export { WidgetLauncher } from './utils/widget-launcher';
export { getTheme, lightTheme, darkTheme } from './styles/theme';
export type { Theme } from './styles/theme';

// Default export for IIFE build (window.SoloPay = SoloPay class)
export default SoloPay;
