# Overview

MSQPay is a blockchain payment gateway. It provides APIs and SDKs for merchants to easily accept ERC-20 token payments.

## Key Features

### Payment API

- Payment creation and unique ID issuance
- Real-time payment status checking
- Payment history lookup

### Gasless Payments

- Users can pay with just a signature, no gas fees required
- Based on ERC-2771 meta-transaction standard
- Relayer submits transactions on behalf of users

### Webhook

- Real-time notifications on payment status changes
- Enhanced security with signature verification

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Merchant  │────▶│  MSQPay API │────▶│  Blockchain │
│   Server    │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   │                   │
       ▼                   ▼                   ▼
   SDK Usage         Payment Mgmt      TX Processing
```

## Payment Flow

1. **Create Payment**: Merchant server sends payment creation request to MSQPay API
2. **User Payment**: User transfers tokens or signs from their wallet
3. **Status Check**: Transaction confirmed on blockchain
4. **Notification**: Payment completion notification via Webhook

## Next Steps

- [Quick Start](/en/getting-started/quick-start) - Integrate your first payment in 5 minutes
- [Authentication](/en/getting-started/authentication) - API Key issuance and usage
