# MSQPay Demo App - Merchant Integration Guide

[English](README.md) | [한국어](README.ko.md)

This document explains how to integrate the MSQPay payment system into your merchant application.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
- [SDK Installation and Setup](#sdk-installation-and-setup)
- [API Endpoint Implementation](#api-endpoint-implementation)
- [Frontend Integration](#frontend-integration)
- [Payment Flows](#payment-flows)
- [Error Handling](#error-handling)

---

## Architecture Overview

MSQPay uses a 3-tier architecture:

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│  Merchant Server │────▶│  MSQPay Server  │────▶│   Blockchain    │
│   (Browser)     │     │   (Next.js)     │     │  (Payment API)  │     │   (Ethereum)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘     └─────────────────┘
     fetch API            MSQPay SDK           REST API              Smart Contract
```

**Core Principles:**
- Frontend never communicates directly with MSQPay server
- All API calls are proxied through merchant server
- API keys are used server-side only (security)

---

## Getting Started

### 1. Environment Variables

```bash
# Copy .env.example to .env.local
cp .env.example .env.local
```

Open `.env.local` and set values:

```bash
# Server-side (not exposed to frontend)
MSQPAY_API_KEY=your-api-key-here
MSQPAY_API_URL=http://localhost:3001

# Client-side
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your-walletconnect-project-id
```

| Variable | Required | Location | Description |
|----------|----------|----------|-------------|
| `MSQPAY_API_KEY` | ✅ | Server | MSQPay server authentication key |
| `MSQPAY_API_URL` | ❌ | Server | Payment server URL (default: localhost:3001) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | ✅ | Client | Issued from [WalletConnect](https://cloud.walletconnect.com/) |

> **Note**: Chain configuration (RPC URLs, contract addresses) is managed in the payment server's database. Wallet connection is handled through RainbowKit.

### 2. Install Dependencies

```bash
pnpm install
```

### 3. Run Development Server

```bash
# Local development
pnpm dev

# Docker environment (full stack)
cd docker && docker-compose up
```

---

## SDK Installation and Setup

### Installation

```bash
pnpm add @globalmsq/msqpay
```

### Client Initialization

Initialize MSQPay SDK as singleton on merchant server:

```typescript
// lib/msqpay-server.ts
import { MSQPayClient } from '@globalmsq/msqpay';

let msqpayClient: MSQPayClient | null = null;

export function getMSQPayClient(): MSQPayClient {
  if (!msqpayClient) {
    const apiUrl = process.env.MSQPAY_API_URL || 'http://localhost:3001';

    msqpayClient = new MSQPayClient({
      environment: 'custom',
      apiUrl: apiUrl,
      apiKey: process.env.MSQPAY_API_KEY || ''
    });
  }
  return msqpayClient;
}
```

**Environment Options:**
- `development`: Development server (uses default URL)
- `staging`: Staging server
- `production`: Production server
- `custom`: Specify custom URL directly (for Docker environment, etc.)

---

## API Endpoint Implementation

API endpoints to implement on merchant server.

### 1. Check Payment Status

```typescript
// app/api/payments/[paymentId]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getMSQPayClient } from '@/lib/msqpay-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  try {
    const client = getMSQPayClient();
    const result = await client.getPaymentStatus(params.paymentId);
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.statusCode || 500 }
    );
  }
}
```

### 2. Query Payment History

```typescript
// app/api/payments/history/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const payer = request.nextUrl.searchParams.get('payer');
    const chainId = request.nextUrl.searchParams.get('chainId');

    if (!payer) {
      return NextResponse.json(
        { success: false, message: 'payer parameter required' },
        { status: 400 }
      );
    }

    if (!chainId) {
      return NextResponse.json(
        { success: false, message: 'chainId parameter required' },
        { status: 400 }
      );
    }

    const apiUrl = process.env.MSQPAY_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/payments/history?chainId=${chainId}&payer=${payer}`);
    const data = await response.json();

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }
}
```

### 3. Submit Gasless Payment

```typescript
// app/api/payments/[paymentId]/gasless/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getMSQPayClient } from '@/lib/msqpay-server';

export async function POST(
  request: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  try {
    const client = getMSQPayClient();
    const body = await request.json();

    const result = await client.submitGasless({
      paymentId: params.paymentId,
      forwarderAddress: body.forwarderAddress,
      forwardRequest: body.forwardRequest
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.statusCode || 500 }
    );
  }
}
```

### 4. Execute Relay Transaction

```typescript
// app/api/payments/[paymentId]/relay/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getMSQPayClient } from '@/lib/msqpay-server';

export async function POST(
  request: NextRequest,
  { params }: { params: { paymentId: string } }
) {
  try {
    const client = getMSQPayClient();
    const body = await request.json();

    const result = await client.executeRelay({
      paymentId: params.paymentId,
      transactionData: body.transactionData,
      gasEstimate: body.gasEstimate
    });

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.statusCode || 500 }
    );
  }
}
```

### 5. Check Relay Status

```typescript
// app/api/payments/relay/[relayRequestId]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getMSQPayClient } from '@/lib/msqpay-server';

export async function GET(
  request: NextRequest,
  { params }: { params: { relayRequestId: string } }
) {
  try {
    const client = getMSQPayClient();

    const result = await client.getRelayStatus(params.relayRequestId);

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: error.statusCode || 500 }
    );
  }
}
```

### 6. Create Checkout Payment

```typescript
// app/api/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { MSQPayClient } from '@globalmsq/msqpay';
import { getProductById } from '@/lib/products';
import { getMerchantConfig } from '@/lib/merchant';

const client = new MSQPayClient({
  environment: 'custom',
  apiKey: process.env.MSQPAY_API_KEY || 'demo-key',
  apiUrl: process.env.MSQPAY_API_URL || 'http://127.0.0.1:3001',
});

interface CheckoutItem {
  productId: string;
  quantity?: number;
}

interface CheckoutRequest {
  products: CheckoutItem[];
}

interface ProductInfo {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: string;
  subtotal: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CheckoutRequest = await request.json();
    const { products } = body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        {
          success: false,
          code: 'VALIDATION_ERROR',
          message: 'Missing or invalid required field: products (array)',
        },
        { status: 400 }
      );
    }

    const merchantConfig = getMerchantConfig();

    const productInfos: ProductInfo[] = [];
    let totalAmount = 0;

    for (const item of products) {
      const { productId, quantity = 1 } = item;

      if (!productId) {
        return NextResponse.json(
          {
            success: false,
            code: 'VALIDATION_ERROR',
            message: 'Product ID is required for each item',
          },
          { status: 400 }
        );
      }

      const product = getProductById(productId);
      if (!product) {
        return NextResponse.json(
          {
            success: false,
            code: 'PRODUCT_NOT_FOUND',
            message: `Product not found: ${productId}`,
          },
          { status: 404 }
        );
      }

      const unitPrice = parseFloat(product.price);
      const subtotal = unitPrice * quantity;
      totalAmount += subtotal;

      productInfos.push({
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice: product.price,
        subtotal: subtotal.toString(),
      });
    }

    const payment = await client.createPayment({
      merchantId: merchantConfig.merchantId,
      amount: totalAmount,
      currency: merchantConfig.tokenSymbol,
      chainId: merchantConfig.chainId,
      recipientAddress: merchantConfig.recipientAddress,
      tokenAddress: merchantConfig.tokenAddress,
    });

    return NextResponse.json(
      {
        success: true,
        paymentId: payment.paymentId,
        products: productInfos,
        totalAmount: totalAmount.toString(),
        chainId: merchantConfig.chainId,
        tokenSymbol: merchantConfig.tokenSymbol,
        tokenAddress: merchantConfig.tokenAddress,
        decimals: merchantConfig.tokenDecimals,
        gatewayAddress: payment.gatewayAddress,
        forwarderAddress: payment.forwarderAddress,
        recipientAddress: merchantConfig.recipientAddress,
      },
      { status: 201 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorCode = (error as Record<string, unknown>)?.code || 'INTERNAL_ERROR';

    if (errorCode === 'UNSUPPORTED_CHAIN' || errorCode === 'UNSUPPORTED_TOKEN') {
      return NextResponse.json(
        {
          success: false,
          code: errorCode,
          message: errorMessage,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        code: 'INTERNAL_ERROR',
        message: errorMessage,
      },
      { status: 500 }
    );
  }
}
```

### 7. Get Chain Configuration

```typescript
// app/api/config/route.ts
import { NextResponse } from 'next/server';

export interface ChainConfig {
  chainId: number;
  rpcUrl: string;
  chainName: string;
}

export async function GET() {
  const config: ChainConfig = {
    chainId: Number(process.env.CHAIN_ID) || 31337,
    rpcUrl: process.env.RPC_URL || 'http://localhost:8545',
    chainName: process.env.CHAIN_NAME || 'Hardhat',
  };

  return NextResponse.json(config);
}
```

---

## Frontend Integration

How to call merchant server API from frontend.

### Check Payment Status

```typescript
// Frontend code
async function checkPaymentStatus(paymentId: string) {
  const response = await fetch(`/api/payments/${paymentId}/status`);
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message);
  }

  return result.data;
}

// Usage example
const payment = await checkPaymentStatus('pay_abc123');
console.log('Payment status:', payment.status);
// 'pending' | 'confirmed' | 'failed' | 'completed'
```

### Query Payment History

```typescript
async function getPaymentHistory(walletAddress: string) {
  const response = await fetch(`/api/payments/history?payer=${walletAddress}`);
  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message);
  }

  return result.data;
}
```

### Submit Gasless Payment

```typescript
async function submitGaslessPayment(
  paymentId: string,
  forwarderAddress: string,
  forwardRequest: any
) {
  const response = await fetch(`/api/payments/${paymentId}/gasless`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      forwarderAddress,
      forwardRequest
    })
  });

  const result = await response.json();

  if (!result.success) {
    throw new Error(result.message);
  }

  return result;
}
```

### Status Polling

Polling pattern to wait for payment completion:

```typescript
async function waitForPaymentConfirmation(
  paymentId: string,
  maxAttempts = 30,
  intervalMs = 2000
): Promise<PaymentStatus> {
  for (let i = 0; i < maxAttempts; i++) {
    const payment = await checkPaymentStatus(paymentId);

    if (payment.status === 'confirmed' || payment.status === 'completed') {
      return payment;
    }

    if (payment.status === 'failed') {
      throw new Error('Payment failed');
    }

    // Wait then retry if pending
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new Error('Payment confirmation timeout');
}

// Usage example
try {
  const confirmedPayment = await waitForPaymentConfirmation('pay_abc123');
  console.log('Payment confirmed:', confirmedPayment.transactionHash);
} catch (error) {
  console.error('Payment confirmation failed:', error.message);
}
```

---

## Payment Flows

### 1. Direct Payment

Standard payment method where users pay gas fees directly.

```
1. User connects wallet
2. Frontend creates payment transaction
3. User approves transaction in wallet (pays gas)
4. Query payment status by transaction hash
5. Payment confirmation complete
```

### 2. Gasless Payment (Meta Transaction)

MSQPay covers gas fees.

```
1. User connects wallet
2. Frontend creates meta-transaction data
3. User signs only (no gas payment)
4. Merchant server → MSQPay server submits signature
5. MSQPay executes transaction and covers gas
6. Confirm completion via status polling
```

---

## Error Handling

### SDK Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `INVALID_API_KEY` | Invalid API key | Check API key |
| `PAYMENT_NOT_FOUND` | Payment not found | Verify paymentId |
| `INSUFFICIENT_BALANCE` | Insufficient balance | Check token balance |
| `NETWORK_ERROR` | Network error | Check connection status |
| `TRANSACTION_FAILED` | Transaction failed | Check transaction logs |

### Error Handling Pattern

```typescript
import { MSQPayError } from '@globalmsq/msqpay';

try {
  const result = await client.getPaymentStatus(paymentId);
} catch (error) {
  if (error instanceof MSQPayError) {
    console.error('MSQPay error:', error.code, error.message);

    switch (error.code) {
      case 'PAYMENT_NOT_FOUND':
        // Need to verify payment ID
        break;
      case 'INVALID_API_KEY':
        // Check API key configuration
        break;
      default:
        // General error handling
    }
  } else {
    console.error('Unknown error:', error);
  }
}
```

---

## Additional Resources

- [MSQPay SDK Documentation](../../packages/sdk/README.md)
- [API Specification](../../docs/reference/api.md)
- [Architecture Documentation](../../docs/reference/architecture.md)
- [Smart Contract Documentation](../../contracts/README.md)

---

## Support

If you encounter any issues, please open an issue.
