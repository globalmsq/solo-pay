# Webhook Manager (`@solo-pay/webhook-manager`)

[English](README.md) | [한국어](README.ko.md)

Background worker that delivers `payment.confirmed` webhooks to merchant URLs. The Gateway enqueues jobs to Redis (BullMQ); this service consumes the queue and sends HTTP POST requests to each merchant's `webhook_url` with retries.

## Overview

When a payment is confirmed (on-chain or via status sync), the Gateway adds a job to the `solo-pay-webhook` queue. The Webhook Manager worker picks up jobs, POSTs the payload to the merchant's URL, and retries on failure (10s, 30s, 90s).

**Purpose**:

- Decouple webhook delivery from the Gateway request lifecycle
- Reliable delivery with retries and queue persistence (Redis)
- Same flow for local (Docker), Amoy, and production

## Key Features

- **BullMQ queue**: Redis-backed queue; jobs survive restarts
- **Retry policy**: 3 retries with backoff (10s, 30s, 90s) on non-2xx or network error
- **Single event type**: `payment.confirmed` with payload (paymentId, orderId, status, txHash, amount, tokenSymbol, confirmedAt)
- **No HTTP server**: Worker only consumes from Redis and sends outbound POSTs
- **Docker support**: Included in `docker-compose.yaml`, `docker-compose-amoy.yaml`, and `docker-compose-relayer.yaml`

## Tech Stack

| Component | Technology      |
| --------- | --------------- |
| Queue     | BullMQ (Redis)  |
| Redis     | ioredis ^5.4    |
| Runtime   | Node.js 18+     |
| Language  | TypeScript ^5.4 |
| Testing   | Vitest ^4       |

## Getting Started

### Installation

```bash
cd packages/webhook-manager
pnpm install
```

### Environment Variables

Copy `.env.example` to `.env` and set Redis connection:

```bash
cp .env.example .env
```

- **REDIS_URL**: Optional. Single connection string (e.g. `redis://localhost:6379`). If set, overrides REDIS_HOST/REDIS_PORT.
- **REDIS_HOST**, **REDIS_PORT**: Used when REDIS_URL is not set. Defaults: `localhost`, `6379`.
- **NODE_ENV**: Optional. `production` (info logs), `development` (debug), `test` (silent).

### Run

```bash
# Development (watch mode)
pnpm dev

# Production
pnpm build
pnpm start
```

The worker connects to Redis and processes jobs from the `solo-pay-webhook` queue. No HTTP port is exposed.

## Integration

- **Gateway**: Uses `createWebhookQueue(redis)` and `queue.addPaymentConfirmed({ url, body })` when a payment becomes CONFIRMED (status or payment-detail sync).
- **Merchant**: Must expose a POST endpoint (e.g. `https://example.com/api/webhook`) that accepts JSON. The body matches `PaymentConfirmedBody` (paymentId, orderId, status, txHash, amount, tokenSymbol, confirmedAt).

## Scripts

| Script           | Description                   |
| ---------------- | ----------------------------- |
| `pnpm build`     | Compile TypeScript to `dist/` |
| `pnpm start`     | Run worker (`dist/worker.js`) |
| `pnpm dev`       | Run worker with watch         |
| `pnpm test`      | Run Vitest tests              |
| `pnpm typecheck` | Type-check without emit       |

## License

MIT
