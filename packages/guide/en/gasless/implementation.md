# Gasless Implementation

A detailed guide for implementing gasless payments.

## Overall Flow

```
1. Create Payment (Server)
       ↓
2. Request EIP-712 Signature (Frontend)
       ↓
3. Submit Gasless Request (Server)
       ↓
4. Check Status (Server/Frontend)
```

## Step 1: Create Payment

Create a payment the same way as regular payments.

```typescript
// Server-side
const payment = await client.createPayment({
  merchantId: 'merchant_demo_001',
  amount: 10.5,
  chainId: 80002,
  tokenAddress: '0x...',
  recipientAddress: '0x...',
});

// Pass paymentId, forwarderAddress to frontend
```

## Step 2: Request EIP-712 Signature

Request signature from the user on the frontend.

### wagmi Example

```typescript
import { useSignTypedData } from 'wagmi';

const { signTypedDataAsync } = useSignTypedData();

// Get current nonce from Forwarder
const nonce = await publicClient.readContract({
  address: FORWARDER_ADDRESS,
  abi: ForwarderABI,
  functionName: 'nonces',
  args: [userAddress],
});

// Build Forward Request
const forwardRequest = {
  from: userAddress,
  to: GATEWAY_ADDRESS,
  value: 0n,
  gas: 200000n,
  nonce: nonce,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour later
  data: encodeFunctionData({
    abi: PaymentGatewayABI,
    functionName: 'payWithSignature',
    args: [paymentHash, tokenAddress, amount],
  }),
};

// EIP-712 Signature
const signature = await signTypedDataAsync({
  domain: {
    name: 'SoloPay Forwarder',
    version: '1',
    chainId: 80002, // Polygon Amoy
    verifyingContract: FORWARDER_ADDRESS,
  },
  types: {
    ForwardRequest: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'gas', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint48' },
      { name: 'data', type: 'bytes' },
    ],
  },
  primaryType: 'ForwardRequest',
  message: forwardRequest,
});
```

### User's Wallet Display

The user's wallet will display something like this:

```
SoloPay Forwarder

ForwardRequest
───────────────
from:     0x1234...abcd
to:       0xGateway...
value:    0
gas:      200000
nonce:    1
deadline: 1706281200
data:     0x...
```

::: warning Important
Signatures are not transactions, so **no gas fees are incurred**.
:::

## Step 3: Submit Gasless Request

Send the signature to the server to request gasless payment.

### SDK Usage

```typescript
// Server-side
const result = await client.submitGasless({
  paymentId: payment.paymentId,
  forwarderAddress: payment.forwarderAddress,
  forwardRequest: {
    from: forwardRequest.from,
    to: forwardRequest.to,
    value: forwardRequest.value.toString(),
    gas: forwardRequest.gas.toString(),
    nonce: forwardRequest.nonce.toString(),
    deadline: forwardRequest.deadline.toString(),
    data: forwardRequest.data,
    signature: signature, // signature is included in forwardRequest
  },
});

console.log(result.relayRequestId); // relay_abc123
```

### REST API Usage

```bash
curl -X POST http://localhost:3001/payments/0xabc123.../gasless \
  -H "x-api-key: sk_test_xxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentId": "0xabc123...",
    "forwarderAddress": "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    "forwardRequest": {
      "from": "0x...",
      "to": "0x...",
      "value": "0",
      "gas": "200000",
      "nonce": "1",
      "deadline": "1706281200",
      "data": "0x...",
      "signature": "0x..."
    }
  }'
```

### Response

```json
{
  "success": true,
  "relayRequestId": "relay_abc123",
  "status": "submitted",
  "message": "Gasless transaction submitted"
}
```

## Step 4: Check Status

### Check Relay Status

```typescript
const relayStatus = await client.getRelayStatus('relay_abc123');

console.log(relayStatus.status); // submitted | pending | mined | confirmed | failed
```

### Check Payment Status

```typescript
const paymentStatus = await client.getPaymentStatus('0xabc123...');

console.log(paymentStatus.data.status); // CREATED | PENDING | CONFIRMED | FAILED
```

## Full Code Example

### Frontend (React + wagmi)

```typescript
import { useSignTypedData, useAccount, usePublicClient } from 'wagmi'
import { encodeFunctionData } from 'viem'

function GaslessPayment({ paymentId, forwarderAddress, gatewayAddress, amount, tokenAddress }) {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { signTypedDataAsync } = useSignTypedData()

  const handleGaslessPayment = async () => {
    // 1. Get nonce
    const nonce = await publicClient.readContract({
      address: forwarderAddress,
      abi: ForwarderABI,
      functionName: 'nonces',
      args: [address]
    })

    // 2. Build Forward Request
    const forwardRequest = {
      from: address,
      to: gatewayAddress,
      value: 0n,
      gas: 200000n,
      nonce: nonce,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
      data: encodeFunctionData({
        abi: PaymentGatewayABI,
        functionName: 'payWithSignature',
        args: [paymentId, tokenAddress, amount]
      })
    }

    // 3. Request signature
    const signature = await signTypedDataAsync({
      domain: { /* ... */ },
      types: { /* ... */ },
      primaryType: 'ForwardRequest',
      message: forwardRequest
    })

    // 4. Send to server
    const response = await fetch('/api/gasless', {
      method: 'POST',
      body: JSON.stringify({
        paymentId,
        forwarderAddress,
        forwardRequest: {
          ...forwardRequest,
          value: forwardRequest.value.toString(),
          gas: forwardRequest.gas.toString(),
          nonce: forwardRequest.nonce.toString(),
          deadline: forwardRequest.deadline.toString(),
          signature
        }
      })
    })

    return response.json()
  }

  return (
    <button onClick={handleGaslessPayment}>
      Pay without gas
    </button>
  )
}
```

### Backend (Node.js)

```typescript
import { SoloPayClient } from '@globalmsq/solopay';

const client = new SoloPayClient({
  apiKey: process.env.SOLO_PAY_API_KEY!,
  environment: 'staging',
});

app.post('/api/gasless', async (req, res) => {
  const { paymentId, forwarderAddress, forwardRequest } = req.body;

  try {
    const result = await client.submitGasless({
      paymentId,
      forwarderAddress,
      forwardRequest,
    });

    res.json({ success: true, relayRequestId: result.relayRequestId });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});
```

## Error Handling

| Error Code               | Cause                         | Solution                   |
| ------------------------ | ----------------------------- | -------------------------- |
| `INVALID_SIGNATURE`      | Signature verification failed | Check domain and types     |
| `NONCE_MISMATCH`         | Nonce mismatch                | Get latest nonce and retry |
| `DEADLINE_EXPIRED`       | Signature expired             | Request new signature      |
| `INSUFFICIENT_ALLOWANCE` | Token approval insufficient   | Run approve first          |

## Next Steps

- [Webhook Setup](/en/webhook/) - Receive payment completion notifications
- [Error Codes](/en/api/errors) - Complete error list
