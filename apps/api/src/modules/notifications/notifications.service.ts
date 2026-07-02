import type { Notification, Prisma } from '@prisma/client';
import type { NotificationDTO, NotificationType, Paginated } from '@fbclone/types';
import { logger } from '../../lib/logger.js';
import { emitToUser } from '../../socket/index.js';
import { notificationsRepository } from './notifications.repository.js';

type NotificationWithActor = Notification & {
  actor: { id: string; firstName: string; lastName: string; username: string; profilePicture: string | null; verified: boolean } | null;
};

function toDTO(n: NotificationWithActor): NotificationDTO {
  return {
    id: n.id,
    type: n.type,
    actor: n.actor,
    message: n.message,
    link: n.link,
    entityType: n.entityType,
    entityId: n.entityId,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  };
}

interface CreateInput {
  recipientId: string;
  actorId?: string | null;
  type: NotificationType;
  message?: string;
  link?: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}

export const notificationsService = {
  /**
   * Create a notification and push it to the recipient in real time.
   * No-ops when the actor is the recipient (don't notify yourself).
   */
  async notify(input: CreateInput): Promise<void> {
    if (input.actorId && input.actorId === input.recipientId) return;
    try {
      const n = (await notificationsRepository.create({
        recipient: { connect: { id: input.recipientId } },
        ...(input.actorId ? { actor: { connect: { id: input.actorId } } } : {}),
        type: input.type,
        message: input.message,
        link: input.link,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata,
      })) as NotificationWithActor;

      emitToUser(input.recipientId, 'notification:new', toDTO(n));
      const unread = await notificationsRepository.unreadCount(input.recipientId);
      emitToUser(input.recipientId, 'notification:count', { unread });
    } catch (err) {
      logger.warn({ err, type: input.type }, 'Failed to create notification');
    }
  },

  async list(recipientId: string, cursor: string | undefined, limit: number): Promise<Paginated<NotificationDTO>> {
    const rows = (await notificationsRepository.list(recipientId, limit + 1, cursor)) as NotificationWithActor[];
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map(toDTO),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      hasMore,
    };
  },

  unreadCount(recipientId: string) {
    return notificationsRepository.unreadCount(recipientId);
  },

  async markRead(id: string, recipientId: string): Promise<void> {
    await notificationsRepository.markRead(id, recipientId);
    const unread = await notificationsRepository.unreadCount(recipientId);
    emitToUser(recipientId, 'notification:count', { unread });
  },

  async markAllRead(recipientId: string): Promise<void> {
    await notificationsRepository.markAllRead(recipientId);
    emitToUser(recipientId, 'notification:count', { unread: 0 });
  },
};
