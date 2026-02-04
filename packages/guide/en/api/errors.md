# Error Codes

Error codes returned in API responses and how to resolve them.

## HTTP Status Codes

| Code | Description                           |
| ---- | ------------------------------------- |
| 200  | Success                               |
| 201  | Created successfully                  |
| 202  | Accepted (async processing)           |
| 400  | Bad request (parameter error)         |
| 401  | Authentication failed (API Key error) |
| 403  | Forbidden                             |
| 404  | Resource not found                    |
| 500  | Server error                          |

## Error Response Format

```json
{
  "code": "ERROR_CODE",
  "message": "Human readable message"
}
```

---

## Authentication Errors (401)

### UNAUTHORIZED

API Key is invalid or missing.

```json
{
  "code": "UNAUTHORIZED",
  "message": "Invalid or missing API key"
}
```

**Solution**

- Check `x-api-key` header
- Verify API Key in dashboard
- Use correct key for environment (test vs live)

---

## Validation Errors (400)

### VALIDATION_ERROR

Input data validation failed.

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "details": [
    {
      "path": ["amount"],
      "message": "Amount must be positive"
    }
  ]
}
```

**Solution**

- Check `details` field to see which field is invalid
- Ensure all required parameters are included

### UNSUPPORTED_CHAIN

Chain is not supported.

```json
{
  "code": "UNSUPPORTED_CHAIN",
  "message": "Unsupported chain"
}
```

**Solution**

- Check supported chains via `GET /chains` API
- Verify chainId value

### UNSUPPORTED_TOKEN

Token is not supported.

```json
{
  "code": "UNSUPPORTED_TOKEN",
  "message": "Unsupported token"
}
```

**Solution**

- Check supported token list
- Verify token address for typos
- Confirm token is enabled on the chain

### CHAIN_MISMATCH

Chain configuration doesn't match.

```json
{
  "code": "CHAIN_MISMATCH",
  "message": "Merchant is configured for chain 80002, but payment requested for chain 137"
}
```

**Solution**

- Verify merchant's configured chain matches request chain
- Confirm token belongs to the correct chain

---

## Resource Errors (404)

### MERCHANT_NOT_FOUND

Merchant not found.

```json
{
  "code": "MERCHANT_NOT_FOUND",
  "message": "Merchant not found"
}
```

**Solution**

- Verify `merchantId` value
- Confirm merchant is registered

### PAYMENT_NOT_FOUND

Payment not found.

```json
{
  "code": "PAYMENT_NOT_FOUND",
  "message": "Payment not found"
}
```

**Solution**

- Verify payment ID (paymentId)
- Confirm payment belongs to the merchant

### TOKEN_NOT_FOUND

Token not found.

```json
{
  "code": "TOKEN_NOT_FOUND",
  "message": "Token not found in database"
}
```

**Solution**

- Verify token address
- Confirm token is registered on the chain

### PAYMENT_METHOD_NOT_FOUND

Payment method not configured.

```json
{
  "code": "PAYMENT_METHOD_NOT_FOUND",
  "message": "Payment method not configured for this merchant and token"
}
```

**Solution**

- Verify token is configured as payment method for merchant
- Configure payment method in dashboard

---

## Permission Errors (403)

### MERCHANT_DISABLED

Merchant is disabled.

```json
{
  "code": "MERCHANT_DISABLED",
  "message": "Merchant is disabled"
}
```

**Solution**

- Check merchant status in dashboard
- Contact administrator

### PAYMENT_METHOD_DISABLED

Payment method is disabled.

```json
{
  "code": "PAYMENT_METHOD_DISABLED",
  "message": "Payment method is disabled"
}
```

**Solution**

- Enable payment method in dashboard

---

## Payment Status Errors (400)

### INVALID_PAYMENT_STATUS

Payment status is invalid.

```json
{
  "code": "INVALID_PAYMENT_STATUS",
  "message": "Payment status is CONFIRMED. Gasless requests are only allowed for CREATED or PENDING status."
}
```

**Solution**

- Check payment status first
- Prevent duplicate requests for completed payments

---

## Gasless Errors (400)

### INVALID_SIGNATURE

EIP-712 signature verification failed.

```json
{
  "code": "INVALID_SIGNATURE",
  "message": "Invalid signature format"
}
```

**Solution**

- Verify signature format (hex string starting with `0x`)
- Verify domain (name, version, chainId, verifyingContract)
- Verify type definitions

---

## Server Errors (500)

### INTERNAL_ERROR

Internal server error.

```json
{
  "code": "INTERNAL_ERROR",
  "message": "An internal error occurred"
}
```

**Solution**

- Retry after a moment
- Contact support@solopay.com if issue persists

---

## SDK Error Handling

```typescript
import { SoloPayError } from '@globalmsq/solopay'

try {
  const payment = await client.createPayment({ ... })
} catch (error) {
  if (error instanceof SoloPayError) {
    switch (error.code) {
      case 'UNSUPPORTED_TOKEN':
        console.log('Token is not supported')
        break
      case 'VALIDATION_ERROR':
        console.log('Check input values:', error.details)
        break
      case 'PAYMENT_NOT_FOUND':
        console.log('Payment not found')
        break
      default:
        console.log(`Error: ${error.message}`)
    }
  }
}
```

## Next Steps

- [SDK Usage](/en/sdk/) - Including error handling
- [Webhook Setup](/en/webhook/) - Event-based processing
