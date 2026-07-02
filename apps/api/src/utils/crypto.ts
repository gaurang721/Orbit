import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';

const BCRYPT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Generate a cryptographically-random, URL-safe token (for email/reset/refresh). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Deterministic SHA-256 hash — we store hashes of tokens, never the raw value. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** Constant-time comparison of two hex digests. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

/** Numeric backup codes for 2FA recovery (returned once, stored hashed). */
export function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () =>
    randomBytes(5).toString('hex').slice(0, 10).toUpperCase(),
  );
}
