/**
 * MSQPay JavaScript SDK - Entry Point
 */

import { MSQPay } from './msqpay';
import { WALLET_TYPES } from './constants';

// Create singleton instance (only if ethers is available)
let msqpayInstance: MSQPay | null = null;

function createInstance(): MSQPay | null {
  if (typeof ethers === 'undefined') {
    return null;
  }
  try {
    return new MSQPay();
  } catch {
    return null;
  }
}

// Try to create instance immediately
msqpayInstance = createInstance();

// If ethers not ready, wait for it
if (!msqpayInstance && typeof window !== 'undefined') {
  import('./constants').then(({ TIMING }) => {
    const checkEthers = setInterval(() => {
      msqpayInstance = createInstance();
      if (msqpayInstance) {
        clearInterval(checkEthers);
        if (typeof window !== 'undefined') {
          window.MSQPay = msqpayInstance;
          if (WALLET_TYPES) {
            window.MSQPay.WALLET_TYPES = WALLET_TYPES;
          }
          window.dispatchEvent(new CustomEvent('msqpay:ready'));
        }
      }
    }, TIMING.ETHERS_CHECK_INTERVAL);

    // Timeout after configured time
    setTimeout(() => {
      clearInterval(checkEthers);
      if (!msqpayInstance) {
        console.error('MSQPay: ethers.js not loaded. Please load ethers.js before MSQPay.');
      }
    }, TIMING.ETHERS_CHECK_TIMEOUT);
  });
}

// Export as default
export default msqpayInstance;

// Also expose globally for CDN usage
if (typeof window !== 'undefined' && msqpayInstance) {
  window.MSQPay = msqpayInstance;
  if (WALLET_TYPES) {
    window.MSQPay.WALLET_TYPES = WALLET_TYPES;
  }
}
