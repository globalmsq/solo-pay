/**
 * Wallet Selector UI Component - Clean and Modern
 */

export class WalletSelector {
  /**
   * Show wallet selector dialog
   */
  static show(wallets) {
    return new Promise((resolve, reject) => {
      // Remove existing dialog
      const existing = document.getElementById('msqpay-wallet-selector');
      if (existing) existing.remove();

      // Create overlay
      const overlay = document.createElement('div');
      overlay.id = 'msqpay-wallet-selector';
      overlay.className = 'msqpay-wallet-selector-overlay';

      // Create dialog
      const dialog = document.createElement('div');
      dialog.className = 'msqpay-wallet-selector-dialog';

      // Header
      const header = document.createElement('div');
      header.className = 'msqpay-wallet-selector-header';
      header.innerHTML = `
        <h3>Select a wallet to connect</h3>
        <button class="msqpay-wallet-selector-close" aria-label="Close">&times;</button>
      `;

      // Wallet list
      const walletList = document.createElement('div');
      walletList.className = 'msqpay-wallet-selector-list';

      wallets.forEach((wallet) => {
        const walletButton = document.createElement('button');
        walletButton.className = 'msqpay-wallet-selector-item';
        walletButton.setAttribute('data-wallet-type', wallet.type);
        walletButton.innerHTML = `
          <img src="${wallet.icon}" alt="${wallet.name}" class="msqpay-wallet-selector-icon" onerror="this.style.display='none'">
          <span class="msqpay-wallet-selector-name">${this.escapeHtml(wallet.name)}</span>
          <svg class="msqpay-wallet-selector-arrow" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M7.5 15L12.5 10L7.5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        `;

        walletButton.addEventListener('click', () => {
          overlay.remove();
          resolve(wallet.type);
        });

        walletList.appendChild(walletButton);
      });

      // Assemble dialog
      dialog.appendChild(header);
      dialog.appendChild(walletList);
      overlay.appendChild(dialog);

      // Close handlers
      const closeBtn = header.querySelector('.msqpay-wallet-selector-close');
      closeBtn.addEventListener('click', () => {
        overlay.remove();
        reject(new Error('Wallet selection cancelled'));
      });

      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
          reject(new Error('Wallet selection cancelled'));
        }
      });

      // Inject styles
      this.injectStyles();

      // Append to body
      document.body.appendChild(overlay);

      // Animate in
      requestAnimationFrame(() => {
        overlay.classList.add('msqpay-wallet-selector-show');
      });
    });
  }

  /**
   * Inject CSS styles
   */
  static injectStyles() {
    if (document.getElementById('msqpay-wallet-selector-styles')) return;

    const style = document.createElement('style');
    style.id = 'msqpay-wallet-selector-styles';
    style.textContent = `
      .msqpay-wallet-selector-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.6);
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 999999;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      
      .msqpay-wallet-selector-overlay.msqpay-wallet-selector-show {
        opacity: 1;
      }
      
      .msqpay-wallet-selector-dialog {
        background: #ffffff;
        border-radius: 16px;
        width: 90%;
        max-width: 400px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        transform: scale(0.95);
        transition: transform 0.2s ease;
        overflow: hidden;
      }
      
      .msqpay-wallet-selector-overlay.msqpay-wallet-selector-show .msqpay-wallet-selector-dialog {
        transform: scale(1);
      }
      
      .msqpay-wallet-selector-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 24px;
        border-bottom: 1px solid #e5e7eb;
      }
      
      .msqpay-wallet-selector-header h3 {
        margin: 0;
        font-size: 20px;
        font-weight: 600;
        color: #111827;
      }
      
      .msqpay-wallet-selector-close {
        background: none;
        border: none;
        font-size: 28px;
        color: #6b7280;
        cursor: pointer;
        padding: 0;
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 8px;
        transition: all 0.2s;
      }
      
      .msqpay-wallet-selector-close:hover {
        background: #f3f4f6;
        color: #111827;
      }
      
      .msqpay-wallet-selector-list {
        padding: 8px;
      }
      
      .msqpay-wallet-selector-item {
        width: 100%;
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 16px;
        border: none;
        background: transparent;
        border-radius: 12px;
        cursor: pointer;
        transition: all 0.2s;
        text-align: left;
      }
      
      .msqpay-wallet-selector-item:hover {
        background: #f9fafb;
      }
      
      .msqpay-wallet-selector-item:active {
        transform: scale(0.98);
      }
      
      .msqpay-wallet-selector-icon {
        width: 40px;
        height: 40px;
        border-radius: 8px;
        object-fit: contain;
      }
      
      .msqpay-wallet-selector-name {
        flex: 1;
        font-size: 16px;
        font-weight: 500;
        color: #111827;
      }
      
      .msqpay-wallet-selector-arrow {
        color: #9ca3af;
        flex-shrink: 0;
      }
      
      .msqpay-wallet-selector-item:hover .msqpay-wallet-selector-arrow {
        color: #111827;
      }
    `;

    document.head.appendChild(style);
  }

  /**
   * Escape HTML
   */
  static escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
