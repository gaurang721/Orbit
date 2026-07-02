import rateLimit, { type RateLimitRequestHandler, type Store } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { env } from '../config/env.js';
import { redis, redisEnabled } from '../lib/redis.js';

function makeStore(prefix: string): Store | undefined {
  // Without Redis, fall back to express-rate-limit's default in-memory store
  // (single-instance only). With Redis, share counters across API instances.
  if (!redisEnabled) return undefined;
  return new RedisStore({
    sendCommand: (...args: string[]) =>
      redis.call(...(args as [string, ...string[]])) as Promise<never>,
    prefix,
  });
}

/** Global limiter applied to all API routes. */
const globalStore = makeStore('rl:global:');
export const globalRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  ...(globalStore ? { store: globalStore } : {}),
  message: { success: false, error: { code: 'TOO_MANY_REQUESTS', message: 'Too many requests, please slow down.' } },
});

/** Stricter limiter for sensitive auth endpoints (login, register, reset). */
const authStore = makeStore('rl:auth:');
export const authRateLimiter: RateLimitRequestHandler = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  ...(authStore ? { store: authStore } : {}),
  // count only failed attempts toward the limit
  skipSuccessfulRequests: true,
  message: {
    success: false,
    error: { code: 'TOO_MANY_REQUESTS', message: 'Too many attempts. Try again later.' },
  },
});
