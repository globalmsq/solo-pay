/**
 * MSQPay JavaScript SDK - Entry Point
 */

import { MSQPay } from './msqpay.js';

// Create singleton instance (only if ethers is available)
let msqpayInstance = null;

function createInstance() {
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
  const checkEthers = setInterval(() => {
    msqpayInstance = createInstance();
    if (msqpayInstance) {
      clearInterval(checkEthers);
      if (typeof window !== 'undefined') {
        window.MSQPay = msqpayInstance;
        if (MSQPay.WALLET_TYPES) {
          window.MSQPay.WALLET_TYPES = MSQPay.WALLET_TYPES;
        }
        window.dispatchEvent(new CustomEvent('msqpay:ready'));
      }
    }
  }, 100);

  // Timeout after 10 seconds
  setTimeout(() => {
    clearInterval(checkEthers);
    if (!msqpayInstance) {
      console.error('MSQPay: ethers.js not loaded. Please load ethers.js before MSQPay.');
    }
  }, 10000);
}

// Export as default
export default msqpayInstance;

// Also expose globally for CDN usage
if (typeof window !== 'undefined' && msqpayInstance) {
  window.MSQPay = msqpayInstance;
  if (MSQPay.WALLET_TYPES) {
    window.MSQPay.WALLET_TYPES = MSQPay.WALLET_TYPES;
  }
}
