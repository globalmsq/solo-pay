/**
 * MSQPay Core Class - Clean Implementation
 */

import { WalletDetector } from './wallet-detector';
import { WalletSelector } from './wallet-selector';
import { ProgressDialog } from './progress-dialog';
import {
  WALLET_TYPES,
  ERC20_ABI,
  PAYMENT_GATEWAY_ABI,
  FORWARDER_ABI,
  PAYMENT_STEPS,
  GASLESS_STEPS,
  WalletType,
  TIMING,
  DEFAULTS,
  ERROR_CODES,
} from './constants';
import type {
  MSQPayConfig,
  PaymentMethod,
  Payment,
  ConnectOptions,
  ConnectResult,
  CreatePaymentOptions,
  CreateGaslessPaymentOptions,
  PaymentResult,
  ForwardRequest,
  RelayResponse,
  RelayResult,
  NetworkConfig,
  Token,
  EIP1193Provider,
  EthersProvider,
  EthersSigner,
} from './types';
import {
  WalletConnectionError,
  WalletNotFoundError,
  PaymentError,
  NetworkError,
  APIError,
} from './errors';

export class MSQPay {
  config: MSQPayConfig;
  walletDetector: WalletDetector;
  provider: EthersProvider | null;
  signer: EthersSigner | null;
  connectedAddress: string | null;
  currentChainId: number | null;
  currentWalletType: WalletType | null;
  merchantNetworkId: number | null;
  paymentMethods: PaymentMethod[];
  merchantKey: string | null;
  // MetaMaskSDK instance - CDN-loaded, type unavailable
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mmsdk: any;
  ethers: typeof ethers | null;

  constructor(config: MSQPayConfig = {}) {
    this.config = config;
    this.walletDetector = new WalletDetector();

    // State
    this.provider = null;
    this.signer = null;
    this.connectedAddress = null;
    this.currentChainId = null;
    this.currentWalletType = null;
    this.merchantNetworkId = null;
    this.paymentMethods = [];
    this.merchantKey = null;
    this.mmsdk = null;

    // Get ethers from global scope (loaded via CDN or external)
    this.ethers = typeof ethers !== 'undefined' ? ethers : null;
    if (!this.ethers) {
      throw new WalletConnectionError(
        'ethers.js is required. Please load it before MSQPay.',
        'ETHERS_NOT_LOADED'
      );
    }
  }

  /**
   * Initialize MSQPay SDK
   *
   * @param config - Configuration options for MSQPay
   * @throws {APIError} If API connection fails
   * @example
   * ```typescript
   * await msqpay.init({
   *   apiUrl: 'https://api.example.com',
   *   apiKey: 'your-api-key',
   *   infuraAPIKey: 'your-infura-key'
   * });
   * ```
   */
  async init(config: MSQPayConfig = {}): Promise<void> {
    this.config = { ...this.config, ...config };

    // Initialize MetaMask SDK for mobile support (like msqpay.js)
    // SDK will show browser/mobile dialog when eth_requestAccounts is called
    // Handle different ways MetaMaskSDK might be exposed (CDN bundles vary)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let MetaMaskSDKClass: any = null; // CDN bundle exposes SDK in different ways
    if (typeof window !== 'undefined') {
      // Try different ways the SDK might be exposed
      if (window.MetaMaskSDK) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const wmmsdk = window.MetaMaskSDK as any;
        MetaMaskSDKClass = wmmsdk.MetaMaskSDK || wmmsdk.default || window.MetaMaskSDK;
      } else if (typeof MetaMaskSDK !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const metaMaskSDK = MetaMaskSDK as any;
        MetaMaskSDKClass = metaMaskSDK.MetaMaskSDK || metaMaskSDK.default || MetaMaskSDK;
      }
    }

    if (MetaMaskSDKClass) {
      try {
        this.mmsdk = new MetaMaskSDKClass({
          dappMetadata: {
            name: config.dappName || DEFAULTS.DAPP_NAME,
            url: typeof window !== 'undefined' ? window.location.origin : '',
          },
          infuraAPIKey: config.infuraAPIKey,
          checkInstallationImmediately: false,
          useDeeplink: true,
          communicationLayerPreference: 'socket',
          openDeeplink: (link: string) => {
            if (
              typeof window !== 'undefined' &&
              /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
            ) {
              window.location.href = link;
            } else if (typeof window !== 'undefined') {
              window.open(link, '_self');
            }
          },
        });

        if (this.mmsdk) {
          await this.mmsdk.init();

          const sdkProvider = this.mmsdk.getProvider();
          if (sdkProvider) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sdkProvider.on('connect', (info: any) => {
              this.currentChainId = parseInt(info.chainId, 16);
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new CustomEvent('msqpay:sdkConnected', { detail: info }));
              }
            });
          }
        }
      } catch {
        // Continue without SDK - extension will still work
        // Silent fail - SDK is optional for extension-only usage
      }
    }

    // Fetch merchant info and payment methods
    await Promise.all([this.fetchMerchantInfo(), this.fetchPaymentMethods()]);

    // Auto-reconnect if wallet was previously connected (after page refresh)
    await this.autoReconnect();
  }

  /**
   * Auto-reconnect to wallet if already connected (after page refresh)
   * Uses eth_accounts (no prompt) to check if wallet is still connected
   */
  async autoReconnect() {
    try {
      const availableWallets = this.walletDetector.getAvailableWallets();
      if (availableWallets.length === 0) {
        return; // No wallets available
      }

      // Try to detect which wallet was previously connected
      // Check MetaMask first (most common)
      let ethereum = null;
      let walletType = null;

      // Try MetaMask
      if (this.walletDetector.isMetaMaskAvailable()) {
        this.walletDetector.mmsdk = this.mmsdk;
        ethereum = this.walletDetector.getProviderForWallet(WALLET_TYPES.METAMASK);
        if (ethereum) {
          walletType = WALLET_TYPES.METAMASK;
        }
      }

      // Try Trust Wallet if MetaMask not available
      if (!ethereum && this.walletDetector.isTrustWalletAvailable()) {
        ethereum = this.walletDetector.getProviderForWallet(WALLET_TYPES.TRUST);
        if (ethereum) {
          walletType = WALLET_TYPES.TRUST;
        }
      }

      if (!ethereum || !walletType) {
        return; // No wallet provider found
      }

      // Check if wallet is already connected (eth_accounts doesn't prompt)
      const accounts = (await ethereum.request({ method: 'eth_accounts' })) as string[];

      if (!accounts || accounts.length === 0) {
        return; // Wallet not connected
      }

      // Get chain ID
      const chainIdHex = (await ethereum.request({ method: 'eth_chainId' })) as string;
      this.currentChainId = parseInt(chainIdHex, 16);

      // Switch network if needed
      if (this.merchantNetworkId && this.currentChainId !== this.merchantNetworkId) {
        try {
          await this.switchNetwork(this.merchantNetworkId);
        } catch {
          // Network switch failed, continue anyway
        }
      }

      // Setup provider and signer
      if (ethereum && this.ethers) {
        this.provider = new this.ethers.BrowserProvider(ethereum);
        this.signer = await this.provider.getSigner();
      }
      this.connectedAddress = accounts[0] as string;
      this.currentWalletType = walletType;

      // Setup event listeners
      ethereum.on('accountsChanged', this.handleAccountsChanged.bind(this));
      ethereum.on('chainChanged', this.handleChainChanged.bind(this));

      // Dispatch connected event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('msqpay:connected', {
            detail: {
              address: this.connectedAddress,
              chainId: this.currentChainId,
              walletType: this.currentWalletType,
            },
          })
        );
      }
    } catch {
      // Silent fail - auto-reconnect is optional
      // User can manually connect if auto-reconnect fails
    }
  }

  /**
   * Connect wallet
   */
  async connect(options: ConnectOptions = {}): Promise<ConnectResult> {
    const { walletType, showSelector = true } = options;

    const availableWallets = this.walletDetector.getAvailableWallets();

    if (availableWallets.length === 0) {
      throw new WalletNotFoundError();
    }

    let selectedWalletType = walletType;

    // Show selector if multiple wallets and no wallet type specified
    if (!selectedWalletType && availableWallets.length > 1 && showSelector) {
      selectedWalletType = (await WalletSelector.show(availableWallets)) as WalletType;
    } else if (!selectedWalletType) {
      selectedWalletType = availableWallets[0].type;
    }

    if (!selectedWalletType) {
      throw new WalletConnectionError('No wallet selected', 'NO_WALLET_SELECTED');
    }

    // Update wallet detector's mmsdk reference
    this.walletDetector.mmsdk = this.mmsdk;

    // Get provider
    const ethereum = this.walletDetector.getProviderForWallet(
      selectedWalletType
    ) as EIP1193Provider | null;
    if (!ethereum) {
      throw new WalletNotFoundError(selectedWalletType);
    }

    // Request accounts
    let accounts: string[];
    try {
      accounts = (await ethereum.request({ method: 'eth_requestAccounts' })) as string[];
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      if (err?.code === ERROR_CODES.WALLET_REQUEST_PENDING) {
        await new Promise((resolve) => setTimeout(resolve, TIMING.WALLET_REQUEST_RETRY_DELAY));
        accounts = (await ethereum.request({ method: 'eth_accounts' })) as string[];
        if (!accounts || accounts.length === 0) {
          throw new WalletConnectionError('Please approve the connection request in your wallet');
        }
      } else if (err?.code === ERROR_CODES.USER_REJECTED) {
        throw new WalletConnectionError('Connection rejected by user.', ERROR_CODES.USER_REJECTED);
      } else {
        throw new WalletConnectionError(err?.message || 'Failed to connect wallet', err?.code);
      }
    }

    if (!accounts || (accounts as string[]).length === 0) {
      throw new WalletConnectionError('No accounts found. Please unlock your wallet.');
    }

    // Get chain ID
    const chainIdHex = (await ethereum.request({ method: 'eth_chainId' })) as string;
    this.currentChainId = parseInt(chainIdHex, 16);

    // Switch network if needed
    if (this.merchantNetworkId && this.currentChainId !== this.merchantNetworkId) {
      await this.switchNetwork(this.merchantNetworkId);
    }

    // Setup provider and signer
    if (!ethereum || !this.ethers) {
      throw new WalletConnectionError('Wallet provider not available');
    }
    this.provider = new this.ethers.BrowserProvider(ethereum);
    this.signer = await this.provider.getSigner();
    this.connectedAddress = accounts[0] as string;
    this.currentWalletType = selectedWalletType;

    // Setup event listeners
    ethereum.on('accountsChanged', this.handleAccountsChanged.bind(this));
    ethereum.on('chainChanged', this.handleChainChanged.bind(this));

    if (!this.connectedAddress || this.currentChainId === null || !this.currentWalletType) {
      throw new WalletConnectionError('Failed to connect wallet');
    }

    return {
      address: this.connectedAddress,
      chainId: this.currentChainId,
      walletType: this.currentWalletType,
    };
  }

  /**
   * Disconnect from the connected wallet
   * Revokes permissions and removes event listeners
   *
   * @example
   * ```typescript
   * await msqpay.disconnect();
   * ```
   */
  async disconnect(): Promise<void> {
    if (!this.currentWalletType) {
      return;
    }
    const ethereum = this.walletDetector.getProviderForWallet(this.currentWalletType);

    if (ethereum) {
      // Try to revoke permissions (EIP-2255) to disconnect from MetaMask extension
      try {
        if (ethereum.request && typeof ethereum.request === 'function') {
          await ethereum.request({
            method: 'wallet_revokePermissions',
            params: [{ eth_accounts: {} }],
          });
        }
      } catch {
        // Method might not be supported, continue with cleanup
      }

      // Remove event listeners
      ethereum.removeListener('accountsChanged', this.handleAccountsChanged);
      ethereum.removeListener('chainChanged', this.handleChainChanged);
    }

    // Clear state
    this.provider = null;
    this.signer = null;
    this.connectedAddress = null;
    this.currentChainId = null;
    this.currentWalletType = null;

    // Dispatch disconnect event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('msqpay:disconnected'));
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return !!this.connectedAddress && !!this.signer;
  }

  /**
   * Get available wallets
   */
  getAvailableWallets() {
    return this.walletDetector.getAvailableWallets();
  }

  /**
   * Fetch merchant info
   */
  async fetchMerchantInfo(): Promise<void> {
    if (!this.config.apiUrl || !this.config.apiKey) {
      return;
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/merchants/me`, {
        headers: {
          'x-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      // API returns: { success: true, merchant: { merchant_key, chain: { network_id } } }
      if (data.success && data.merchant) {
        this.merchantKey = data.merchant.merchant_key;
        if (data.merchant.chain?.network_id) {
          this.merchantNetworkId = data.merchant.chain.network_id;
        }
      } else if (data.merchant) {
        this.merchantKey = data.merchant.merchant_key;
        if (data.merchant.chain?.network_id) {
          this.merchantNetworkId = data.merchant.chain.network_id;
        }
      } else if (data.merchant_key) {
        // Fallback: direct merchant_key in response
        this.merchantKey = data.merchant_key;
      }
    } catch (error: unknown) {
      console.warn('MSQPay: Failed to fetch merchant info. Please check API URL and key.', error);
      // Silent fail - not critical for initialization
    }
  }

  /**
   * Fetch payment methods
   */
  async fetchPaymentMethods() {
    if (!this.config.apiUrl || !this.config.apiKey) {
      this.paymentMethods = [];
      return;
    }

    try {
      const response = await fetch(`${this.config.apiUrl}/merchants/me/payment-methods`, {
        headers: {
          'x-api-key': this.config.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        this.paymentMethods = [];
        return;
      }

      const data = await response.json();

      // API returns: { success: true, payment_methods: [...] }
      // Handle different response formats
      let paymentMethods = [];
      if (data.success && data.payment_methods) {
        paymentMethods = Array.isArray(data.payment_methods) ? data.payment_methods : [];
      } else if (data.payment_methods) {
        paymentMethods = Array.isArray(data.payment_methods) ? data.payment_methods : [];
      } else if (data.paymentMethods) {
        paymentMethods = Array.isArray(data.paymentMethods) ? data.paymentMethods : [];
      } else if (Array.isArray(data.data)) {
        paymentMethods = data.data;
      } else if (Array.isArray(data)) {
        paymentMethods = data;
      }

      this.paymentMethods = paymentMethods;

      if (this.paymentMethods.length > 0) {
        // Set merchant network ID from first payment method
        const firstChain = this.paymentMethods[0].chain;
        if (firstChain) {
          this.merchantNetworkId =
            firstChain.network_id ||
            firstChain.networkId ||
            firstChain.chain_id ||
            firstChain.chainId ||
            this.merchantNetworkId;
        }
      }
    } catch (error: unknown) {
      console.warn('MSQPay: Failed to fetch payment methods. Please check API URL and key.', error);
      this.paymentMethods = [];
    }
  }

  /**
   * Switch wallet to specified network
   *
   * @param networkId - Chain ID to switch to
   * @throws {WalletConnectionError} If wallet not connected
   * @throws {NetworkError} If network is not supported
   */
  async switchNetwork(networkId: number): Promise<void> {
    if (!this.currentWalletType) {
      throw new WalletConnectionError('Wallet not connected', 'WALLET_NOT_CONNECTED');
    }
    const ethereum = this.walletDetector.getProviderForWallet(this.currentWalletType);
    if (!ethereum) {
      throw new WalletConnectionError('Wallet not connected', 'WALLET_NOT_CONNECTED');
    }

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${networkId.toString(16)}` }],
      });
    } catch (error: unknown) {
      const err = error as { code?: number; message?: string };
      if (err.code === 4902) {
        // Network not found, add it
        const networkConfig = this.getNetworkConfig(networkId);
        if (!networkConfig) {
          throw new NetworkError(
            `Network ${networkId} is not supported`,
            networkId,
            'UNSUPPORTED_NETWORK'
          );
        }

        await ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [networkConfig],
        });
      } else {
        throw error;
      }
    }

    // Update chain ID
    const chainIdHex = (await ethereum.request({ method: 'eth_chainId' })) as string;
    this.currentChainId = parseInt(chainIdHex, 16);
  }

  /**
   * Get network configuration for specified chain ID
   * Uses infuraAPIKey if provided to avoid rate limiting
   *
   * @param networkId - Chain ID
   * @returns Network configuration or null if not supported
   */
  getNetworkConfig(networkId: number): NetworkConfig | null {
    // Use infuraAPIKey if provided, otherwise use public endpoint (may be rate limited)
    const infuraKey = this.config.infuraAPIKey || '';
    const mainnetRpc = infuraKey
      ? `https://mainnet.infura.io/v3/${infuraKey}`
      : 'https://mainnet.infura.io/v3/';
    const sepoliaRpc = infuraKey
      ? `https://sepolia.infura.io/v3/${infuraKey}`
      : 'https://sepolia.infura.io/v3/';

    const networks: Record<number, NetworkConfig> = {
      1: {
        chainName: 'Ethereum Mainnet',
        rpcUrls: [mainnetRpc],
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        blockExplorerUrls: ['https://etherscan.io'],
      },
      11155111: {
        chainName: 'Sepolia Testnet',
        rpcUrls: [sepoliaRpc],
        nativeCurrency: { name: 'Sepolia ETH', symbol: 'ETH', decimals: 18 },
        blockExplorerUrls: ['https://sepolia.etherscan.io'],
      },
      137: {
        chainName: 'Polygon Mainnet',
        rpcUrls: ['https://polygon-rpc.com'],
        nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
        blockExplorerUrls: ['https://polygonscan.com'],
      },
      80002: {
        chainName: 'Polygon Amoy Testnet',
        rpcUrls: ['https://rpc-amoy.polygon.technology'],
        nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
        blockExplorerUrls: ['https://amoy.polygonscan.com'],
      },
      31337: {
        chainName: 'Localhost',
        rpcUrls: ['http://127.0.0.1:8545'],
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        blockExplorerUrls: [],
      },
    };

    return networks[networkId] || null;
  }

  /**
   * Handle accounts changed
   */
  handleAccountsChanged(accounts: string[]): void {
    if (accounts.length === 0) {
      // User disconnected from wallet extension
      this.disconnect();
    } else if (accounts[0] !== this.connectedAddress) {
      // User switched account
      this.connectedAddress = accounts[0] as string;
      // Update signer with new address
      if (this.provider) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        this.provider.getSigner().then((signer: any) => {
          this.signer = signer;
        });
      }
      // Dispatch account changed event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('msqpay:accountChanged', {
            detail: { address: this.connectedAddress },
          })
        );
      }
    }
  }

  /**
   * Handle chain changed
   */
  handleChainChanged(chainId: string): void {
    this.currentChainId = parseInt(chainId, 16);
    window.location.reload();
  }

  /**
   * Create direct payment (user pays gas)
   *
   * @param options - Payment options
   * @param options.amount - Payment amount
   * @param options.currency - Token symbol (e.g., 'USDT', 'ETH')
   * @param options.showDialog - Show progress dialog (default: true)
   * @returns Payment result with txHash
   * @throws {WalletConnectionError} If wallet not connected
   * @throws {PaymentError} If payment validation or processing fails
   * @example
   * ```typescript
   * const result = await msqpay.createPayment({
   *   amount: 100,
   *   currency: 'USDT'
   * });
   * ```
   */
  async createPayment({
    amount,
    currency,
    showDialog = true,
  }: CreatePaymentOptions): Promise<PaymentResult> {
    let dialog = null;

    try {
      if (!this.isConnected()) {
        throw new WalletConnectionError('Please connect your wallet first', 'WALLET_NOT_CONNECTED');
      }

      const paymentMethod = this.paymentMethods.find((pm) => pm.token?.symbol === currency);
      if (!paymentMethod) {
        const availableTokens = this.paymentMethods
          .map((pm) => pm.token?.symbol)
          .filter(Boolean)
          .join(', ');
        throw new PaymentError(
          `Payment method for ${currency} not found. Available: ${availableTokens || 'none'}`,
          'PAYMENT_METHOD_NOT_FOUND'
        );
      }

      const { token, chain } = paymentMethod;
      if (!token || !chain) {
        throw new PaymentError('Invalid payment method configuration', 'INVALID_PAYMENT_METHOD');
      }

      // Show progress dialog
      if (showDialog) {
        dialog = new ProgressDialog({
          amount,
          currency,
          steps: PAYMENT_STEPS,
          networkId: this.merchantNetworkId ?? undefined,
        });
        dialog.show();
      }

      // Step 1: Validate
      if (dialog) dialog.updateStep(PAYMENT_STEPS.VALIDATING);

      // Validate network
      if (this.merchantNetworkId && this.currentChainId !== this.merchantNetworkId) {
        await this.switchNetwork(this.merchantNetworkId);
      }

      // Check balance
      const balance = await this.getBalance(currency);
      const decimals = token.decimals || 18;
      if (!this.ethers) {
        throw new WalletConnectionError('ethers.js not available', 'ETHERS_NOT_AVAILABLE');
      }
      const balanceWei = this.ethers.parseUnits(balance, decimals);
      const amountWei = this.ethers.parseUnits(String(amount), decimals);

      if (balanceWei < amountWei) {
        throw new PaymentError(
          `Insufficient balance. You have ${balance} ${currency}`,
          'INSUFFICIENT_BALANCE'
        );
      }

      // Step 2: Create payment
      if (dialog) dialog.updateStep(PAYMENT_STEPS.CREATING);
      const payment = await this.requestCreatePayment({ amount, currency });

      if (!payment.gatewayAddress) {
        throw new PaymentError('Gateway address not configured', 'GATEWAY_NOT_CONFIGURED');
      }

      const tokenAddress = payment.tokenAddress || token.address;
      const gatewayAddress = payment.gatewayAddress;
      const recipientAddress = paymentMethod.recipient_address || paymentMethod.recipientAddress;
      const amountInWei = BigInt(payment.amount);
      const paymentId = payment.paymentId;

      // Step 3: Approve token
      if (dialog) dialog.updateStep(PAYMENT_STEPS.APPROVING);
      if (!this.ethers || !this.signer || !this.connectedAddress) {
        throw new WalletConnectionError('Wallet not connected', 'WALLET_NOT_CONNECTED');
      }
      const tokenContract = new this.ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
      const currentAllowance = await tokenContract.allowance(this.connectedAddress, gatewayAddress);

      if (BigInt(currentAllowance) < amountInWei) {
        const approveTx = await tokenContract.approve(gatewayAddress, amountInWei);
        if (dialog) dialog.updateStep(PAYMENT_STEPS.APPROVING, { txHash: approveTx.hash });
        await approveTx.wait();
      }

      // Step 4: Execute payment
      if (dialog) dialog.updateStep(PAYMENT_STEPS.WALLET_CONFIRM);
      if (!this.ethers || !this.signer) {
        throw new WalletConnectionError('Wallet not connected', 'WALLET_NOT_CONNECTED');
      }
      const gatewayContract = new this.ethers.Contract(
        gatewayAddress,
        PAYMENT_GATEWAY_ABI,
        this.signer
      );

      const tx = await gatewayContract.pay(paymentId, tokenAddress, amountInWei, recipientAddress);

      if (dialog) dialog.updateStep(PAYMENT_STEPS.PROCESSING, { txHash: tx.hash });
      await tx.wait();

      // Step 5: Confirm payment
      if (dialog) dialog.updateStep(PAYMENT_STEPS.CONFIRMING);
      await this.pollPaymentStatus(paymentId);

      if (dialog) dialog.showSuccess(tx.hash);

      return {
        success: true,
        payment,
        txHash: tx.hash,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (dialog) dialog.showError(message);
      throw error;
    }
  }

  /**
   * Request create payment
   */
  async requestCreatePayment({
    amount,
    currency,
  }: {
    amount: number | string;
    currency: string;
  }): Promise<Payment> {
    if (!this.config.apiUrl || !this.config.apiKey) {
      throw new APIError('API URL and API key are required', undefined, 'API_CONFIG_MISSING');
    }

    const paymentMethod = this.paymentMethods.find((pm) => pm.token?.symbol === currency);
    if (!paymentMethod) {
      const availableTokens = this.paymentMethods
        .map((pm) => pm.token?.symbol)
        .filter(Boolean)
        .join(', ');
      throw new PaymentError(
        `Payment method for ${currency} not found. Available: ${availableTokens || 'none'}`,
        'PAYMENT_METHOD_NOT_FOUND'
      );
    }

    const { token, chain } = paymentMethod;
    if (!token || !chain) {
      throw new PaymentError('Invalid payment method configuration', 'INVALID_PAYMENT_METHOD');
    }

    const merchantId = this.merchantKey || this.config.merchantId;
    if (!merchantId) {
      throw new APIError(
        'Merchant ID is required. Please ensure merchant info is loaded.',
        undefined,
        'MERCHANT_ID_MISSING'
      );
    }

    // Get chainId from chain object (API returns network_id)
    const chainId = chain.network_id || chain.networkId || chain.chain_id || chain.chainId;
    if (!chainId) {
      throw new PaymentError(
        `Chain ID not found in payment method. Chain object: ${JSON.stringify(chain)}`,
        'CHAIN_ID_MISSING'
      );
    }

    // Get token address
    const tokenAddress = token.address;
    if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      throw new PaymentError(`Invalid token address: ${tokenAddress}`, 'INVALID_TOKEN_ADDRESS');
    }

    // Get recipient address
    const recipientAddress = paymentMethod.recipient_address || paymentMethod.recipientAddress;
    if (!recipientAddress || !/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
      throw new PaymentError(
        `Invalid recipient address: ${recipientAddress || 'missing'}. Payment method: ${JSON.stringify(paymentMethod)}`,
        'INVALID_RECIPIENT_ADDRESS'
      );
    }

    // Validate amount
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new PaymentError(`Invalid amount: ${amount}`);
    }

    const requestBody = {
      merchantId: String(merchantId),
      amount: amountNum,
      chainId: Number(chainId),
      tokenAddress: tokenAddress.toLowerCase(),
      recipientAddress: recipientAddress.toLowerCase(),
    };

    const response = await fetch(`${this.config.apiUrl}/payments/create`, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message || errorData.code || `Failed to create payment: ${response.statusText}`;
      throw new APIError(errorMessage, response.status);
    }

    const data = await response.json();
    return data.payment || data;
  }

  /**
   * Poll payment status
   */
  /**
   * Poll payment status until confirmed or timeout
   *
   * @param paymentId - Payment ID to poll
   * @param maxAttempts - Maximum polling attempts (default: 60)
   * @param interval - Polling interval in milliseconds (default: 3000)
   * @returns Payment status string
   * @throws {PaymentError} If payment fails or times out
   */
  async pollPaymentStatus(
    paymentId: string,
    maxAttempts = TIMING.PAYMENT_STATUS_MAX_ATTEMPTS,
    interval = TIMING.PAYMENT_STATUS_POLL_INTERVAL
  ): Promise<string> {
    // Wait a bit before starting to poll (give server time to process)
    await new Promise((resolve) => setTimeout(resolve, TIMING.PAYMENT_STATUS_POLL_INITIAL_DELAY));

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, interval));

      const status = await this.getPaymentStatus(paymentId);

      if (status === 'CONFIRMED' || status === 'COMPLETED') {
        return status;
      }

      if (status === 'FAILED' || status === 'EXPIRED') {
        throw new PaymentError(`Payment ${status.toLowerCase()}`, status);
      }
    }

    throw new PaymentError('Payment confirmation timeout', 'PAYMENT_TIMEOUT');
  }

  /**
   * Get payment status from API
   *
   * @param paymentId - Payment ID
   * @returns Payment status string
   * @throws {APIError} If API request fails
   */
  async getPaymentStatus(paymentId: string): Promise<string> {
    if (!this.config.apiUrl || !this.config.apiKey) {
      throw new APIError('API URL and API key are required', undefined, 'API_CONFIG_MISSING');
    }

    const response = await fetch(`${this.config.apiUrl}/payments/${paymentId}/status`, {
      headers: {
        'x-api-key': this.config.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new APIError(`Failed to get payment status: ${response.statusText}`, response.status);
    }

    const data = await response.json();
    return data.status || data.data?.status;
  }

  /**
   * Get balance
   */
  /**
   * Get token balance for connected wallet
   *
   * @param currency - Token symbol (e.g., 'USDT', 'ETH')
   * @returns Formatted balance string
   * @throws {WalletConnectionError} If wallet not connected
   * @throws {PaymentError} If payment method not found
   */
  async getBalance(currency: string): Promise<string> {
    if (!this.isConnected()) {
      throw new WalletConnectionError('Please connect your wallet first', 'WALLET_NOT_CONNECTED');
    }

    const paymentMethod = this.paymentMethods.find((pm) => pm.token?.symbol === currency);
    if (!paymentMethod) {
      throw new PaymentError(
        `Payment method for ${currency} not found`,
        'PAYMENT_METHOD_NOT_FOUND'
      );
    }

    if (!paymentMethod.token?.address) {
      throw new PaymentError('Token address not found', 'TOKEN_ADDRESS_MISSING');
    }
    if (!this.ethers || !this.provider || !this.connectedAddress) {
      throw new WalletConnectionError('Wallet not connected', 'WALLET_NOT_CONNECTED');
    }
    const tokenContract = new this.ethers.Contract(
      paymentMethod.token.address,
      ERC20_ABI,
      this.provider
    );

    const balance = await tokenContract.balanceOf(this.connectedAddress);
    const decimals = await tokenContract.decimals();

    return this.ethers.formatUnits(balance, decimals);
  }

  /**
   * Get payment methods
   */
  getPaymentMethods() {
    return this.paymentMethods;
  }

  /**
   * Get supported tokens
   */
  getSupportedTokens(): string[] {
    return this.paymentMethods
      .map((pm) => pm.token?.symbol)
      .filter((symbol): symbol is string => typeof symbol === 'string' && symbol.length > 0);
  }

  /**
   * Get connected address
   */
  getAddress(): string | null {
    return this.connectedAddress;
  }

  /**
   * Get current chain ID
   */
  getChainId() {
    return this.currentChainId;
  }

  /**
   * Get current wallet type
   */
  getWalletType(): WalletType | null {
    return this.currentWalletType;
  }

  /**
   * Get ethers signer instance
   * @returns Ethers signer instance (CDN-loaded, type unavailable)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getSigner(): any {
    return this.signer;
  }

  /**
   * Get ethers provider instance
   * @returns Ethers provider instance (CDN-loaded, type unavailable)
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getProvider(): any {
    return this.provider;
  }

  /**
   * Check if connected to merchant's network
   */
  isCorrectNetwork() {
    return this.merchantNetworkId && this.currentChainId === this.merchantNetworkId;
  }

  /**
   * Ensure wallet is connected to merchant's network, switch if needed
   */
  async ensureCorrectNetwork(): Promise<void> {
    if (!this.merchantNetworkId) {
      throw new NetworkError(
        'Merchant network not configured',
        undefined,
        'NETWORK_NOT_CONFIGURED'
      );
    }
    if (!this.isCorrectNetwork()) {
      await this.switchNetwork(this.merchantNetworkId);
    }
  }

  /**
   * Get token info by symbol
   */
  getTokenBySymbol(symbol: string): Token | null {
    const method = this.paymentMethods.find((pm) => pm.token?.symbol === symbol);
    return method?.token || null;
  }

  /**
   * Get merchant network ID
   */
  getMerchantNetworkId(): number | null {
    return this.merchantNetworkId;
  }

  /**
   * Check if any wallet is available
   */
  isWalletAvailable() {
    return this.walletDetector.getAvailableWallets().length > 0;
  }

  /**
   * Check if MetaMask is available
   */
  isMetaMaskAvailable(): boolean {
    return this.walletDetector.isMetaMaskAvailable();
  }

  /**
   * Check if Trust Wallet is available
   */
  isTrustWalletAvailable() {
    return this.walletDetector.isTrustWalletAvailable();
  }

  /**
   * Show wallet selector dialog
   *
   * @returns Selected wallet type
   * @throws {WalletNotFoundError} If no wallets available
   */
  async showWalletSelector(): Promise<string> {
    const wallets = this.walletDetector.getAvailableWallets();
    if (wallets.length === 0) {
      throw new WalletNotFoundError();
    }
    if (wallets.length === 1) {
      return wallets[0].type;
    }
    return await WalletSelector.show(wallets);
  }

  /**
   * Create gasless payment (meta-transaction - relayer pays gas)
   *
   * @param options - Payment options
   * @param options.amount - Payment amount
   * @param options.currency - Token symbol (e.g., 'USDT', 'ETH')
   * @param options.showDialog - Show progress dialog (default: true)
   * @param options.deadline - Custom deadline in seconds (overrides config.gaslessDeadline)
   * @param options.gasLimit - Custom gas limit (overrides config.gaslessGasLimit)
   * @returns Payment result with txHash and relayRequestId
   * @throws {WalletConnectionError} If wallet not connected
   * @throws {PaymentError} If payment validation or processing fails
   * @example
   * ```typescript
   * const result = await msqpay.createGaslessPayment({
   *   amount: 100,
   *   currency: 'USDT',
   *   deadline: 900 // 15 minutes
   * });
   * ```
   */
  async createGaslessPayment({
    amount,
    currency,
    showDialog = true,
    deadline,
    gasLimit,
  }: CreateGaslessPaymentOptions): Promise<PaymentResult> {
    let dialog = null;

    try {
      if (!this.isConnected()) {
        throw new WalletConnectionError('Please connect your wallet first', 'WALLET_NOT_CONNECTED');
      }

      const paymentMethod = this.paymentMethods.find((pm) => pm.token?.symbol === currency);
      if (!paymentMethod) {
        const availableTokens = this.paymentMethods
          .map((pm) => pm.token?.symbol)
          .filter(Boolean)
          .join(', ');
        throw new PaymentError(
          `Payment method for ${currency} not found. Available: ${availableTokens || 'none'}`,
          'PAYMENT_METHOD_NOT_FOUND'
        );
      }

      const { token, chain } = paymentMethod;
      if (!token || !chain) {
        throw new PaymentError('Invalid payment method configuration', 'INVALID_PAYMENT_METHOD');
      }

      // Show progress dialog
      if (showDialog) {
        dialog = new ProgressDialog({
          amount,
          currency,
          steps: GASLESS_STEPS,
          networkId: this.merchantNetworkId ?? undefined,
        });
        dialog.show();
      }

      // Step 1: Validate
      if (dialog) dialog.updateStep(GASLESS_STEPS.VALIDATING);

      // Validate network
      if (this.merchantNetworkId && this.currentChainId !== this.merchantNetworkId) {
        await this.switchNetwork(this.merchantNetworkId);
      }

      // Check balance
      const balance = await this.getBalance(currency);
      const decimals = token.decimals || 18;
      if (!this.ethers) {
        throw new WalletConnectionError('ethers.js not available', 'ETHERS_NOT_AVAILABLE');
      }
      const balanceWei = this.ethers.parseUnits(balance, decimals);
      const amountWei = this.ethers.parseUnits(String(amount), decimals);

      if (balanceWei < amountWei) {
        throw new PaymentError(
          `Insufficient balance. You have ${balance} ${currency}`,
          'INSUFFICIENT_BALANCE'
        );
      }

      // Step 2: Create payment
      if (dialog) dialog.updateStep(GASLESS_STEPS.CREATING);
      const payment = await this.requestCreatePayment({ amount, currency });

      if (!payment.gatewayAddress) {
        throw new PaymentError('Gateway address not configured', 'GATEWAY_NOT_CONFIGURED');
      }
      if (!payment.forwarderAddress) {
        throw new PaymentError(
          'Forwarder address not configured. Gasless payments may not be supported.',
          'FORWARDER_NOT_CONFIGURED'
        );
      }

      const tokenAddress = payment.tokenAddress || token.address;
      const gatewayAddress = payment.gatewayAddress;
      const forwarderAddress = payment.forwarderAddress;
      const recipientAddress = paymentMethod.recipient_address || paymentMethod.recipientAddress;
      const amountInWei = BigInt(payment.amount);
      const paymentId = payment.paymentId;

      // Step 3: Approve token
      if (dialog) dialog.updateStep(GASLESS_STEPS.APPROVING);
      if (!this.ethers || !this.signer || !this.connectedAddress) {
        throw new WalletConnectionError('Wallet not connected', 'WALLET_NOT_CONNECTED');
      }
      const tokenContract = new this.ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
      const currentAllowance = await tokenContract.allowance(this.connectedAddress, gatewayAddress);

      if (BigInt(currentAllowance) < amountInWei) {
        const approveTx = await tokenContract.approve(gatewayAddress, amountInWei);
        if (dialog) dialog.updateStep(GASLESS_STEPS.APPROVING, { txHash: approveTx.hash });
        await approveTx.wait();
      }

      // Step 4: Sign EIP-712
      if (dialog) dialog.updateStep(GASLESS_STEPS.SIGNING);

      if (!this.ethers || !this.provider || !this.connectedAddress) {
        throw new WalletConnectionError('Wallet not connected', 'WALLET_NOT_CONNECTED');
      }
      const forwarderContract = new this.ethers.Contract(
        forwarderAddress,
        FORWARDER_ABI,
        this.provider
      );
      const nonce = await forwarderContract.nonces(this.connectedAddress);

      const gatewayInterface = new this.ethers.Interface(PAYMENT_GATEWAY_ABI);
      const payCallData = gatewayInterface.encodeFunctionData('pay', [
        paymentId,
        tokenAddress,
        amountInWei,
        recipientAddress,
      ]);

      if (!this.merchantNetworkId) {
        throw new NetworkError(
          'Merchant network ID not configured',
          undefined,
          'NETWORK_NOT_CONFIGURED'
        );
      }
      const domain = {
        name: 'MSQForwarder',
        version: '1',
        chainId: this.merchantNetworkId,
        verifyingContract: forwarderAddress,
      };

      const types = {
        ForwardRequest: [
          { name: 'from', type: 'address' },
          { name: 'to', type: 'address' },
          { name: 'value', type: 'uint256' },
          { name: 'gas', type: 'uint256' },
          { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint48' },
          { name: 'data', type: 'bytes' },
        ],
      };

      // Use custom deadline if provided, otherwise use config, fallback to default
      const deadlineSeconds = deadline ?? this.config.gaslessDeadline ?? DEFAULTS.GASLESS_DEADLINE;
      const deadlineTimestamp = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);

      // Use custom gas limit if provided, otherwise use config, fallback to default
      const gasLimitValue = gasLimit ?? this.config.gaslessGasLimit ?? DEFAULTS.GASLESS_GAS_LIMIT;
      const gasLimitBigInt = BigInt(gasLimitValue);

      if (!this.connectedAddress || !this.signer) {
        throw new WalletConnectionError('Wallet not connected', 'WALLET_NOT_CONNECTED');
      }
      const forwardMessage = {
        from: this.connectedAddress,
        to: gatewayAddress,
        value: BigInt(0),
        gas: gasLimitBigInt,
        nonce: nonce,
        deadline: deadlineTimestamp,
        data: payCallData,
      };

      const signature = await this.signer.signTypedData(domain, types, forwardMessage);

      const forwardRequest: ForwardRequest = {
        from: this.connectedAddress,
        to: gatewayAddress,
        value: '0',
        gas: gasLimitValue.toString(),
        nonce: nonce.toString(),
        deadline: deadlineTimestamp.toString(),
        data: payCallData,
        signature: signature,
      };

      // Step 5: Submit to relay
      if (dialog) dialog.updateStep(GASLESS_STEPS.RELAYING);
      const relayResponse = await this.submitGaslessPayment(
        paymentId,
        forwarderAddress,
        forwardRequest
      );

      if (!relayResponse.relayRequestId) {
        throw new APIError('Failed to get relay request ID', undefined, 'RELAY_REQUEST_ID_MISSING');
      }

      const relayRequestId = relayResponse.relayRequestId;

      // Wait for relay transaction
      const relayResult = await this.waitForRelayTransaction(relayRequestId);

      if (relayResult.status?.toLowerCase() === 'failed') {
        throw new PaymentError('Gasless payment relay failed');
      }

      const txHash = relayResult.transactionHash;

      // Step 6: Confirm payment
      if (dialog) dialog.updateStep(GASLESS_STEPS.CONFIRMING, { txHash });
      await this.pollPaymentStatus(paymentId);

      if (!txHash) {
        throw new PaymentError('Transaction hash not available');
      }
      if (dialog) dialog.showSuccess(txHash);

      return {
        success: true,
        payment,
        txHash,
        relayRequestId,
        gasless: true,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (dialog) dialog.showError(message);
      throw error;
    }
  }

  /**
   * Submit gasless payment to relay service
   *
   * @param paymentId - Payment ID
   * @param forwarderAddress - Forwarder contract address
   * @param forwardRequest - EIP-712 signed forward request
   * @returns Relay response with relayRequestId
   * @throws {APIError} If API request fails
   * @throws {PaymentError} If request validation fails
   */
  async submitGaslessPayment(
    paymentId: string,
    forwarderAddress: string,
    forwardRequest: ForwardRequest
  ): Promise<RelayResponse> {
    if (!this.config.apiUrl || !this.config.apiKey) {
      throw new APIError('API URL and API key are required');
    }

    // Validate forwardRequest fields
    if (!forwardRequest.from || !/^0x[a-fA-F0-9]{40}$/.test(forwardRequest.from)) {
      throw new PaymentError(`Invalid from address: ${forwardRequest.from}`);
    }
    if (!forwardRequest.to || !/^0x[a-fA-F0-9]{40}$/.test(forwardRequest.to)) {
      throw new PaymentError(`Invalid to address: ${forwardRequest.to}`);
    }
    if (!forwardRequest.signature || !forwardRequest.signature.startsWith('0x')) {
      throw new PaymentError(`Invalid signature: ${forwardRequest.signature}`);
    }
    if (!forwardRequest.data || !forwardRequest.data.startsWith('0x')) {
      throw new PaymentError(`Invalid data: ${forwardRequest.data}`);
    }
    if (!forwarderAddress || !/^0x[a-fA-F0-9]{40}$/.test(forwarderAddress)) {
      throw new PaymentError(`Invalid forwarder address: ${forwarderAddress}`);
    }

    // API expects: { paymentId, forwarderAddress, forwardRequest }
    const requestBody = {
      paymentId: String(paymentId),
      forwarderAddress: forwarderAddress.toLowerCase(),
      forwardRequest: {
        from: forwardRequest.from.toLowerCase(),
        to: forwardRequest.to.toLowerCase(),
        value: String(forwardRequest.value || '0'),
        gas: String(forwardRequest.gas || '300000'),
        nonce: String(forwardRequest.nonce),
        deadline: String(forwardRequest.deadline),
        data: forwardRequest.data,
        signature: forwardRequest.signature,
      },
    };

    const response = await fetch(`${this.config.apiUrl}/payments/${paymentId}/gasless`, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.message ||
        errorData.code ||
        `Failed to submit gasless payment: ${response.statusText}`;
      throw new APIError(errorMessage, response.status);
    }

    const data = await response.json();
    return data.data || data;
  }

  /**
   * Get relay transaction status
   *
   * @param relayRequestId - Relay request ID
   * @returns Relay result with status and transaction hash
   * @throws {APIError} If API request fails
   */
  async getRelayStatus(relayRequestId: string): Promise<RelayResult> {
    if (!this.config.apiUrl || !this.config.apiKey) {
      throw new APIError('API URL and API key are required', undefined, 'API_CONFIG_MISSING');
    }

    const response = await fetch(`${this.config.apiUrl}/payments/relay/${relayRequestId}/status`, {
      headers: {
        'x-api-key': this.config.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new APIError(`Failed to get relay status: ${response.statusText}`, response.status);
    }

    const data = await response.json();
    return data.data || data;
  }

  /**
   * Wait for relay transaction to complete
   *
   * @param relayRequestId - Relay request ID
   * @param timeout - Timeout in milliseconds (default: 120000)
   * @param interval - Polling interval in milliseconds (default: 3000)
   * @returns Relay result with status and transaction hash
   * @throws {PaymentError} If relay fails or times out
   */
  async waitForRelayTransaction(
    relayRequestId: string,
    timeout = TIMING.RELAY_STATUS_TIMEOUT,
    interval = TIMING.RELAY_STATUS_POLL_INTERVAL
  ): Promise<RelayResult> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, interval));

      const result = await this.getRelayStatus(relayRequestId);
      const status = result.status?.toLowerCase();

      if (status === 'mined' || status === 'confirmed') {
        return result;
      }

      if (status === 'failed') {
        throw new PaymentError('Relay transaction failed', 'RELAY_FAILED');
      }
    }

    throw new PaymentError('Relay transaction confirmation timeout', 'RELAY_TIMEOUT');
  }
}

// Export WALLET_TYPES as static property
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(MSQPay as any).WALLET_TYPES = WALLET_TYPES;
