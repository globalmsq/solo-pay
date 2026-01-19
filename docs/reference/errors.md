[English](errors.md) | [한국어](errors.ko.md)

# Error Codes

MSQPay API error codes and solutions.

## Error Response Structure

```json
{
  "code": "ERROR_CODE",
  "message": "Error message",
  "field": "fieldName", // Optional
  "value": "actualValue" // Optional
}
```

## HTTP Status Codes

| HTTP Status | Error Type                | Description                     |
| ----------- | ------------------------- | ------------------------------- |
| 400         | validation_error          | Input validation failed         |
| 400         | state_error               | Invalid state transition        |
| 401         | authentication_error      | Authentication/signature failed |
| 404         | not_found_error           | Resource not found              |
| 410         | expired_error             | Resource expired                |
| 429         | rate_limit_error          | Rate limit exceeded             |
| 500         | internal_error            | Internal server error           |
| 503         | service_unavailable_error | Service unavailable             |

## Common Error Codes

### validation_error (400)

Input data validation failed

| Code                            | Description                     | Solution                    |
| ------------------------------- | ------------------------------- | --------------------------- |
| `VALIDATION_ERROR`              | General validation failure      | Check input data            |
| `INVALID_REQUEST`               | Invalid request format          | Verify API format           |
| `PAYMENT_STORE_INVALID_ADDRESS` | Store address validation failed | Provide valid address       |
| `PAYMENT_TOKEN_INVALID_ADDRESS` | Token address validation failed | Provide valid token address |
| `PAYMENT_AMOUNT_INVALID_ZERO`   | Amount is zero                  | Provide positive amount     |
| `INVALID_TRANSACTION_DATA`      | Transaction data error          | Verify TX data              |
| `INVALID_GAS_ESTIMATE`          | Gas estimation error            | Recalculate gas value       |

### authentication_error (401)

Authentication and signature verification failed

| Code                        | Description                   | Solution                     |
| --------------------------- | ----------------------------- | ---------------------------- |
| `INVALID_SIGNATURE`         | Signature verification failed | Regenerate EIP-712 signature |
| `SIGNATURE_SIGNER_MISMATCH` | Signer mismatch               | Sign with correct wallet     |

### not_found_error (404)

Resource not found

| Code                | Description                   | Solution            |
| ------------------- | ----------------------------- | ------------------- |
| `NOT_FOUND`         | Payment information not found | Verify paymentId    |
| `PAYMENT_NOT_FOUND` | Payment not found             | Use valid paymentId |

### state_error (400)

Invalid state transition

| Code                        | Description               | Solution                     |
| --------------------------- | ------------------------- | ---------------------------- |
| `PAYMENT_ALREADY_PROCESSED` | Payment already processed | Prevent duplicate submission |
| `PAYMENT_EXPIRED`           | Payment expired           | Create new payment           |

### internal_error (500)

Internal server error

| Code                         | Description          | Solution                 |
| ---------------------------- | -------------------- | ------------------------ |
| `INTERNAL_ERROR`             | Server error         | Retry or contact support |
| `DATABASE_CONNECTION_FAILED` | DB connection failed | Retry after a moment     |
| `BLOCKCHAIN_RPC_ERROR`       | RPC error            | Retry after a moment     |

### service_unavailable_error (503)

External dependency error

| Code                        | Description               | Solution             |
| --------------------------- | ------------------------- | -------------------- |
| `SERVICE_UNAVAILABLE`       | Service unavailable       | Retry after a moment |
| `RELAY_SERVICE_UNAVAILABLE` | Relay service unavailable | Retry after a moment |

## Blockchain-Related Errors

### Token-Related

| Code                     | Description                | Solution               |
| ------------------------ | -------------------------- | ---------------------- |
| `INSUFFICIENT_BALANCE`   | Insufficient token balance | Add funds to balance   |
| `INSUFFICIENT_ALLOWANCE` | Insufficient approval      | Token approval needed  |
| `TOKEN_TRANSFER_FAILED`  | Token transfer failed      | Check balance/approval |

### Transaction-Related

| Code                   | Description         | Solution           |
| ---------------------- | ------------------- | ------------------ |
| `TRANSACTION_REVERTED` | TX execution failed | Check gas/balance  |
| `GAS_LIMIT_EXCEEDED`   | Gas limit exceeded  | Increase gas limit |
| `NONCE_TOO_LOW`        | Nonce conflict      | Reset wallet nonce |

## Error Handling Examples

### SDK Error Handling

```typescript
import { MSQPayClient, MSQPayError } from '@globalmsq/msqpay';

const client = new MSQPayClient({
  environment: 'development',
  apiKey: 'sk_test_abc123',
});

try {
  await client.createPayment(params);
} catch (error) {
  if (error instanceof MSQPayError) {
    console.error(`Error [${error.code}]: ${error.message}`);
    console.error(`HTTP Status: ${error.statusCode}`);
    console.error(`Details:`, error.details);

    // Handle by error type
    switch (error.code) {
      case 'VALIDATION_ERROR':
        // Fix input data and retry
        break;
      case 'INVALID_SIGNATURE':
        // Regenerate signature
        break;
      case 'NOT_FOUND':
        // Verify payment information
        break;
      case 'INTERNAL_ERROR':
        // Retry or contact support
        break;
      default:
      // Handle other errors
    }
  }
}
```

### Retry Logic

```typescript
async function retryableRequest<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let lastError: Error;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (error instanceof MSQPayError) {
        // Check if error is retryable
        const retryable = [
          'INTERNAL_ERROR',
          'SERVICE_UNAVAILABLE',
          'BLOCKCHAIN_RPC_ERROR',
        ].includes(error.code);

        if (!retryable) {
          throw error; // Non-retryable error, throw immediately
        }
      }

      // Exponential backoff
      const delay = Math.pow(2, i) * 1000;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Usage
const payment = await retryableRequest(() => client.createPayment(params));
```

## Debugging Tips

### 1. Check field and value

Identify the issue using `field` and `value` in error response:

```json
{
  "code": "PAYMENT_STORE_INVALID_ADDRESS",
  "message": "Invalid store address",
  "field": "recipientAddress",
  "value": "0xinvalid"
}
```

### 2. Check Logs

Payment Server logs:

```bash
docker-compose logs -f server
```

### 3. Check RPC Status

```bash
curl -X POST http://localhost:8545 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"web3_clientVersion","params":[],"id":67}'
```

## Related Documentation

- [API Reference](api.md) - All API endpoints
- [Integrate Payment](../guides/integrate-payment.md) - Error handling examples
- [SDK Reference](sdk.md) - MSQPayError class
