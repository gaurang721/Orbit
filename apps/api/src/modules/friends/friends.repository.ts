import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

export const publicUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  profilePicture: true,
  coverPhoto: true,
  bio: true,
  verified: true,
  isOnline: true,
  lastSeenAt: true,
} satisfies Prisma.UserSelect;

export const friendsRepository = {
  findBetween(aId: string, bId: string) {
    return prisma.friendship.findFirst({
      where: {
        OR: [
          { requesterId: aId, addresseeId: bId },
          { requesterId: bId, addresseeId: aId },
        ],
      },
    });
  },

  findRequest(id: string) {
    return prisma.friendship.findUnique({ where: { id } });
  },

  create(requesterId: string, addresseeId: string) {
    return prisma.friendship.create({ data: { requesterId, addresseeId, status: 'PENDING' } });
  },

  accept(id: string) {
    return prisma.friendship.update({
      where: { id },
      data: { status: 'ACCEPTED', acceptedAt: new Date() },
    });
  },

  delete(id: string) {
    return prisma.friendship.delete({ where: { id } });
  },

  async isBlockedEitherWay(aId: string, bId: string) {
    const n = await prisma.block.count({
      where: {
        OR: [
          { blockerId: aId, blockedId: bId },
          { blockerId: bId, blockedId: aId },
        ],
      },
    });
    return n > 0;
  },

  async friendIds(userId: string): Promise<string[]> {
    const rows = await prisma.friendship.findMany({
      where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
      select: { requesterId: true, addresseeId: true },
    });
    return rows.map((r) => (r.requesterId === userId ? r.addresseeId : r.requesterId));
  },

  async listFriends(userId: string) {
    const rows = await prisma.friendship.findMany({
      where: { status: 'ACCEPTED', OR: [{ requesterId: userId }, { addresseeId: userId }] },
      include: {
        requester: { select: publicUserSelect },
        addressee: { select: publicUserSelect },
      },
      orderBy: { acceptedAt: 'desc' },
    });
    return rows.map((r) => (r.requesterId === userId ? r.addressee : r.requester));
  },

  listIncomingRequests(userId: string) {
    return prisma.friendship.findMany({
      where: { addresseeId: userId, status: 'PENDING' },
      include: { requester: { select: publicUserSelect } },
      orderBy: { createdAt: 'desc' },
    });
  },

  /** Everyone already connected to the user (any friendship status, or blocked). */
  async relatedUserIds(userId: string): Promise<string[]> {
    const [fs, bl] = await Promise.all([
      prisma.friendship.findMany({
        where: { OR: [{ requesterId: userId }, { addresseeId: userId }] },
        select: { requesterId: true, addresseeId: true },
      }),
      prisma.block.findMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
        select: { blockerId: true, blockedId: true },
      }),
    ]);
    const ids = new Set<string>();
    fs.forEach((f) => {
      ids.add(f.requesterId);
      ids.add(f.addresseeId);
    });
    bl.forEach((b) => {
      ids.add(b.blockerId);
      ids.add(b.blockedId);
    });
    ids.delete(userId);
    return [...ids];
  },

  suggestions(userId: string, excludeIds: string[], take: number) {
    return prisma.user.findMany({
      where: { id: { notIn: [...excludeIds, userId] }, isActive: true, isBanned: false },
      select: publicUserSelect,
      orderBy: { createdAt: 'desc' },
      take,
    });
  },

  // ----- Follows -------------------------------------------------------------
  follow(followerId: string, followingId: string) {
    return prisma.follow.upsert({
      where: { followerId_followingId: { followerId, followingId } },
      create: { followerId, followingId },
      update: {},
    });
  },

  unfollow(followerId: string, followingId: string) {
    return prisma.follow.deleteMany({ where: { followerId, followingId } });
  },

  async isFollowing(followerId: string, followingId: string) {
    return (
      (await prisma.follow.count({ where: { followerId, followingId } })) > 0
    );
  },
};
