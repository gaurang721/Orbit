import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const userRefSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  profilePicture: true,
  verified: true,
} satisfies Prisma.UserSelect;

const withAuthor = { author: { select: userRefSelect } } satisfies Prisma.StoryInclude;

export const storiesRepository = {
  create(data: Prisma.StoryCreateInput) {
    return prisma.story.create({ data, include: withAuthor });
  },

  findById(id: string) {
    return prisma.story.findUnique({ where: { id }, include: withAuthor });
  },

  activeForAuthors(authorIds: string[], now: Date) {
    return prisma.story.findMany({
      where: { authorId: { in: authorIds }, expiresAt: { gt: now } },
      include: withAuthor,
      orderBy: { createdAt: 'asc' },
    });
  },

  async viewedStoryIds(viewerId: string, storyIds: string[]): Promise<Set<string>> {
    if (storyIds.length === 0) return new Set();
    const rows = await prisma.storyView.findMany({
      where: { viewerId, storyId: { in: storyIds } },
      select: { storyId: true },
    });
    return new Set(rows.map((r) => r.storyId));
  },

  recordView(storyId: string, viewerId: string) {
    return prisma.$transaction(async (tx) => {
      await tx.storyView.upsert({
        where: { storyId_viewerId: { storyId, viewerId } },
        create: { storyId, viewerId },
        update: {},
      });
      const count = await tx.storyView.count({ where: { storyId } });
      await tx.story.update({ where: { id: storyId }, data: { viewCount: count } });
    });
  },

  async listViewers(storyId: string) {
    const [views, reactions] = await Promise.all([
      prisma.storyView.findMany({
        where: { storyId },
        include: { viewer: { select: userRefSelect } },
        orderBy: { viewedAt: 'desc' },
      }),
      prisma.storyReaction.findMany({ where: { storyId }, select: { userId: true, emoji: true } }),
    ]);
    const emojiByUser = new Map(reactions.map((r) => [r.userId, r.emoji]));
    return views.map((v) => ({ viewer: v.viewer, viewedAt: v.viewedAt, emoji: emojiByUser.get(v.viewerId) ?? null }));
  },

  react(storyId: string, userId: string, emoji: string) {
    return prisma.storyReaction.upsert({
      where: { storyId_userId: { storyId, userId } },
      create: { storyId, userId, emoji },
      update: { emoji },
    });
  },

  delete(id: string) {
    return prisma.story.delete({ where: { id } });
  },

  deleteExpired(now: Date) {
    return prisma.story.deleteMany({ where: { expiresAt: { lt: now } } });
  },
};
