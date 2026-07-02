import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load the repo-root .env regardless of the process cwd (turbo runs per-app).
const here = path.dirname(fileURLToPath(import.meta.url));
const rootEnv = path.resolve(here, '../../../../.env');
dotenv.config({ path: existsSync(rootEnv) ? rootEnv : undefined });

const booleanish = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_URL: z.string().url().default('http://localhost:3000'),
  API_URL: z.string().url().default('http://localhost:4000'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  REDIS_URL: z.string().default('redis://localhost:6379'),
  // When false, the API runs without Redis: in-memory rate limiting + no-op
  // cache. Useful for local dev/demo where Redis isn't available.
  REDIS_ENABLED: booleanish.default('true'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 chars'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 chars'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN_REMEMBER: z.string().default('30d'),
  COOKIE_DOMAIN: z.string().default('localhost'),
  COOKIE_SECRET: z.string().min(8).default('dev_cookie_secret'),
  // Override the Secure cookie attribute. Defaults to NODE_ENV==='production'.
  // Set to false for a local HTTP docker demo behind nginx without TLS.
  COOKIE_SECURE: booleanish.optional(),

  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_SECURE: booleanish.default('false'),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  EMAIL_FROM: z.string().default('Orbit <no-reply@orbit.app>'),

  TOTP_ISSUER: z.string().default('Orbit'),

  // ----- Uploads / media -----
  // Storage uses local disk by default. Set S3_BUCKET (+ credentials) to push
  // uploads to S3-compatible object storage instead — required for >1 API
  // replica, since local disk isn't shared between nodes.
  UPLOAD_DIR: z.string().optional(),
  MEDIA_BASE_URL: z.string().optional(),
  MAX_UPLOAD_MB: z.coerce.number().int().positive().default(10),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  // Custom endpoint for S3-compatible stores (MinIO, R2, Spaces). Omit for AWS.
  S3_ENDPOINT: z.string().url().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  // Public base URL for stored objects (CDN or bucket URL). Falls back to the
  // endpoint/AWS-style URL when omitted.
  S3_PUBLIC_URL: z.string().url().optional(),
  // MinIO and most non-AWS stores need path-style addressing.
  S3_FORCE_PATH_STYLE: booleanish.default('false'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().default(15 * 60 * 1000),
  RATE_LIMIT_MAX: z.coerce.number().int().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().default(20),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
}).superRefine((val, ctx) => {
  // Production hardening: refuse to boot with placeholder / weak secrets.
  // Dev and test stay permissive so local setups keep working.
  if (val.NODE_ENV !== 'production') return;
  const isWeak = (s: string) => s.length < 32 || /change_me|dev_cookie_secret|min_32_chars/i.test(s);
  const reject = (path: string, message: string) =>
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
  if (isWeak(val.JWT_ACCESS_SECRET))
    reject('JWT_ACCESS_SECRET', 'Set a strong, non-default secret (≥32 chars) in production. Generate: openssl rand -base64 48');
  if (isWeak(val.JWT_REFRESH_SECRET))
    reject('JWT_REFRESH_SECRET', 'Set a strong, non-default secret (≥32 chars) in production. Generate: openssl rand -base64 48');
  if (val.JWT_ACCESS_SECRET === val.JWT_REFRESH_SECRET)
    reject('JWT_REFRESH_SECRET', 'JWT_REFRESH_SECRET must differ from JWT_ACCESS_SECRET.');
  if (isWeak(val.COOKIE_SECRET))
    reject('COOKIE_SECRET', 'Set a strong, non-default cookie secret (≥32 chars) in production.');
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with a readable message — never boot with bad config.
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  // eslint-disable-next-line no-console
  console.error(`\n❌ Invalid environment configuration:\n${issues}\n`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  isProd: parsed.data.NODE_ENV === 'production',
  isDev: parsed.data.NODE_ENV === 'development',
  isTest: parsed.data.NODE_ENV === 'test',
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
};

export type Env = typeof env;
