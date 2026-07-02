import { Redis } from 'ioredis';
import { env } from '../config/env.js';
import { logger } from './logger.js';

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    enableReadyCheck: true,
  });

if (env.isDev) globalForRedis.redis = redis;

redis.on('error', (err) => logger.error({ err }, 'Redis error'));

export const redisEnabled = env.REDIS_ENABLED;

export async function connectRedis(): Promise<void> {
  if (!redisEnabled) {
    logger.warn('⚠️  Redis disabled (REDIS_ENABLED=false) — using in-memory rate limiting and no-op cache');
    return;
  }
  if (redis.status === 'ready' || redis.status === 'connecting') return;
  await redis.connect();
  logger.info('✅ Redis connected');
}

export async function disconnectRedis(): Promise<void> {
  if (!redisEnabled) return;
  await redis.quit();
  logger.info('Redis disconnected');
}

// Small typed cache helpers used across modules. No-op when Redis is disabled.
export const cache = {
  async get<T>(key: string): Promise<T | null> {
    if (!redisEnabled) return null;
    const raw = await redis.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  },
  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    if (!redisEnabled) return;
    const raw = JSON.stringify(value);
    if (ttlSeconds) await redis.set(key, raw, 'EX', ttlSeconds);
    else await redis.set(key, raw);
  },
  async del(...keys: string[]): Promise<void> {
    if (!redisEnabled) return;
    if (keys.length) await redis.del(...keys);
  },
};
