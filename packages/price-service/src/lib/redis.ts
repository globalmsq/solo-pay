import Redis, { RedisOptions } from 'ioredis';
import { createLogger } from './logger';

let redisInstance: Redis | null = null;
let redisAvailable = false;
const logger = createLogger('RedisClient');

function createRedisClient(): Redis {
  const redisUrl = process.env.REDIS_URL;

  const options: RedisOptions = {
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  };

  let client: Redis;
  if (redisUrl) {
    client = new Redis(redisUrl, options);
  } else {
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);
    client = new Redis({ ...options, host, port });
  }

  client.on('error', (err) => {
    logger.warn({ err }, 'Redis connection error');
    redisAvailable = false;
  });

  client.on('connect', () => {
    redisAvailable = true;
  });

  client.on('close', () => {
    redisAvailable = false;
  });

  return client;
}

export function getRedisClient(): Redis {
  if (!redisInstance) {
    redisInstance = createRedisClient();
  }
  return redisInstance;
}

export function isRedisAvailable(): boolean {
  return redisAvailable && redisInstance?.status === 'ready';
}

export async function setCache(key: string, value: string, ttl: number = 60): Promise<void> {
  if (!isRedisAvailable()) {
    return;
  }

  try {
    const client = getRedisClient();
    await client.setex(key, ttl, value);
  } catch (error) {
    logger.warn({ err: error }, `Failed to set cache for key ${key}`);
  }
}

export async function getCache(key: string): Promise<string | null> {
  if (!isRedisAvailable()) {
    return null;
  }

  try {
    const client = getRedisClient();
    return await client.get(key);
  } catch (error) {
    logger.warn({ err: error }, `Failed to get cache for key ${key}`);
    return null;
  }
}

export async function disconnectRedis(): Promise<void> {
  if (redisInstance) {
    await redisInstance.quit();
    redisInstance = null;
    redisAvailable = false;
  }
}
