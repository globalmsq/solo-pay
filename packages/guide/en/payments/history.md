# Payment History

Retrieve payment history for a specific address.

## SDK Usage

```typescript
// Get payment history
const result = await client.getPaymentHistory({
  chainId: 80002, // Required: Chain ID
  payer: '0x1234...', // Required: Payer wallet address
  limit: 10, // Optional: Number of records
});

console.log(result.data); // Array of payments
```

## REST API Usage

```bash
curl -X GET "http://localhost:3001/payments/history?chainId=80002&payer=0x...&limit=10" \
  -H "x-api-key: sk_test_xxxxx"
```

## Request Parameters

| Field     | Type      | Required | Description                   |
| --------- | --------- | -------- | ----------------------------- |
| `chainId` | `number`  | ✓        | Blockchain network ID         |
| `payer`   | `address` | ✓        | Payer wallet address          |
| `limit`   | `number`  |          | Number of records to retrieve |

## Response

### Success (200 OK)

```json
{
  "success": true,
  "data": [
    {
      "paymentId": "0xabc123...",
      "payer": "0x1234...",
      "merchant": "0xMerchant...",
      "token": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      "tokenSymbol": "USDC",
      "decimals": 6,
      "amount": "10000000",
      "timestamp": "2024-01-26T12:35:42Z",
      "transactionHash": "0xdef789...",
      "status": "CONFIRMED",
      "isGasless": false,
      "relayId": null
    },
    {
      "paymentId": "0xdef456...",
      "payer": "0x1234...",
      "merchant": "0xMerchant...",
      "token": "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      "tokenSymbol": "USDC",
      "decimals": 6,
      "amount": "5000000",
      "timestamp": "2024-01-25T10:20:30Z",
      "transactionHash": "0xabc123...",
      "status": "CONFIRMED",
      "isGasless": true,
      "relayId": "relay_abc123"
    }
  ]
}
```

## Usage Example

```typescript
import { MSQPayClient } from '@globalmsq/msqpay';

const client = new MSQPayClient({
  apiKey: process.env.MSQPAY_API_KEY!,
  environment: 'staging',
});

// Fetch payment history
async function fetchPaymentHistory() {
  const result = await client.getPaymentHistory({
    chainId: 80002,
    payer: '0x1234567890abcdef...',
    limit: 10,
  });

  if (result.success) {
    for (const payment of result.data) {
      console.log(`Payment ID: ${payment.paymentId}`);
      console.log(`Amount: ${payment.amount} ${payment.tokenSymbol}`);
      console.log(`Status: ${payment.status}`);
      console.log(`Gasless: ${payment.isGasless ? 'Yes' : 'No'}`);
      console.log('---');
    }
  }
}
```

## On-chain Data Query

You can also query on-chain payment events directly via Subgraph.

```graphql
query PaymentHistory($payer: Bytes!) {
  paymentReceivedEvents(
    where: { payer: $payer }
    orderBy: blockTimestamp
    orderDirection: desc
    first: 10
  ) {
    id
    paymentId
    payer
    token
    amount
    transactionHash
    blockTimestamp
  }
}
```

::: tip Using Subgraph
Use Subgraph for large history queries or complex filtering needs.
:::

## Next Steps

- [Gasless Payments](/en/gasless/) - Pay without gas fees
- [Error Codes](/en/api/errors) - Error handling
