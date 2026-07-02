import type { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const actorSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  profilePicture: true,
  verified: true,
} satisfies Prisma.UserSelect;

const withActor = { actor: { select: actorSelect } } satisfies Prisma.NotificationInclude;

export const notificationsRepository = {
  create(data: Prisma.NotificationCreateInput) {
    return prisma.notification.create({ data, include: withActor });
  },

  findById(id: string) {
    return prisma.notification.findUnique({ where: { id }, include: withActor });
  },

  list(recipientId: string, take: number, cursor?: string) {
    return prisma.notification.findMany({
      where: { recipientId },
      include: withActor,
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  },

  unreadCount(recipientId: string) {
    return prisma.notification.count({ where: { recipientId, isRead: false } });
  },

  markRead(id: string, recipientId: string) {
    return prisma.notification.updateMany({
      where: { id, recipientId },
      data: { isRead: true, readAt: new Date() },
    });
  },

  markAllRead(recipientId: string) {
    return prisma.notification.updateMany({
      where: { recipientId, isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
  },
};
