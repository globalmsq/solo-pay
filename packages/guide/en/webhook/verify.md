# Signature Verification

::: warning Coming Soon
Webhook functionality is currently in development. The documentation below describes planned features.
:::

Verify the authenticity of Webhook requests.

## Why Verify?

Malicious third parties could send fake Webhook requests. You must verify signatures to confirm requests are genuinely from SoloPay.

::: danger Required
In production environments, you **must** verify signatures.
:::

## Verification Methods

### Using SDK (Recommended)

```typescript
import { verifyWebhookSignature } from '@globalmsq/solopay';

app.post('/webhook', (req, res) => {
  const isValid = verifyWebhookSignature({
    payload: req.body,
    signature: req.headers['x-solopay-signature'],
    timestamp: req.headers['x-solopay-timestamp'],
    secret: process.env.WEBHOOK_SECRET!,
  });

  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  // Handle event
  const event = req.body;
  console.log(event.event, event.data);

  res.status(200).send('OK');
});
```

### Manual Implementation

Signatures are generated as follows:

```
signature = HMAC-SHA256(timestamp + '.' + JSON.stringify(payload), secret)
```

Verification code:

```typescript
import crypto from 'crypto';

function verifySignature(
  payload: object,
  signature: string,
  timestamp: string,
  secret: string
): boolean {
  // Timestamp verification (within 5 minutes)
  const now = Math.floor(Date.now() / 1000);
  const requestTime = parseInt(timestamp, 10);

  if (Math.abs(now - requestTime) > 300) {
    return false; // Prevent replay attacks
  }

  // Signature verification
  const signedPayload = `${timestamp}.${JSON.stringify(payload)}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}
```

## Framework Examples

### Express.js

```typescript
import express from 'express';
import { verifyWebhookSignature } from '@globalmsq/solopay';

const app = express();

// Raw body needed
app.use(
  '/webhook',
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf.toString();
    },
  })
);

app.post('/webhook', (req, res) => {
  const isValid = verifyWebhookSignature({
    payload: req.body,
    signature: req.headers['x-solopay-signature'] as string,
    timestamp: req.headers['x-solopay-timestamp'] as string,
    secret: process.env.WEBHOOK_SECRET!,
  });

  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  // Handle event
  handleEvent(req.body);

  res.status(200).send('OK');
});
```

### Next.js API Route

```typescript
// pages/api/webhook.ts
import type { NextApiRequest, NextApiResponse } from 'next';
import { verifyWebhookSignature } from '@globalmsq/solopay';

export const config = {
  api: {
    bodyParser: true,
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const isValid = verifyWebhookSignature({
    payload: req.body,
    signature: req.headers['x-solopay-signature'] as string,
    timestamp: req.headers['x-solopay-timestamp'] as string,
    secret: process.env.WEBHOOK_SECRET!,
  });

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Handle event
  const { event, data } = req.body;

  switch (event) {
    case 'payment.confirmed':
      // Complete order
      break;
    case 'payment.failed':
      // Handle failure
      break;
  }

  res.status(200).json({ received: true });
}
```

### Fastify

```typescript
import Fastify from 'fastify';
import { verifyWebhookSignature } from '@globalmsq/solopay';

const app = Fastify();

app.post('/webhook', async (request, reply) => {
  const isValid = verifyWebhookSignature({
    payload: request.body,
    signature: request.headers['x-solopay-signature'] as string,
    timestamp: request.headers['x-solopay-timestamp'] as string,
    secret: process.env.WEBHOOK_SECRET!,
  });

  if (!isValid) {
    return reply.status(401).send({ error: 'Invalid signature' });
  }

  // Handle event
  handleEvent(request.body);

  return { received: true };
});
```

## Important Notes

### Timestamp Verification

- Check that the difference between request time and current time is within 5 minutes
- Prevents replay attacks

### Timing-safe Comparison

- Regular string comparison (`===`) is vulnerable to timing attacks
- Use `crypto.timingSafeEqual()` instead

### Idempotency Handling

- The same event may be sent multiple times
- Prevent duplicate processing using `paymentId`

```typescript
const processedEvents = new Set<string>();

function handleEvent(event: WebhookEvent) {
  const eventKey = `${event.data.paymentId}:${event.event}`;

  if (processedEvents.has(eventKey)) {
    return; // Already processed
  }

  processedEvents.add(eventKey);
  // Process event...
}
```

## Next Steps

- [Event Details](/en/webhook/events) - Event handling methods
- [API Reference](/en/api/) - Complete API specification
