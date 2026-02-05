[English](sdk.md) | [한국어](sdk.ko.md)

# SoloPay SDK (`@globalmsq/solopay`)

A lightweight TypeScript SDK for store servers to interact with the SoloPay payment API. Built with Node.js 18+ native `fetch` and zero external dependencies.

## Installation

```bash
pnpm add @globalmsq/solopay
```

## Quick Start

### Basic Usage

```typescript
import { SoloPayClient } from '@globalmsq/solopay';

// Initialize the client
const client = new SoloPayClient({
  environment: 'production',
  apiKey: 'your-api-key',
});

// Create a payment
// Note: Payment funds are sent to the treasury address set during contract deployment
const payment = await client.createPayment({
  merchantId: 'merchant_001',
  amount: 100,
  chainId: 31337,
  tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
});

console.log(`Payment created: ${payment.paymentId}`);
```

## Environment Setup

### Supported Environments

- **development**: `http://localhost:3001`
- **staging**: `https://pay-api.staging.msq.com`
- **production**: `https://pay-api.msq.com`
- **custom**: Provide custom `apiUrl` in config

### Configuration Examples

```typescript
// Development
const devClient = new SoloPayClient({
  environment: 'development',
  apiKey: 'dev-api-key',
});

// Custom environment
const customClient = new SoloPayClient({
  environment: 'custom',
  apiKey: 'custom-api-key',
  apiUrl: 'https://my-api.example.com',
});
```

## API Methods

### createPayment(params)

Create a new payment. The server generates an EIP-712 signature that authorizes the payment parameters.

```typescript
const response = await client.createPayment({
  merchantId: string;       // Merchant identifier
  amount: number;           // Payment amount (in token units)
  chainId: number;          // Blockchain network ID
  tokenAddress: string;     // ERC20 token contract address
});

// Response
{
  success: true;
  paymentId: string;           // Unique payment hash (bytes32)
  chainId: number;             // Blockchain network ID
  tokenAddress: string;        // Token contract address
  tokenSymbol: string;         // Token symbol (from on-chain)
  tokenDecimals: number;       // Token decimals (from on-chain)
  gatewayAddress: string;      // PaymentGateway contract address
  forwarderAddress: string;    // ERC2771Forwarder address
  amount: string;              // Amount in wei
  status: 'pending';
  expiresAt: string;           // Expiration time (ISO 8601)
  recipientAddress?: string;   // Merchant's wallet address
  merchantId?: string;         // Merchant ID (bytes32)
  feeBps?: number;             // Fee in basis points (0-10000)
  serverSignature?: string;    // Server EIP-712 signature
}
```

**Note**: The `recipientAddress`, `merchantId`, `feeBps`, and `serverSignature` fields are used for server-signed payment verification on the smart contract.

### getPaymentStatus(paymentId)

Retrieve the status of a payment.

```typescript
const status = await client.getPaymentStatus('pay-123');

// Response
{
  success: true;
  data: {
    paymentId: string;
    merchantId: string;
    amount: number;
    chainId: number;
    tokenAddress: string;
    treasuryAddress: string;
    status: 'pending' | 'confirmed' | 'failed' | 'completed';
    transactionHash?: string;
    blockNumber?: number;
    createdAt: string;
    updatedAt: string;
  };
}
```

### submitGasless(params)

Submit a gasless (meta-transaction) request.

```typescript
const response = await client.submitGasless({
  paymentId: string;
  forwarderAddress: string;
  forwardRequest: {
    from: string;
    to: string;
    value: string;
    gas: string;
    deadline: string;
    data: string;
    signature: string;
  };
});

// Response
{
  success: true;
  relayRequestId: string;
  status: 'submitted' | 'mined' | 'failed';
  message: string;
}
```

### executeRelay(params)

Execute a relay transaction.

```typescript
const response = await client.executeRelay({
  paymentId: string;
  transactionData: string;
  gasEstimate: number;
});

// Response
{
  success: true;
  relayRequestId: string;
  transactionHash?: string;
  status: 'submitted' | 'mined' | 'failed';
  message: string;
}
```

### getPaymentHistory(params)

Retrieve payment history for a specific payer address.

```typescript
const response = await client.getPaymentHistory({
  chainId: number;      // Blockchain chain ID (e.g., 31337, 80002)
  payer: string;        // Payer wallet address
  limit?: number;       // Optional: Number of records to return
});

// Response
{
  success: true;
  data: [
    {
      paymentId: string;        // Payment ID (bytes32 hash)
      payer: string;            // Payer address
      treasury: string;         // Treasury address that received fees
      token: string;            // Token contract address
      tokenSymbol: string;      // Token symbol (e.g., "USDC")
      decimals: number;         // Token decimals
      amount: string;           // Amount in wei
      timestamp: string;        // Unix timestamp
      transactionHash: string;  // Transaction hash
      status: string;           // Payment status
      isGasless: boolean;       // Whether gasless payment
      relayId?: string;         // Relay request ID (if gasless)
    }
  ];
}
```

### setApiUrl(url)

Dynamically change the API URL.

```typescript
client.setApiUrl('https://new-api.example.com');
```

### getApiUrl()

Get the current API URL.

```typescript
const url = client.getApiUrl();
console.log(url); // https://pay-api.msq.com
```

## Error Handling

All API errors are thrown as `SoloPayError` with the following structure:

```typescript
try {
  await client.createPayment(params);
} catch (error) {
  if (error instanceof SoloPayError) {
    console.error(`Error [${error.code}]: ${error.message}`);
    console.error(`HTTP Status: ${error.statusCode}`);
    console.error(`Details:`, error.details);
  }
}
```

### Error Codes

| Code                       | HTTP Status | Description              |
| -------------------------- | ----------- | ------------------------ |
| `VALIDATION_ERROR`         | 400         | Input validation failed  |
| `INVALID_REQUEST`          | 400         | Malformed request        |
| `INVALID_SIGNATURE`        | 400         | Invalid signature format |
| `INVALID_TRANSACTION_DATA` | 400         | Invalid transaction data |
| `INVALID_GAS_ESTIMATE`     | 400         | Invalid gas estimate     |
| `NOT_FOUND`                | 404         | Payment not found        |
| `INTERNAL_ERROR`           | 500         | Server error             |

## TypeScript Types

The SDK exports all types for full type safety:

```typescript
import {
  SoloPayClient,
  SoloPayError,
  Environment,
  SoloPayConfig,
  CreatePaymentParams,
  CreatePaymentResponse,
  PaymentStatusResponse,
  GaslessParams,
  GaslessResponse,
  RelayParams,
  RelayResponse,
  GetPaymentHistoryParams,
  PaymentHistoryItem,
  PaymentHistoryResponse,
  ErrorResponse,
} from '@globalmsq/solopay';
```

### Type Definitions

```typescript
type Environment = 'development' | 'staging' | 'production' | 'custom';

interface SoloPayConfig {
  environment: Environment;
  apiKey: string;
  apiUrl?: string; // Required when environment is 'custom'
}

interface CreatePaymentParams {
  merchantId: string; // Merchant identifier key
  amount: number; // Payment amount (in token units)
  chainId: number; // Blockchain network ID
  tokenAddress: string; // 0x + 40 hex characters
}

interface CreatePaymentResponse {
  success: boolean;
  paymentId: string;
  chainId: number;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  gatewayAddress: string;
  forwarderAddress: string;
  amount: string; // wei
  status: string;
  expiresAt: string;
  recipientAddress?: string;
  merchantId?: string; // bytes32
  feeBps?: number; // 0-10000
  serverSignature?: string;
}

interface GaslessParams {
  paymentId: string;
  forwarderAddress: string; // 0x + 40 hex characters
  signature: string; // 0x hex string
}

interface RelayParams {
  paymentId: string;
  transactionData: string; // 0x hex string
  gasEstimate: number;
}

interface GetPaymentHistoryParams {
  chainId: number; // Blockchain chain ID
  payer: string; // Payer wallet address (0x + 40 hex)
  limit?: number; // Optional: Number of records
}

interface PaymentHistoryItem {
  paymentId: string; // Payment ID (bytes32 hash)
  payer: string; // Payer wallet address
  treasury: string; // Treasury address that received fees
  token: string; // Token contract address
  tokenSymbol: string; // Token symbol
  decimals: number; // Token decimals
  amount: string; // Amount in wei
  timestamp: string; // Unix timestamp
  transactionHash: string; // Transaction hash
  status: string; // Payment status
  isGasless: boolean; // Whether gasless payment
  relayId?: string; // Relay request ID (if gasless)
}
```

## Complete Example

```typescript
import { SoloPayClient, SoloPayError } from '@globalmsq/solopay';

async function processPayment() {
  const client = new SoloPayClient({
    environment: 'production',
    apiKey: process.env.SOLO_PAY_API_KEY!,
  });

  try {
    // Step 1: Create payment (funds go to treasury set at contract deployment)
    console.log('Creating payment...');
    const payment = await client.createPayment({
      merchantId: 'merchant_001',
      amount: 100,
      chainId: 31337,
      tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
    });
    console.log(`Payment created: ${payment.paymentId}`);

    // Step 2: Check payment status
    console.log('Checking payment status...');
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const status = await client.getPaymentStatus(payment.paymentId);
    console.log(`Payment status: ${status.data.status}`);

    // Step 3: Submit gasless transaction
    if (status.data.status === 'pending') {
      console.log('Submitting gasless transaction...');
      const gaslessResult = await client.submitGasless({
        paymentId: payment.paymentId,
        forwarderAddress: '0x9e5b65f2d0ca4541925d7c4cc5367cbeca076f82',
        forwardRequest: {
          from: '0x...',
          to: '0x...',
          value: '0',
          gas: '200000',
          deadline: '1234567890',
          data: '0x...',
          signature: '0x...',
        },
      });
      console.log(`Relay request: ${gaslessResult.relayRequestId}`);
    }
  } catch (error) {
    if (error instanceof SoloPayError) {
      console.error(`Payment error: [${error.code}] ${error.message}`);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

processPayment();
```

## Requirements

- Node.js >= 18.0.0 (for native `fetch` support)
- TypeScript >= 5.0 (optional, for development)

## Features

- ✅ **Zero Dependencies**: Uses native Node.js `fetch` API
- ✅ **Full TypeScript Support**: Complete type definitions
- ✅ **Type-Safe Error Handling**: `SoloPayError` class with error codes
- ✅ **Environment Management**: Built-in support for multiple environments
- ✅ **API Key Authentication**: Secure header-based authentication
- ✅ **Comprehensive Test Coverage**: 100% coverage with 32+ test cases

## Testing

```bash
# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Build TypeScript
pnpm build
```

## License

MIT

## Support

For issues or questions:

1. Check the error code and details in the thrown `SoloPayError`
2. Verify your API key and environment configuration
3. Ensure Node.js version >= 18.0.0
4. Review the [API documentation](https://docs.msq.com/api)
