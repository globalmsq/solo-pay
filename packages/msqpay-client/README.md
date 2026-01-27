# MSQPay Client

[![npm version](https://img.shields.io/npm/v/@globalmsq/msqpay-client.svg)](https://www.npmjs.com/package/@globalmsq/msqpay-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![CDN](https://img.shields.io/badge/CDN-jsDelivr-blue)](https://cdn.jsdelivr.net/npm/@globalmsq/msqpay-client)

CDN-ready JavaScript SDK for MSQPay blockchain payments. Supports MetaMask, Trust Wallet, and other injected wallets with built-in UI components.

## Features

- ✅ **Direct & Gasless Payments**: Support for both direct payments (user pays gas) and gasless payments (relayer pays gas via ERC2771)
- ✅ **Multi-Wallet Support**: MetaMask (extension + mobile), Trust Wallet, and any injected wallet
- ✅ **Mobile Support**: Full mobile wallet support via MetaMask SDK (iOS/Android)
- ✅ **Built-in UI**: Progress dialogs and wallet selector (no jQuery required)
- ✅ **EIP-6963**: Modern wallet provider discovery standard
- ✅ **CDN-Ready**: Works via CDN without build step
- ✅ **Auto Network Switching**: Automatically switches to merchant's network
- ✅ **Smart Token Approval**: Checks allowance before approving

## Supported Wallets

- **MetaMask**: Desktop Extension + Mobile App (via MetaMask SDK)
- **Trust Wallet**: Desktop Extension + Mobile App
- **Other Injected Wallets**: Any wallet that injects `window.ethereum` (EIP-6963 compatible)

## Installation

### Via CDN (Recommended)

```html
<!-- Load dependencies first -->
<script src="https://cdn.jsdelivr.net/npm/ethers@6.9.0/dist/ethers.umd.min.js"></script>

<!-- MetaMask SDK for mobile wallet support (required for mobile) -->
<script src="https://c0f4f41c-2f55-4863-921b-sdk-docs.github.io/cdn/metamask-sdk.js"></script>

<!-- Load MSQPay Client -->
<script src="https://cdn.jsdelivr.net/npm/@globalmsq/msqpay-client@latest/dist/msqpay.min.js"></script>
```

### Via npm

```bash
npm install @globalmsq/msqpay-client
```

```javascript
import MSQPay from '@globalmsq/msqpay-client';
```

## Quick Start

### Development (Local Build)

For local development, use the local build served via HTTP server:

```bash
# Install dependencies
pnpm install

# Build development version (with source maps)
pnpm build:dev

# Start development server (auto-opens browser)
pnpm dev

# Or build production and serve
pnpm dev:prod
```

Demo will be available at: `http://localhost:8081/apps/demo.html`

**Development CDN (Local):**

```html
<!-- Load from local dist/ after build -->
<script src="./dist/msqpay.js"></script>
<!-- or for production build -->
<script src="./dist/msqpay.min.js"></script>
```

**Important**: MetaMask requires HTTP server (not `file://`). The dev server automatically handles this.

### Production CDN (After Publishing to npm)

After publishing to npm, it can be used via CDN:

**Publish to npm:**

```bash
# Build production
pnpm build

# Publish to npm (ensure you're logged in)
npm publish --access public
```

**After publishing, use via CDN:**

```html
<!-- Via jsDelivr -->
<script src="https://cdn.jsdelivr.net/npm/@globalmsq/msqpay-client@latest/dist/msqpay.min.js"></script>

<!-- Via unpkg -->
<script src="https://unpkg.com/@globalmsq/msqpay-client@latest/dist/msqpay.min.js"></script>
```

### Basic Usage

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="https://cdn.jsdelivr.net/npm/ethers@6.9.0/dist/ethers.umd.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@globalmsq/msqpay-client@latest/dist/msqpay.min.js"></script>
  </head>
  <body>
    <button id="connect">Connect Wallet</button>
    <button id="pay">Pay</button>

    <script>
      // Initialize
      MSQPay.init({
        apiUrl: 'https://your-api.com',
        apiKey: 'your-api-key',
      }).then(() => {
        console.log('MSQPay initialized');
      });

      // Connect wallet
      document.getElementById('connect').addEventListener('click', async () => {
        try {
          const result = await MSQPay.connect();
          console.log('Connected:', result.address);
        } catch (error) {
          console.error('Connection failed:', error);
        }
      });

      // Create payment
      document.getElementById('pay').addEventListener('click', async () => {
        try {
          const result = await MSQPay.createPayment({
            amount: 100,
            currency: 'USDT',
            showDialog: true,
          });
          console.log('Payment successful:', result.txHash);
        } catch (error) {
          console.error('Payment failed:', error);
        }
      });
    </script>
  </body>
</html>
```

## Configuration

### Basic Configuration

```javascript
MSQPay.init({
  apiUrl: 'https://api.example.com',
  apiKey: 'your-api-key', // Required for x-api-key header
  dappName: 'My App', // Optional: App name for mobile wallet
  infuraAPIKey: 'your-infura-key', // Optional: Recommended for better mobile experience
});
```

## API Reference

### `init(config)`

Initialize the SDK.

**Parameters:**

- `config.apiUrl` - API endpoint URL
- `config.apiKey` - API key for x-api-key header
- `config.infuraAPIKey` - Infura API key for MetaMask SDK (optional, for mobile support)
- `config.dappName` - Dapp name (optional, for MetaMask SDK)

### `connect(options)`

Connect to wallet. Will show wallet selector if multiple wallets available.

**Parameters:**

- `options.walletType` - Optional wallet type ('metamask', 'trust')
- `options.showSelector` - Show wallet selector (default: true)

**Returns:** `Promise<{address, chainId, walletType}>`

### `disconnect()`

Disconnect wallet.

### `createPayment(options)`

Create and process a direct payment (user pays gas).

**Parameters:**

- `options.amount` - Payment amount
- `options.currency` - Token symbol (e.g., 'USDT')
- `options.showDialog` - Show built-in progress dialog (default: true)

**Returns:** `Promise<{success, payment, txHash}>`

**Built-in UI:**
When `showDialog: true` (default), a progress dialog will automatically appear showing:

- Payment amount and currency
- Step-by-step progress indicator
- Transaction hash with link to block explorer
- Success/Error messages

### `createGaslessPayment(options)`

Create and process a gasless payment (relayer pays gas).

**Parameters:**

- `options.amount` - Payment amount
- `options.currency` - Token symbol (e.g., 'USDT')
- `options.showDialog` - Show progress dialog (default: true)

**Returns:** `Promise<{success, payment, txHash, relayRequestId, gasless}>`

### `getBalance(currency)`

Get token balance for connected wallet.

**Parameters:**

- `currency` - Token symbol

**Returns:** `Promise<string>` - Formatted balance

### `getAddress()`

Get connected wallet address.

**Returns:** `string|null`

### `getChainId()`

Get current chain ID.

**Returns:** `number|null`

### `getWalletType()`

Get current wallet type.

**Returns:** `string|null` - 'metamask', 'trust', or 'injected'

### `isConnected()`

Check if wallet is connected.

**Returns:** `boolean`

### `isCorrectNetwork()`

Check if connected to merchant's network.

**Returns:** `boolean`

### `ensureCorrectNetwork()`

Ensure wallet is connected to merchant's network, switch if needed.

**Returns:** `Promise<void>`

### `switchNetwork(networkId)`

Switch to a specific network.

**Parameters:**

- `networkId` - Network ID to switch to

**Returns:** `Promise<void>`

### `getMerchantNetworkId()`

Get merchant's network ID.

**Returns:** `number|null`

### `getPaymentMethods()`

Get available payment methods.

**Returns:** `Array`

### `getSupportedTokens()`

Get list of supported token symbols.

**Returns:** `string[]`

## Events

The SDK dispatches custom events for integration:

```javascript
// SDK ready event (fired when MSQPay is loaded and ready)
window.addEventListener('msqpay:ready', () => {
  console.log('MSQPay is ready');
});

// Payment completed successfully
window.addEventListener('msqpay:paymentComplete', (event) => {
  console.log('Payment completed:', event.detail);
  // event.detail: { payment, txHash, relayRequestId?, gasless? }
});

// Payment error occurred
window.addEventListener('msqpay:paymentError', (event) => {
  console.error('Payment error:', event.detail);
  // event.detail: { error: string, gasless? }
});

// Wallet disconnected
window.addEventListener('msqpay:disconnected', () => {
  console.log('Wallet disconnected');
});

// Account changed (user switched account in wallet)
window.addEventListener('msqpay:accountChanged', (event) => {
  console.log('Account changed:', event.detail.address);
  // event.detail: { address: string }
});

// Chain changed (user switched network)
window.addEventListener('msqpay:chainChanged', (event) => {
  console.log('Chain changed:', event.detail.chainId);
  // event.detail: { chainId: number }
});

// MetaMask SDK connected (mobile wallet)
window.addEventListener('msqpay:sdkConnected', (event) => {
  console.log('SDK connected:', event.detail);
});
```

## Development

### Running Demo

```bash
# Build and start server
pnpm dev

# Or build production and serve
pnpm dev:prod

# Manual: build then serve
pnpm build
pnpm serve
```

Demo will be available at: `http://localhost:8081/apps/demo.html`

**Note**: MetaMask requires HTTP server. The dev scripts automatically handle this.

### Available Scripts

- `pnpm build` - Build production bundle
- `pnpm build:dev` - Build development bundle with source maps
- `pnpm build:watch` - Watch mode for development
- `pnpm serve` - Start http-server on port 8081
- `pnpm dev` - Build dev and start server
- `pnpm dev:prod` - Build production and start server

## Examples

### Complete Payment Flow

```javascript
// Wait for SDK to be ready
window.addEventListener('msqpay:ready', async () => {
  // Initialize
  await MSQPay.init({
    apiUrl: 'https://api.example.com',
    apiKey: 'your-api-key',
    infuraAPIKey: 'your-infura-key', // Optional but recommended
  });

  // Connect wallet
  const result = await MSQPay.connect();
  console.log('Connected:', result.address, result.chainId);

  // Get balance
  const balance = await MSQPay.getBalance('USDT');
  console.log('Balance:', balance);

  // Create direct payment
  const payment = await MSQPay.createPayment({
    amount: 100,
    currency: 'USDT',
    showDialog: true,
  });
  console.log('Payment successful:', payment.txHash);
});
```

### Gasless Payment

```javascript
// Create gasless payment (relayer pays gas)
const payment = await MSQPay.createGaslessPayment({
  amount: 100,
  currency: 'USDT',
  showDialog: true,
});
console.log('Gasless payment:', payment.txHash, payment.relayRequestId);
```

### Custom Wallet Selection

```javascript
// Connect to specific wallet
const result = await MSQPay.connect({
  walletType: 'metamask', // or 'trust'
  showSelector: false,
});
```

### Network Management

```javascript
// Check if on correct network
if (!MSQPay.isCorrectNetwork()) {
  // Switch to merchant network
  await MSQPay.ensureCorrectNetwork();
}

// Or switch manually
await MSQPay.switchNetwork(137); // Polygon
```

## Troubleshooting

### Common Issues

**"MSQPay is not defined"**

- Ensure `ethers.js` is loaded before MSQPay
- Check script loading order
- Wait for `msqpay:ready` event before using

**"No wallet detected"**

- Install MetaMask or Trust Wallet extension
- For mobile, ensure MetaMask SDK is loaded
- Check browser console for wallet detection errors

**"Connection failed: Request already pending"**

- User has a pending connection request in wallet
- Wait for user to approve/reject in wallet UI
- Don't call `connect()` multiple times simultaneously

**"Payment Failed: 입력 검증 실패" (Input validation failed)**

- Check that all required fields are provided
- Verify API key is correct
- Ensure payment method is available for merchant

**MetaMask mobile dialog not appearing**

- Ensure MetaMask SDK is loaded
- Check `infuraAPIKey` is provided
- Verify network connectivity

### Debug Mode

Enable console logging for debugging:

```javascript
// Check wallet availability
console.log('Available wallets:', MSQPay.getAvailableWallets());
console.log('Is MetaMask available:', MSQPay.isMetaMaskAvailable());
console.log('Is Trust Wallet available:', MSQPay.isTrustWalletAvailable());

// Check connection status
console.log('Is connected:', MSQPay.isConnected());
console.log('Address:', MSQPay.getAddress());
console.log('Chain ID:', MSQPay.getChainId());
console.log('Wallet type:', MSQPay.getWalletType());

// Check payment methods
console.log('Payment methods:', MSQPay.getPaymentMethods());
console.log('Supported tokens:', MSQPay.getSupportedTokens());
```

## Requirements

- **ethers.js**: v6.0.0 or higher (loaded via CDN or npm)
- **Browser**: Modern browser with ES6+ support (Chrome, Firefox, Safari, Edge)
- **MetaMask SDK**: Optional, but recommended for mobile support
- **HTTP Server**: Required for MetaMask (dev scripts handle this automatically)

## Browser Support

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support
- Safari: ✅ Full support (iOS 12+)
- Mobile browsers: ✅ Full support (with MetaMask SDK)

## Security Considerations

- Always validate payment amounts and currencies on the server
- Never expose API keys in client-side code (use server-side proxy if needed)
- Verify payment status on server before fulfilling orders
- Use HTTPS in production
- Validate all user inputs before processing payments

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Changelog

All notable changes to this project will be documented in the [GitHub Releases](https://github.com/globalmsq/msqpay-monorepo/releases).

## License

MIT License - Copyright (c) 2026 MSQ Team

## Support

For issues, questions, or feature requests:

- Open an issue on [GitHub](https://github.com/globalmsq/msqpay-monorepo/issues)
- Check the [documentation](https://docs.msq.com)
- Review the [API reference](https://docs.msq.com/api)
