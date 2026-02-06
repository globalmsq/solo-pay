import { Queue, Worker, type Job } from 'bullmq';
import type { Redis } from 'ioredis';
import type { WebhookJobData } from './types';
import { sendWebhook } from './send';
import { WEBHOOK_QUEUE_NAME, JOB_NAME_PAYMENT_CONFIRMED } from './types';

export type { WebhookJobData };
export { WEBHOOK_QUEUE_NAME, JOB_NAME_PAYMENT_CONFIRMED };

/**
 * Create queue for adding webhook jobs (use in gateway).
 * Pass the same Redis client used for cache, or a dedicated connection.
 */
export function createWebhookQueue(redis: Redis): {
  addPaymentConfirmed: (data: WebhookJobData) => Promise<void>;
  close: () => Promise<void>;
} {
  const queue = new Queue<WebhookJobData>(WEBHOOK_QUEUE_NAME, {
    connection: redis as import('bullmq').ConnectionOptions,
    defaultJobOptions: {
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });

  return {
    async addPaymentConfirmed(data: WebhookJobData): Promise<void> {
      await queue.add(JOB_NAME_PAYMENT_CONFIRMED, data, {
        jobId: undefined,
      });
    },
    async close(): Promise<void> {
      await queue.close();
    },
  };
}

export interface WorkerOptions {
  connection: Redis | { host: string; port: number };
  onSuccess?: (job: Job<WebhookJobData>) => void;
  onFailed?: (job: Job<WebhookJobData> | undefined, err: Error) => void;
}

/**
 * Create and start the webhook worker (use in worker process).
 */
export function createWebhookWorker(options: WorkerOptions): Worker<WebhookJobData> {
  const worker = new Worker<WebhookJobData>(
    WEBHOOK_QUEUE_NAME,
    async (job) => {
      const { url, body } = job.data;
      const result = await sendWebhook(url, body);
      if (!result.ok) {
        throw new Error(result.error ?? `HTTP ${result.statusCode}`);
      }
      return result;
    },
    {
      connection: options.connection as import('bullmq').ConnectionOptions,
      concurrency: 5,
    }
  );

  worker.on('completed', (job) => {
    options.onSuccess?.(job);
  });

  worker.on('failed', (job, err) => {
    options.onFailed?.(job ?? undefined, err);
  });

  return worker;
}
