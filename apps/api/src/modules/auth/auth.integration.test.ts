import request, { type Response } from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { prisma } from '../../lib/prisma.js';

/**
 * End-to-end auth flow against a real database (CI provisions Postgres; locally
 * it runs against the dev DB). Covers the security-critical paths that pure unit
 * tests can't: session issuance, the access-token guard, refresh-token rotation,
 * stolen-token reuse detection, and logout revocation.
 */
const app = createApp();

// Unique identity per run so reruns don't collide and cleanup is targeted.
const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
const username = `itest_${suffix}`.slice(0, 30);
const email = `itest_${suffix}@example.com`;
const password = 'Password123';

/** Pull the `refreshToken=...` pair out of a Set-Cookie response header. */
function refreshCookie(res: Response): string {
  const set = res.headers['set-cookie'] as unknown as string[] | undefined;
  const raw = set?.find((c) => c.startsWith('refreshToken='));
  if (!raw) throw new Error('expected a refresh cookie to be set');
  return raw.split(';')[0]!;
}

describe('auth flow (integration)', () => {
  let userId: string | undefined;
  let registerCookie: string;
  let accessToken: string;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ firstName: 'Integration', lastName: 'Test', username, email, password });
    expect(res.status).toBe(201);
    userId = res.body.data.user.id as string;
    registerCookie = refreshCookie(res);
  });

  afterAll(async () => {
    // Cascades delete sessions + refresh tokens; audit rows null out (SetNull).
    if (userId) await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it('registers an account and returns a usable access token', () => {
    expect(userId).toBeTruthy();
    expect(registerCookie.startsWith('refreshToken=')).toBe(true);
  });

  it('logs in with the new credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: username, password });
    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toBeTruthy();
    accessToken = res.body.data.accessToken as string;
  });

  it('rejects bad credentials with 401', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: username, password: 'WrongPassword1' });
    expect(res.status).toBe(401);
  });

  it('authorizes /me with a valid access token', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.user.username).toBe(username);
  });

  it('rejects /me without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('rotates the refresh token on use', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').set('Cookie', registerCookie);
    expect(res.status).toBe(200);
    const rotated = refreshCookie(res);
    expect(rotated).not.toBe(registerCookie);
  });

  it('detects reuse of an already-rotated refresh token', async () => {
    // Reusing the original (now-rotated) cookie must be rejected as theft.
    const reuse = await request(app).post('/api/v1/auth/refresh').set('Cookie', registerCookie);
    expect(reuse.status).toBe(401);
  });

  it('revokes the session on logout', async () => {
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ identifier: username, password });
    const cookie = refreshCookie(login);

    const out = await request(app).post('/api/v1/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(200);

    // The refresh token tied to that session is dead after logout.
    const after = await request(app).post('/api/v1/auth/refresh').set('Cookie', cookie);
    expect(after.status).toBe(401);
  });
});
