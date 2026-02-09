import Redis from 'ioredis';
import { createWebhookWorker } from './queue';

function getRedisConnection(): Redis {
  const url = process.env.REDIS_URL;
  if (url) {
    return new Redis(url, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      retryStrategy: (times) => Math.min(times * 100, 3000),
    });
  }
  const host = process.env.REDIS_HOST ?? 'localhost';
  const port = parseInt(process.env.REDIS_PORT ?? '6379', 10);
  return new Redis({
    host,
    port,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    retryStrategy: (times) => Math.min(times * 100, 3000),
  });
}

function main(): void {
  const redis = getRedisConnection();

  const worker = createWebhookWorker({
    connection: redis,
    onSuccess: (job) => {
      console.log('[webhook] delivered payment.confirmed job=%s', job.id);
    },
    onFailed: (job, err) => {
      console.error('[webhook] failed job=%s error=%s', job?.id, err.message);
    },
  });

  const shutdown = async (): Promise<void> => {
    await worker.close();
    await redis.quit();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown());
  process.on('SIGINT', () => shutdown());

  console.log('[webhook-manager] worker started, queue=solo-pay-webhook');
}

main();
