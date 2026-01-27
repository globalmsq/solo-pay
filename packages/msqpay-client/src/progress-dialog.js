/**
 * Progress Dialog Component - Clean Implementation (No jQuery)
 */

import { BLOCK_EXPLORERS, GASLESS_STEPS } from './constants.js';

export class ProgressDialog {
  constructor({ amount, currency, steps, networkId }) {
    this.amount = amount;
    this.currency = currency;
    this.steps = steps;
    this.networkId = networkId;
    // Check if steps is GASLESS_STEPS by comparing structure
    this.isGasless = steps === GASLESS_STEPS || (steps && steps.SIGNING && steps.RELAYING);

    this.createDialog();
    this.injectStyles();
  }

  createDialog() {
    const existing = document.getElementById('msqpay-progress-dialog');
    if (existing) existing.remove();

    const stepLabels = this.isGasless
      ? [
          'Validating payment',
          'Creating payment request',
          'Approving token spend',
          'Signing transaction',
          'Relaying transaction',
          'Confirming payment',
        ]
      : [
          'Validating payment',
          'Creating payment request',
          'Approving token spend',
          'Waiting for wallet confirmation',
          'Processing transaction',
          'Confirming payment',
        ];

    const html = `
      <div id="msqpay-progress-dialog" class="msqpay-progress-overlay">
        <div class="msqpay-progress-dialog">
          <div class="msqpay-progress-header">
            <h3>Processing Payment${this.isGasless ? ' (Gasless)' : ''}</h3>
            <button class="msqpay-progress-close" aria-label="Close">&times;</button>
          </div>
          <div class="msqpay-progress-body">
            <div class="msqpay-progress-info">
              <span class="msqpay-progress-amount">${this.escapeHtml(String(this.amount))} ${this.escapeHtml(String(this.currency))}</span>
            </div>
            <div class="msqpay-progress-bar-container">
              <div class="msqpay-progress-bar">
                <div class="msqpay-progress-fill" style="width: 0%"></div>
              </div>
              <div class="msqpay-progress-step-info">
                <span class="msqpay-progress-step-number">Step 1 of 6</span>
                <span class="msqpay-progress-step-message">Initializing...</span>
              </div>
            </div>
            <div class="msqpay-progress-steps">
              ${stepLabels
                .map(
                  (label, i) => `
              <div class="msqpay-progress-step-item" data-step="${i + 1}">
                <span class="msqpay-progress-step-icon">○</span>
                <span>${this.escapeHtml(label)}</span>
              </div>`
                )
                .join('')}
            </div>
            <div class="msqpay-progress-tx-hash" style="display: none;">
              <small>Transaction: <a href="#" target="_blank" class="msqpay-progress-tx-link" rel="noopener noreferrer"></a></small>
            </div>
            <div class="msqpay-progress-result" style="display: none;"></div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    this.dialog = document.getElementById('msqpay-progress-dialog');

    const closeBtn = this.dialog.querySelector('.msqpay-progress-close');
    closeBtn.addEventListener('click', () => this.remove());
  }

  show() {
    if (this.dialog) {
      this.dialog.style.display = 'flex';
    }
  }

  hide() {
    if (this.dialog) {
      this.dialog.style.display = 'none';
    }
  }

  remove() {
    if (this.dialog && this.dialog.parentNode) {
      this.dialog.remove();
    }
  }

  updateStep(stepInfo, extra = {}) {
    if (!this.dialog) return;

    const percent = (stepInfo.step / stepInfo.total) * 100;
    const progressFill = this.dialog.querySelector('.msqpay-progress-fill');
    const stepNumber = this.dialog.querySelector('.msqpay-progress-step-number');
    const stepMessage = this.dialog.querySelector('.msqpay-progress-step-message');
    const stepItems = this.dialog.querySelectorAll('.msqpay-progress-step-item');

    if (progressFill) progressFill.style.width = percent + '%';
    if (stepNumber) stepNumber.textContent = `Step ${stepInfo.step} of ${stepInfo.total}`;
    if (stepMessage) stepMessage.textContent = stepInfo.message;

    stepItems.forEach((item) => {
      const itemStep = parseInt(item.getAttribute('data-step'));
      const icon = item.querySelector('.msqpay-progress-step-icon');
      item.classList.remove('active', 'completed');

      if (itemStep < stepInfo.step) {
        item.classList.add('completed');
        if (icon) icon.textContent = '✓';
      } else if (itemStep === stepInfo.step) {
        item.classList.add('active');
        if (icon) icon.textContent = '●';
      }
    });

    if (extra.txHash && this.isValidTxHash(extra.txHash)) {
      const explorerUrl = this.getExplorerTxUrl(extra.txHash);
      const txHashEl = this.dialog.querySelector('.msqpay-progress-tx-hash');
      const txLink = this.dialog.querySelector('.msqpay-progress-tx-link');

      if (txHashEl && txLink) {
        txLink.textContent = extra.txHash.slice(0, 10) + '...' + extra.txHash.slice(-8);
        if (explorerUrl) {
          txLink.href = explorerUrl;
        }
        txHashEl.style.display = 'block';
      }
    }
  }

  showSuccess(txHash) {
    if (!this.dialog) return;

    const stepItems = this.dialog.querySelectorAll('.msqpay-progress-step-item');
    const progressFill = this.dialog.querySelector('.msqpay-progress-fill');
    const result = this.dialog.querySelector('.msqpay-progress-result');

    stepItems.forEach((item) => {
      item.classList.add('completed');
      const icon = item.querySelector('.msqpay-progress-step-icon');
      if (icon) icon.textContent = '✓';
    });

    if (progressFill) progressFill.style.width = '100%';

    if (result) {
      const explorerUrl = this.getExplorerTxUrl(txHash);
      const txLinkHtml = explorerUrl
        ? `<br><a href="${this.escapeHtml(explorerUrl)}" target="_blank" rel="noopener noreferrer" class="msqpay-progress-tx-link">View transaction</a>`
        : '';
      result.className = 'msqpay-progress-result success';
      result.innerHTML = `<strong>Payment Successful!</strong><br>Transaction confirmed${txLinkHtml}`;
      result.style.display = 'block';
    }
  }

  showError(message) {
    if (!this.dialog) return;

    const result = this.dialog.querySelector('.msqpay-progress-result');
    if (result) {
      result.className = 'msqpay-progress-result error';
      result.innerHTML = '<strong>Payment Failed</strong><br>' + this.escapeHtml(message);
      result.style.display = 'block';
    }
  }

  getExplorerTxUrl(txHash) {
    if (!this.networkId || !txHash || !this.isValidTxHash(txHash)) {
      return null;
    }
    const explorer = BLOCK_EXPLORERS[this.networkId];
    if (!explorer) {
      return null;
    }
    return `${explorer}/tx/${txHash}`;
  }

  isValidTxHash(hash) {
    return typeof hash === 'string' && /^0x[a-fA-F0-9]{64}$/.test(hash);
  }

  escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  injectStyles() {
    if (document.getElementById('msqpay-progress-styles')) return;

    const style = document.createElement('style');
    style.id = 'msqpay-progress-styles';
    style.textContent = `
      .msqpay-progress-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
      }
      .msqpay-progress-dialog {
        background: #1a1a2e;
        border-radius: 12px;
        width: 400px;
        max-width: 90%;
        color: #fff;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        overflow: hidden;
      }
      .msqpay-progress-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid #333;
      }
      .msqpay-progress-header h3 {
        margin: 0;
        font-size: 18px;
      }
      .msqpay-progress-close {
        background: none;
        border: none;
        color: #888;
        font-size: 24px;
        cursor: pointer;
        padding: 0;
        line-height: 1;
        margin-right: -8px;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .msqpay-progress-close:hover {
        color: #fff;
      }
      .msqpay-progress-body {
        padding: 20px;
        max-height: 80vh;
        overflow-y: auto;
      }
      .msqpay-progress-info {
        text-align: center;
        margin-bottom: 20px;
      }
      .msqpay-progress-amount {
        font-size: 28px;
        font-weight: bold;
        color: #4ade80;
      }
      .msqpay-progress-bar-container {
        margin-bottom: 20px;
      }
      .msqpay-progress-bar {
        height: 8px;
        background: #333;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 10px;
      }
      .msqpay-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #3b82f6, #8b5cf6);
        border-radius: 4px;
        transition: width 0.3s ease;
      }
      .msqpay-progress-step-info {
        display: flex;
        justify-content: space-between;
        font-size: 14px;
        color: #888;
      }
      .msqpay-progress-steps {
        margin-bottom: 15px;
      }
      .msqpay-progress-step-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 0;
        font-size: 14px;
        color: #666;
      }
      .msqpay-progress-step-item.active {
        color: #fff;
      }
      .msqpay-progress-step-item.completed {
        color: #4ade80;
      }
      .msqpay-progress-step-item.completed .msqpay-progress-step-icon {
        color: #4ade80;
      }
      .msqpay-progress-tx-hash {
        text-align: center;
        margin-top: 15px;
        padding-top: 15px;
        border-top: 1px solid #333;
      }
      .msqpay-progress-tx-link {
        color: #3b82f6;
        text-decoration: none;
        word-break: break-all;
      }
      .msqpay-progress-result {
        text-align: center;
        padding: 20px;
        margin-top: 15px;
        border-radius: 8px;
        word-wrap: break-word;
        overflow-wrap: break-word;
        word-break: break-word;
        max-width: 100%;
        overflow: hidden;
      }
      .msqpay-progress-result.success {
        background: rgba(74, 222, 128, 0.1);
        color: #4ade80;
      }
      .msqpay-progress-result.error {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
        font-size: 13px;
        line-height: 1.5;
      }
    `;

    document.head.appendChild(style);
  }
}
