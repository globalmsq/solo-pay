# Breaking Changes in v2.0.0

## Overview

Version 2.0.0 introduces a major change in how the SDK handles blockchain-specific information. All contract addresses and blockchain configuration are now **provided by the server**, eliminating the need for hardcoded values in client applications.

---

## Migration Guide

### createPayment API

#### Before (v1.x)

```typescript
client.createPayment({
  userId: 'user123',
  amount: 100,
  currency: 'USD',
  tokenAddress: '0x...',  // Hardcoded by developer
  recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  description: 'Order #12345'
});
```

#### After (v2.0.0)

```typescript
client.createPayment({
  merchantId: 'merchant_001',
  amount: 100,
  chainId: 80002,   // Explicitly specify chain
  recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2'
});
```

---

## What Changed

### Request Parameters

| Parameter | v1.x | v2.0.0 | Status |
|-----------|------|--------|--------|
| `userId` | Required | Removed | Breaking Change |
| `merchantId` | N/A | Required (NEW) | New parameter |
| `amount` | Required | Required | No change |
| `currency` | Optional enum | Removed (auto from on-chain) | Breaking Change |
| `tokenAddress` | Required (hardcoded) | Required | No change |
| `chainId` | N/A | Required (NEW) | New parameter |
| `recipientAddress` | Required | Required | No change |
| `description` | Optional | Removed | Breaking Change |

**Note:** Token symbol and decimals are now fetched automatically from on-chain data.

### Response Fields

#### v1.x Response

```json
{
  "success": true,
  "paymentId": "payment-1732960000000",
  "transactionHash": "0x...",
  "status": "pending"
}
```

#### v2.0.0 Response

```json
{
  "success": true,
  "paymentId": "pay_1732960000000",
  "tokenAddress": "0xE4C687167705Abf55d709395f92e254bdF5825a2",
  "gatewayAddress": "0x...",
  "forwarderAddress": "0x...",
  "amount": "100000000000000000000",
  "status": "pending"
}
```

**New fields in v2.0.0:**
- `tokenAddress` - Token address from server
- `gatewayAddress` - Payment Gateway contract address
- `forwarderAddress` - Forwarder contract address (for meta-transactions)
- `amount` - Amount in wei (smallest unit)

---

## Migration Steps

### 1. Update SDK Installation

```bash
npm install @msqpay/sdk@^2.0.0
```

### 2. Update Client Initialization

**No changes needed** - Same configuration as v1.x:

```typescript
import { MSQPayClient } from '@msqpay/sdk';

const client = new MSQPayClient({
  environment: 'production',
  apiKey: 'your-api-key'
});
```

### 3. Update createPayment Calls

Remove `userId`, `currency`, and `description`. Add `merchantId`, `chainId`, and `tokenAddress`:

```typescript
// Before (v1.x)
const response = await client.createPayment({
  userId: 'user123',
  amount: 100,
  currency: 'USD',
  tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2',
  recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  description: 'Order #12345'
});

// After (v2.0.0) - symbol/decimals fetched from on-chain automatically
import { useChainId } from 'wagmi';

function MyComponent() {
  const chainId = useChainId();

  const response = await client.createPayment({
    merchantId: 'merchant_001',
    amount: 100,
    chainId, // Use wagmi hook to get current chain
    recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2'
  });
}
```

### 4. Handle New Response Fields

The response now includes blockchain-specific information:

```typescript
// symbol/decimals fetched from on-chain automatically
const response = await client.createPayment({
  merchantId: 'merchant_001',
  amount: 100,
  chainId: 80002,
  recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2'
});

// ✅ Use server-provided addresses instead of hardcoded values
const { tokenAddress, gatewayAddress, amount } = response;

// Send transaction using server-provided addresses
await writeContract({
  address: tokenAddress,
  abi: ERC20_ABI,
  functionName: 'approve',
  args: [gatewayAddress, amount],
  account: userAddress
});
```

### 5. Remove Hardcoded Configuration

If your app had hardcoded contract addresses:

```typescript
// ❌ DELETE: Old hardcoded configuration
export const CONTRACTS = {
  80002: {
    gateway: '0x...',
    forwarder: '0x...'
  }
};

export const TOKENS = {
  80002: {
    SUT: '0xE4C687167705Abf55d709395f92e254bdF5825a2'
  }
};

// ✅ REPLACE: Get from server response
const { tokenAddress, gatewayAddress } = await client.createPayment({
  merchantId,
  amount,
  chainId,
  recipientAddress,
  tokenAddress
});
```

---

## Supported Chains

v2.0.0 supports the following blockchain networks:

| Chain | Chain ID | Token | Token Address |
|-------|----------|-------|---------------|
| **Polygon Amoy (Testnet)** | 80002 | SUT | 0xE4C687167705Abf55d709395f92e254bdF5825a2 |
| **Hardhat (Local)** | 31337 | TEST | 0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512 |

---

## Error Handling

New error codes in v2.0.0:

```typescript
try {
  await client.createPayment({
    merchantId: 'merchant_001',
    amount: 100,
    chainId: 1,  // Unsupported chain
    recipientAddress: '0x...',
    tokenAddress: '0x0000000000000000000000000000000000000000'  // Unknown token
  });
} catch (error) {
  if (error.code === 'UNSUPPORTED_CHAIN') {
    // Handle unsupported blockchain
    console.log(`Chain ${chainId} is not supported`);
  } else if (error.code === 'UNSUPPORTED_TOKEN') {
    // Handle unsupported token address
    console.log(`Token address not supported on this chain`);
  }
}
```

---

## Backwards Compatibility

**v2.0.0 is NOT backwards compatible with v1.x**

If you need to support both versions during transition:

```typescript
import { MSQPayClient } from '@msqpay/sdk';

const sdkVersion = process.env.SDK_VERSION || 'v2';

if (sdkVersion === 'v1') {
  // Use v1.x SDK with hardcoded addresses
  const response = await clientV1.createPayment({
    userId: 'user123',
    tokenAddress: hardcodedAddress,
    // ...
  });
} else {
  // Use v2.0.0 SDK with server-provided addresses
  // symbol/decimals fetched from on-chain automatically
  const response = await clientV2.createPayment({
    merchantId: 'merchant_001',
    amount: 100,
    chainId: 80002,
    recipientAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    tokenAddress: '0xE4C687167705Abf55d709395f92e254bdF5825a2'
  });
}
```

---

## Support Timeline

- **v1.x** will receive security patches until **2025-03-01**
- **v1.x** will reach end-of-life on **2025-06-01**

Migrate to v2.0.0 as soon as possible to receive the latest features and security updates.

---

## Questions?

If you encounter issues during migration, please:

1. Check this guide again
2. Review the [API Documentation](../docs/api/payments.md)
3. Submit an issue on GitHub
4. Contact support at support@msqpay.com
