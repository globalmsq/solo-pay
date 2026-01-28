/**
 * MSQPay Core Class - Clean Implementation
 */

import { WalletDetector } from './wallet-detector.js';
import { WalletSelector } from './wallet-selector.js';
import { ProgressDialog } from './progress-dialog.js';
import {
  WALLET_TYPES,
  ERC20_ABI,
  PAYMENT_GATEWAY_ABI,
  FORWARDER_ABI,
  PAYMENT_STEPS,
  GASLESS_STEPS,
} from './constants.js';

export class MSQPay {
  constructor(config = {}) {
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
      throw new Error('ethers.js is required. Please load it before MSQPay.');
    }
  }

  /**
   * Initialize MSQPay
   */
  async init(config = {}) {
    this.config = { ...this.config, ...config };

    // Initialize MetaMask SDK for mobile support (like msqpay.js)
    // SDK will show browser/mobile dialog when eth_requestAccounts is called
    if (typeof MetaMaskSDK !== 'undefined') {
      try {
        this.mmsdk = new MetaMaskSDK.MetaMaskSDK({
          dappMetadata: {
            name: config.dappName || 'MSQPay',
            url: typeof window !== 'undefined' ? window.location.origin : '',
          },
          infuraAPIKey: config.infuraAPIKey,
          checkInstallationImmediately: false,
          useDeeplink: true,
          communicationLayerPreference: 'socket',
          openDeeplink: (link) => {
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

        await this.mmsdk.init();

        const sdkProvider = this.mmsdk.getProvider();
        if (sdkProvider) {
          sdkProvider.on('connect', (info) => {
            this.currentChainId = parseInt(info.chainId, 16);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent('msqpay:sdkConnected', { detail: info }));
            }
          });
        }
      } catch {
        console.warn('MetaMask SDK initialization failed:', error);
        // Continue without SDK - extension will still work
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
      const accounts = await ethereum.request({ method: 'eth_accounts' });

      if (!accounts || accounts.length === 0) {
        return; // Wallet not connected
      }

      // Get chain ID
      const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
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
      this.provider = new this.ethers.BrowserProvider(ethereum);
      this.signer = await this.provider.getSigner();
      this.connectedAddress = accounts[0];
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
  async connect(options = {}) {
    const { walletType, showSelector = true } = options;

    const availableWallets = this.walletDetector.getAvailableWallets();

    if (availableWallets.length === 0) {
      throw new Error('No wallet detected. Please install MetaMask or Trust Wallet.');
    }

    let selectedWalletType = walletType;

    // Show selector if multiple wallets and no wallet type specified
    if (!selectedWalletType && availableWallets.length > 1 && showSelector) {
      selectedWalletType = await WalletSelector.show(availableWallets);
    } else if (!selectedWalletType) {
      selectedWalletType = availableWallets[0].type;
    }

    // Update wallet detector's mmsdk reference
    this.walletDetector.mmsdk = this.mmsdk;

    // Get provider
    const ethereum = this.walletDetector.getProviderForWallet(selectedWalletType);
    if (!ethereum) {
      throw new Error('Selected wallet is not available.');
    }

    // Request accounts
    let accounts;
    try {
      accounts = await ethereum.request({ method: 'eth_requestAccounts' });
    } catch (error) {
      if (error.code === -32002) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        accounts = await ethereum.request({ method: 'eth_accounts' });
        if (!accounts || accounts.length === 0) {
          throw new Error('Please approve the connection request in your wallet');
        }
      } else if (error.code === 4001) {
        throw new Error('Connection rejected by user.');
      } else {
        throw error;
      }
    }

    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found. Please unlock your wallet.');
    }

    // Get chain ID
    const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
    this.currentChainId = parseInt(chainIdHex, 16);

    // Switch network if needed
    if (this.merchantNetworkId && this.currentChainId !== this.merchantNetworkId) {
      await this.switchNetwork(this.merchantNetworkId);
    }

    // Setup provider and signer
    this.provider = new this.ethers.BrowserProvider(ethereum);
    this.signer = await this.provider.getSigner();
    this.connectedAddress = accounts[0];
    this.currentWalletType = selectedWalletType;

    // Setup event listeners
    ethereum.on('accountsChanged', this.handleAccountsChanged.bind(this));
    ethereum.on('chainChanged', this.handleChainChanged.bind(this));

    return {
      address: this.connectedAddress,
      chainId: this.currentChainId,
      walletType: this.currentWalletType,
    };
  }

  /**
   * Disconnect wallet
   */
  async disconnect() {
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
  async fetchMerchantInfo() {
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
    } catch {
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
    } catch {
      this.paymentMethods = [];
    }
  }

  /**
   * Switch network
   */
  async switchNetwork(networkId) {
    const ethereum = this.walletDetector.getProviderForWallet(this.currentWalletType);
    if (!ethereum) {
      throw new Error('Wallet not connected');
    }

    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${networkId.toString(16)}` }],
      });
    } catch (error) {
      if (error.code === 4902) {
        // Network not found, add it
        const networkConfig = this.getNetworkConfig(networkId);
        if (!networkConfig) {
          throw new Error(`Network ${networkId} is not supported`);
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
    const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
    this.currentChainId = parseInt(chainIdHex, 16);
  }

  /**
   * Get network config
   * Uses infuraAPIKey if provided to avoid rate limiting
   */
  getNetworkConfig(networkId) {
    // Use infuraAPIKey if provided, otherwise use public endpoint (may be rate limited)
    const infuraKey = this.config.infuraAPIKey || '';
    const mainnetRpc = infuraKey
      ? `https://mainnet.infura.io/v3/${infuraKey}`
      : 'https://mainnet.infura.io/v3/';
    const sepoliaRpc = infuraKey
      ? `https://sepolia.infura.io/v3/${infuraKey}`
      : 'https://sepolia.infura.io/v3/';

    const networks = {
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
  handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
      // User disconnected from wallet extension
      this.disconnect();
    } else if (accounts[0] !== this.connectedAddress) {
      // User switched account
      this.connectedAddress = accounts[0];
      // Update signer with new address
      if (this.provider) {
        this.provider.getSigner().then((signer) => {
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
  handleChainChanged(chainId) {
    this.currentChainId = parseInt(chainId, 16);
    window.location.reload();
  }

  /**
   * Create payment (direct)
   */
  async createPayment({ amount, currency, showDialog = true }) {
    let dialog = null;

    try {
      if (!this.isConnected()) {
        throw new Error('Please connect your wallet first');
      }

      const paymentMethod = this.paymentMethods.find((pm) => pm.token?.symbol === currency);
      if (!paymentMethod) {
        const availableTokens = this.paymentMethods
          .map((pm) => pm.token?.symbol)
          .filter(Boolean)
          .join(', ');
        throw new Error(
          `Payment method for ${currency} not found. Available: ${availableTokens || 'none'}`
        );
      }

      const { token, chain } = paymentMethod;
      if (!token || !chain) {
        throw new Error('Invalid payment method configuration');
      }

      // Show progress dialog
      if (showDialog) {
        dialog = new ProgressDialog({
          amount,
          currency,
          steps: PAYMENT_STEPS,
          networkId: this.merchantNetworkId,
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
      const balanceWei = this.ethers.parseUnits(balance, decimals);
      const amountWei = this.ethers.parseUnits(String(amount), decimals);

      if (balanceWei < amountWei) {
        throw new Error(`Insufficient balance. You have ${balance} ${currency}`);
      }

      // Step 2: Create payment
      if (dialog) dialog.updateStep(PAYMENT_STEPS.CREATING);
      const payment = await this.requestCreatePayment({ amount, currency });

      if (!payment.gatewayAddress) {
        throw new Error('Gateway address not configured');
      }

      const tokenAddress = payment.tokenAddress || token.address;
      const gatewayAddress = payment.gatewayAddress;
      const recipientAddress = paymentMethod.recipient_address || paymentMethod.recipientAddress;
      const amountInWei = BigInt(payment.amount);
      const paymentId = payment.paymentId;

      // Step 3: Approve token
      if (dialog) dialog.updateStep(PAYMENT_STEPS.APPROVING);
      const tokenContract = new this.ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
      const currentAllowance = await tokenContract.allowance(this.connectedAddress, gatewayAddress);

      if (BigInt(currentAllowance) < amountInWei) {
        const approveTx = await tokenContract.approve(gatewayAddress, amountInWei);
        if (dialog) dialog.updateStep(PAYMENT_STEPS.APPROVING, { txHash: approveTx.hash });
        await approveTx.wait();
      }

      // Step 4: Execute payment
      if (dialog) dialog.updateStep(PAYMENT_STEPS.WALLET_CONFIRM);
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
    } catch (error) {
      if (dialog) dialog.showError(error.message);
      throw error;
    }
  }

  /**
   * Request create payment
   */
  async requestCreatePayment({ amount, currency }) {
    if (!this.config.apiUrl || !this.config.apiKey) {
      throw new Error('API URL and API key are required');
    }

    const paymentMethod = this.paymentMethods.find((pm) => pm.token?.symbol === currency);
    if (!paymentMethod) {
      const availableTokens = this.paymentMethods
        .map((pm) => pm.token?.symbol)
        .filter(Boolean)
        .join(', ');
      throw new Error(
        `Payment method for ${currency} not found. Available: ${availableTokens || 'none'}`
      );
    }

    const { token, chain } = paymentMethod;
    if (!token || !chain) {
      throw new Error('Invalid payment method configuration');
    }

    const merchantId = this.merchantKey || this.config.merchantId;
    if (!merchantId) {
      throw new Error('Merchant ID is required. Please ensure merchant info is loaded.');
    }

    // Get chainId from chain object (API returns network_id)
    const chainId = chain.network_id || chain.networkId || chain.chain_id || chain.chainId;
    if (!chainId) {
      throw new Error(
        `Chain ID not found in payment method. Chain object: ${JSON.stringify(chain)}`
      );
    }

    // Get token address
    const tokenAddress = token.address;
    if (!tokenAddress || !/^0x[a-fA-F0-9]{40}$/.test(tokenAddress)) {
      throw new Error(`Invalid token address: ${tokenAddress}`);
    }

    // Get recipient address
    const recipientAddress = paymentMethod.recipient_address || paymentMethod.recipientAddress;
    if (!recipientAddress || !/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
      throw new Error(
        `Invalid recipient address: ${recipientAddress || 'missing'}. Payment method: ${JSON.stringify(paymentMethod)}`
      );
    }

    // Validate amount
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error(`Invalid amount: ${amount}`);
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
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.payment || data;
  }

  /**
   * Poll payment status
   */
  async pollPaymentStatus(paymentId, maxAttempts = 60, interval = 3000) {
    // Wait a bit before starting to poll (give server time to process)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, interval));

      const status = await this.getPaymentStatus(paymentId);

      if (status === 'CONFIRMED' || status === 'COMPLETED') {
        return status;
      }

      if (status === 'FAILED' || status === 'EXPIRED') {
        throw new Error(`Payment ${status.toLowerCase()}`);
      }
    }

    throw new Error('Payment confirmation timeout');
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(paymentId) {
    if (!this.config.apiUrl || !this.config.apiKey) {
      throw new Error('API URL and API key are required');
    }

    const response = await fetch(`${this.config.apiUrl}/payments/${paymentId}/status`, {
      headers: {
        'x-api-key': this.config.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get payment status: ${response.statusText}`);
    }

    const data = await response.json();
    return data.status || data.data?.status;
  }

  /**
   * Get balance
   */
  async getBalance(currency) {
    if (!this.isConnected()) {
      throw new Error('Please connect your wallet first');
    }

    const paymentMethod = this.paymentMethods.find((pm) => pm.token?.symbol === currency);
    if (!paymentMethod) {
      throw new Error(`Payment method for ${currency} not found`);
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
  getSupportedTokens() {
    return this.paymentMethods.map((pm) => pm.token?.symbol).filter(Boolean);
  }

  /**
   * Get connected address
   */
  getAddress() {
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
  getWalletType() {
    return this.currentWalletType;
  }

  /**
   * Get ethers signer instance
   */
  getSigner() {
    return this.signer;
  }

  /**
   * Get ethers provider instance
   */
  getProvider() {
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
  async ensureCorrectNetwork() {
    if (!this.merchantNetworkId) {
      throw new Error('Merchant network not configured');
    }
    if (!this.isCorrectNetwork()) {
      await this.switchNetwork(this.merchantNetworkId);
    }
  }

  /**
   * Get token info by symbol
   */
  getTokenBySymbol(symbol) {
    const method = this.paymentMethods.find((pm) => pm.token?.symbol === symbol);
    return method?.token || null;
  }

  /**
   * Get merchant network ID
   */
  getMerchantNetworkId() {
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
  isMetaMaskAvailable() {
    return this.walletDetector.isMetaMaskAvailable();
  }

  /**
   * Check if Trust Wallet is available
   */
  isTrustWalletAvailable() {
    return this.walletDetector.isTrustWalletAvailable();
  }

  /**
   * Show wallet selector (wrapper for WalletSelector.show)
   */
  async showWalletSelector() {
    const wallets = this.walletDetector.getAvailableWallets();
    if (wallets.length === 0) {
      throw new Error('No wallets available');
    }
    if (wallets.length === 1) {
      return wallets[0].type;
    }
    return await WalletSelector.show(wallets);
  }

  /**
   * Create gasless payment (meta-transaction - relayer pays gas)
   */
  /**
   * Create gasless payment (meta-transaction)
   * @param {Object} options - Payment options
   * @param {number|string} options.amount - Payment amount
   * @param {string} options.currency - Token symbol (e.g., 'USDT', 'ETH')
   * @param {boolean} [options.showDialog=true] - Show progress dialog
   * @param {number} [options.deadline] - Custom deadline in seconds (overrides config.gaslessDeadline)
   * @param {number|string} [options.gasLimit] - Custom gas limit (overrides config.gaslessGasLimit)
   * @returns {Promise<Object>} Payment result with txHash
   */
  async createGaslessPayment({ amount, currency, showDialog = true, deadline, gasLimit }) {
    let dialog = null;

    try {
      if (!this.isConnected()) {
        throw new Error('Please connect your wallet first');
      }

      const paymentMethod = this.paymentMethods.find((pm) => pm.token?.symbol === currency);
      if (!paymentMethod) {
        const availableTokens = this.paymentMethods
          .map((pm) => pm.token?.symbol)
          .filter(Boolean)
          .join(', ');
        throw new Error(
          `Payment method for ${currency} not found. Available: ${availableTokens || 'none'}`
        );
      }

      const { token, chain } = paymentMethod;
      if (!token || !chain) {
        throw new Error('Invalid payment method configuration');
      }

      // Show progress dialog
      if (showDialog) {
        dialog = new ProgressDialog({
          amount,
          currency,
          steps: GASLESS_STEPS,
          networkId: this.merchantNetworkId,
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
      const balanceWei = this.ethers.parseUnits(balance, decimals);
      const amountWei = this.ethers.parseUnits(String(amount), decimals);

      if (balanceWei < amountWei) {
        throw new Error(`Insufficient balance. You have ${balance} ${currency}`);
      }

      // Step 2: Create payment
      if (dialog) dialog.updateStep(GASLESS_STEPS.CREATING);
      const payment = await this.requestCreatePayment({ amount, currency });

      if (!payment.gatewayAddress) {
        throw new Error('Gateway address not configured');
      }
      if (!payment.forwarderAddress) {
        throw new Error('Forwarder address not configured. Gasless payments may not be supported.');
      }

      const tokenAddress = payment.tokenAddress || token.address;
      const gatewayAddress = payment.gatewayAddress;
      const forwarderAddress = payment.forwarderAddress;
      const recipientAddress = paymentMethod.recipient_address || paymentMethod.recipientAddress;
      const amountInWei = BigInt(payment.amount);
      const paymentId = payment.paymentId;

      // Step 3: Approve token
      if (dialog) dialog.updateStep(GASLESS_STEPS.APPROVING);
      const tokenContract = new this.ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
      const currentAllowance = await tokenContract.allowance(this.connectedAddress, gatewayAddress);

      if (BigInt(currentAllowance) < amountInWei) {
        const approveTx = await tokenContract.approve(gatewayAddress, amountInWei);
        if (dialog) dialog.updateStep(GASLESS_STEPS.APPROVING, { txHash: approveTx.hash });
        await approveTx.wait();
      }

      // Step 4: Sign EIP-712
      if (dialog) dialog.updateStep(GASLESS_STEPS.SIGNING);

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

      // Use custom deadline if provided, otherwise use config, fallback to 600 seconds (10 minutes)
      const deadlineSeconds = deadline ?? this.config.gaslessDeadline ?? 600;
      const deadlineTimestamp = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds);

      // Use custom gas limit if provided, otherwise use config, fallback to 300000
      const gasLimitValue = gasLimit ?? this.config.gaslessGasLimit ?? 300000;
      const gasLimitBigInt = BigInt(gasLimitValue);

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

      const forwardRequest = {
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
        throw new Error('Failed to get relay request ID');
      }

      const relayRequestId = relayResponse.relayRequestId;

      // Wait for relay transaction
      const relayResult = await this.waitForRelayTransaction(relayRequestId);

      if (relayResult.status?.toLowerCase() === 'failed') {
        throw new Error('Gasless payment relay failed');
      }

      const txHash = relayResult.transactionHash;

      // Step 6: Confirm payment
      if (dialog) dialog.updateStep(GASLESS_STEPS.CONFIRMING, { txHash });
      await this.pollPaymentStatus(paymentId);

      if (dialog) dialog.showSuccess(txHash);

      return {
        success: true,
        payment,
        txHash,
        relayRequestId,
        gasless: true,
      };
    } catch (error) {
      if (dialog) dialog.showError(error.message);
      throw error;
    }
  }

  /**
   * Submit gasless payment to relay
   */
  async submitGaslessPayment(paymentId, forwarderAddress, forwardRequest) {
    if (!this.config.apiUrl || !this.config.apiKey) {
      throw new Error('API URL and API key are required');
    }

    // Validate forwardRequest fields
    if (!forwardRequest.from || !/^0x[a-fA-F0-9]{40}$/.test(forwardRequest.from)) {
      throw new Error(`Invalid from address: ${forwardRequest.from}`);
    }
    if (!forwardRequest.to || !/^0x[a-fA-F0-9]{40}$/.test(forwardRequest.to)) {
      throw new Error(`Invalid to address: ${forwardRequest.to}`);
    }
    if (!forwardRequest.signature || !forwardRequest.signature.startsWith('0x')) {
      throw new Error(`Invalid signature: ${forwardRequest.signature}`);
    }
    if (!forwardRequest.data || !forwardRequest.data.startsWith('0x')) {
      throw new Error(`Invalid data: ${forwardRequest.data}`);
    }
    if (!forwarderAddress || !/^0x[a-fA-F0-9]{40}$/.test(forwarderAddress)) {
      throw new Error(`Invalid forwarder address: ${forwarderAddress}`);
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
      throw new Error(errorMessage);
    }

    const data = await response.json();
    return data.data || data;
  }

  /**
   * Get relay status
   */
  async getRelayStatus(relayRequestId) {
    if (!this.config.apiUrl || !this.config.apiKey) {
      throw new Error('API URL and API key are required');
    }

    const response = await fetch(`${this.config.apiUrl}/payments/relay/${relayRequestId}/status`, {
      headers: {
        'x-api-key': this.config.apiKey,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get relay status: ${response.statusText}`);
    }

    const data = await response.json();
    return data.data || data;
  }

  /**
   * Wait for relay transaction
   */
  async waitForRelayTransaction(relayRequestId, timeout = 120000, interval = 3000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      await new Promise((resolve) => setTimeout(resolve, interval));

      const result = await this.getRelayStatus(relayRequestId);
      const status = result.status?.toLowerCase();

      if (status === 'mined' || status === 'confirmed') {
        return result;
      }

      if (status === 'failed') {
        throw new Error('Relay transaction failed');
      }
    }

    throw new Error('Relay transaction confirmation timeout');
  }
}

// Export WALLET_TYPES
MSQPay.WALLET_TYPES = WALLET_TYPES;
