import type { PaymentRequest, RedirectMode } from '../types';
import { isMobile, lockBodyScroll } from './dom';

export interface WidgetLauncherConfig {
  publicKey: string;
  widgetUrl: string;
  debug?: boolean;
}

/** Widget launcher for opening payment widget */
export class WidgetLauncher {
  private publicKey: string;
  private widgetUrl: string;
  private debug: boolean;
  private iframeElement: HTMLIFrameElement | null = null;
  private modalOverlay: HTMLElement | null = null;
  private unlockScroll: (() => void) | null = null;
  private onClose?: () => void;

  constructor(config: WidgetLauncherConfig) {
    this.publicKey = config.publicKey;
    this.widgetUrl = config.widgetUrl;
    this.debug = config.debug ?? false;
  }

  private log(...args: unknown[]): void {
    if (this.debug) {
      console.log('[SoloPay]', ...args);
    }
  }

  /** Build widget URL with payment parameters */
  buildWidgetUrl(request: PaymentRequest): string {
    const params = new URLSearchParams({
      pk: this.publicKey,
      orderId: request.orderId,
      amount: String(request.amount),
      tokenAddress: request.tokenAddress,
      successUrl: request.successUrl,
      failUrl: request.failUrl,
    });

    if (request.webhookUrl) {
      params.set('webhookUrl', request.webhookUrl);
    }

    const url = `${this.widgetUrl}?${params.toString()}`;
    this.log('Built widget URL:', url);
    return url;
  }

  /** Resolve 'auto' mode to actual mode based on device */
  private resolveMode(mode: RedirectMode): 'redirect' | 'iframe' {
    if (mode === 'auto') {
      return isMobile() ? 'redirect' : 'iframe';
    }
    return mode;
  }

  /** Open widget in specified mode */
  open(
    request: PaymentRequest,
    mode: RedirectMode = 'auto',
    options?: {
      iframeContainer?: HTMLElement;
      onClose?: () => void;
    }
  ): void {
    const url = this.buildWidgetUrl(request);
    const resolvedMode = this.resolveMode(mode);

    this.log('Opening widget in mode:', resolvedMode, '(requested:', mode, ')');
    this.onClose = options?.onClose;

    switch (resolvedMode) {
      case 'redirect':
        this.openRedirect(url);
        break;
      case 'iframe':
        if (options?.iframeContainer) {
          this.openIframeInContainer(url, options.iframeContainer);
        } else {
          this.openIframeModal(url);
        }
        break;
    }
  }

  /** Redirect to widget URL */
  private openRedirect(url: string): void {
    this.log('Redirecting to widget:', url);
    window.location.href = url;
  }

  /** Open widget in iframe modal (for PC) */
  private openIframeModal(url: string): void {
    this.log('Opening iframe modal:', url);

    // Close existing modal if any
    this.closeIframe();

    // Lock body scroll
    this.unlockScroll = lockBodyScroll();

    // Create modal overlay
    this.modalOverlay = document.createElement('div');
    this.modalOverlay.id = 'solopay-modal-overlay';
    this.modalOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.2s ease;
    `;

    // Create modal container
    const modalContainer = document.createElement('div');
    modalContainer.style.cssText = `
      background: white;
      border-radius: 16px;
      width: 100%;
      max-width: 624px;
      height: 90vh;
      max-height: 700px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      transform: scale(0.95);
      transition: transform 0.2s ease;
    `;

    // Create close button
    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
      position: absolute;
      top: 12px;
      right: 12px;
      width: 32px;
      height: 32px;
      border: none;
      background: rgba(0, 0, 0, 0.1);
      border-radius: 50%;
      font-size: 20px;
      cursor: pointer;
      z-index: 10;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #666;
      transition: background 0.2s;
    `;
    closeButton.onmouseenter = () => {
      closeButton.style.background = 'rgba(0, 0, 0, 0.2)';
    };
    closeButton.onmouseleave = () => {
      closeButton.style.background = 'rgba(0, 0, 0, 0.1)';
    };
    closeButton.onclick = () => {
      this.closeIframe();
      this.handleClose();
    };

    // Create iframe
    this.iframeElement = document.createElement('iframe');
    this.iframeElement.src = url;
    this.iframeElement.id = 'solopay-widget-iframe';
    this.iframeElement.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
    `;

    // Assemble modal
    modalContainer.appendChild(closeButton);
    modalContainer.appendChild(this.iframeElement);
    this.modalOverlay.appendChild(modalContainer);
    document.body.appendChild(this.modalOverlay);

    // Handle escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        this.closeIframe();
        this.handleClose();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);

    // Animate in
    requestAnimationFrame(() => {
      if (this.modalOverlay) {
        this.modalOverlay.style.opacity = '1';
        const container = this.modalOverlay.firstChild as HTMLElement;
        if (container) {
          container.style.transform = 'scale(1)';
        }
      }
    });
  }

  /** Open widget in iframe inside a container */
  private openIframeInContainer(url: string, container: HTMLElement): void {
    this.log('Opening iframe in container:', url);

    // Remove existing iframe if any
    this.closeIframe();

    this.iframeElement = document.createElement('iframe');
    this.iframeElement.src = url;
    this.iframeElement.id = 'solopay-widget-iframe';
    this.iframeElement.style.cssText = `
      width: 100%;
      height: 100%;
      min-height: 600px;
      border: none;
      border-radius: 12px;
    `;

    container.appendChild(this.iframeElement);
  }

  /** Handle widget close */
  private handleClose(): void {
    this.log('Widget closed');
    this.onClose?.();
    this.onClose = undefined;
  }

  /** Close iframe/modal */
  closeIframe(): void {
    // Animate out
    if (this.modalOverlay) {
      this.modalOverlay.style.opacity = '0';
      const container = this.modalOverlay.firstChild as HTMLElement;
      if (container) {
        container.style.transform = 'scale(0.95)';
      }

      setTimeout(() => {
        this.modalOverlay?.remove();
        this.modalOverlay = null;
      }, 200);
    }

    if (this.iframeElement) {
      this.iframeElement.remove();
      this.iframeElement = null;
    }

    // Unlock scroll
    this.unlockScroll?.();
    this.unlockScroll = null;
  }

  /** Close all open widgets */
  closeAll(): void {
    this.closeIframe();
  }
}
