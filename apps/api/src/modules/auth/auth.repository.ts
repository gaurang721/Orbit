import type { Prisma, RefreshToken, Session, User, VerificationToken } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

/**
 * Auth data-access layer. The service talks only to this repository, never to
 * Prisma directly — keeping persistence concerns isolated and swappable.
 */
export const authRepository = {
  // ----- Users ---------------------------------------------------------------
  findUserById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  findUserByEmail(email: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  },

  findUserByIdentifier(identifier: string): Promise<User | null> {
    const value = identifier.trim();
    return prisma.user.findFirst({
      where: {
        OR: [{ email: value.toLowerCase() }, { username: value }],
      },
    });
  },

  createUser(data: Prisma.UserCreateInput): Promise<User> {
    return prisma.user.create({ data });
  },

  updateUser(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    return prisma.user.update({ where: { id }, data });
  },

  async existsByEmail(email: string): Promise<boolean> {
    return (await prisma.user.count({ where: { email: email.toLowerCase() } })) > 0;
  },

  async existsByUsername(username: string): Promise<boolean> {
    return (await prisma.user.count({ where: { username } })) > 0;
  },

  async existsByPhone(phone: string): Promise<boolean> {
    return (await prisma.user.count({ where: { phone } })) > 0;
  },

  // ----- Sessions ------------------------------------------------------------
  createSession(data: Prisma.SessionCreateInput): Promise<Session> {
    return prisma.session.create({ data });
  },

  findSession(id: string): Promise<Session | null> {
    return prisma.session.findUnique({ where: { id } });
  },

  /** Session joined with its owner — used by the per-request auth guard. */
  findSessionWithUser(id: string): Promise<(Session & { user: User }) | null> {
    return prisma.session.findUnique({ where: { id }, include: { user: true } });
  },

  touchSession(id: string): Promise<Session> {
    return prisma.session.update({ where: { id }, data: { lastActiveAt: new Date() } });
  },

  revokeSession(id: string): Promise<Prisma.BatchPayload> {
    return prisma.session.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  listSessions(userId: string): Promise<Session[]> {
    return prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { lastActiveAt: 'desc' },
    });
  },

  async revokeAllSessions(userId: string, exceptSessionId?: string): Promise<void> {
    await prisma.session.updateMany({
      where: { userId, revokedAt: null, ...(exceptSessionId ? { id: { not: exceptSessionId } } : {}) },
      data: { revokedAt: new Date() },
    });
  },

  // ----- Refresh tokens ------------------------------------------------------
  createRefreshToken(data: Prisma.RefreshTokenCreateInput): Promise<RefreshToken> {
    return prisma.refreshToken.create({ data });
  },

  findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    return prisma.refreshToken.findUnique({ where: { tokenHash } });
  },

  /** Rotate a refresh token: revoke the old one and link it to its successor. */
  async rotateRefreshToken(
    oldTokenId: string,
    newToken: Prisma.RefreshTokenCreateInput,
  ): Promise<RefreshToken> {
    return prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({ data: newToken });
      await tx.refreshToken.update({
        where: { id: oldTokenId },
        data: { revokedAt: new Date(), replacedById: created.id },
      });
      return created;
    });
  },

  async revokeRefreshTokensForSession(sessionId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },

  // ----- Verification tokens -------------------------------------------------
  createVerificationToken(data: Prisma.VerificationTokenCreateInput): Promise<VerificationToken> {
    return prisma.verificationToken.create({ data });
  },

  findVerificationByHash(tokenHash: string): Promise<VerificationToken | null> {
    return prisma.verificationToken.findUnique({ where: { tokenHash } });
  },

  consumeVerificationToken(id: string): Promise<VerificationToken> {
    return prisma.verificationToken.update({
      where: { id },
      data: { consumedAt: new Date() },
    });
  },

  async deleteVerificationTokens(
    userId: string,
    type: VerificationToken['type'],
  ): Promise<void> {
    await prisma.verificationToken.deleteMany({ where: { userId, type } });
  },
};

export type AuthRepository = typeof authRepository;
