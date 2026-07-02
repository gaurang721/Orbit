import { describe, expect, it } from 'vitest';
import { loginSchema, registerSchema, resetPasswordSchema } from '@fbclone/types';
import {
  generateBackupCodes,
  generateToken,
  hashPassword,
  safeEqual,
  sha256,
  verifyPassword,
} from '../../utils/crypto.js';

describe('crypto utils', () => {
  it('hashes and verifies a password', async () => {
    const hash = await hashPassword('Sup3rSecret');
    expect(hash).not.toBe('Sup3rSecret');
    expect(await verifyPassword('Sup3rSecret', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('generates unique URL-safe tokens', () => {
    const a = generateToken();
    const b = generateToken();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('sha256 is deterministic and safeEqual is correct', () => {
    expect(sha256('x')).toBe(sha256('x'));
    expect(safeEqual(sha256('x'), sha256('x'))).toBe(true);
    expect(safeEqual(sha256('x'), sha256('y'))).toBe(false);
  });

  it('produces the requested number of backup codes', () => {
    const codes = generateBackupCodes(10);
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
  });
});

describe('auth validation schemas', () => {
  it('accepts a valid registration', () => {
    const parsed = registerSchema.safeParse({
      firstName: 'Ada',
      lastName: 'Lovelace',
      username: 'ada_lovelace',
      email: 'ADA@example.com',
      password: 'Sup3rSecret',
    });
    expect(parsed.success).toBe(true);
    // email is lower-cased
    if (parsed.success) expect(parsed.data.email).toBe('ada@example.com');
  });

  it('rejects a weak password', () => {
    const parsed = registerSchema.safeParse({
      firstName: 'Ada',
      lastName: 'Lovelace',
      username: 'ada',
      email: 'ada@example.com',
      password: 'weak',
    });
    expect(parsed.success).toBe(false);
  });

  it('rejects an invalid username', () => {
    const parsed = registerSchema.safeParse({
      firstName: 'Ada',
      lastName: 'Lovelace',
      username: 'ad a!',
      email: 'ada@example.com',
      password: 'Sup3rSecret',
    });
    expect(parsed.success).toBe(false);
  });

  it('defaults rememberMe to false on login', () => {
    const parsed = loginSchema.parse({ identifier: 'ada', password: 'x' });
    expect(parsed.rememberMe).toBe(false);
  });

  it('requires a strong password on reset', () => {
    expect(resetPasswordSchema.safeParse({ token: 't', password: 'weak' }).success).toBe(false);
    expect(resetPasswordSchema.safeParse({ token: 't', password: 'Sup3rSecret' }).success).toBe(true);
  });
});
