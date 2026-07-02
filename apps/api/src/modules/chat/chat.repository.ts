import type { MediaType, MessageType, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';

const userRefSelect = {
  id: true,
  firstName: true,
  lastName: true,
  username: true,
  profilePicture: true,
  verified: true,
} satisfies Prisma.UserSelect;

const memberInclude = {
  members: { include: { user: { select: { ...userRefSelect, isOnline: true } } } },
} satisfies Prisma.ConversationInclude;

// Voice notes / files attach Media rows; surface the slim fields the client needs.
// For FILE attachments `size` + `altText` (original filename) drive the file card.
const messageInclude = {
  sender: { select: userRefSelect },
  attachments: {
    select: { id: true, type: true, url: true, mimeType: true, duration: true, size: true, altText: true },
    orderBy: { position: 'asc' },
  },
  reactions: { select: { emoji: true, userId: true } },
} satisfies Prisma.MessageInclude;

export const chatRepository = {
  /** Find an existing 1:1 conversation between two users, or null. */
  findDirect(aId: string, bId: string) {
    return prisma.conversation.findFirst({
      where: {
        isGroup: false,
        AND: [{ members: { some: { userId: aId } } }, { members: { some: { userId: bId } } }],
      },
      include: memberInclude,
    });
  },

  createDirect(aId: string, bId: string) {
    return prisma.conversation.create({
      data: {
        isGroup: false,
        createdById: aId,
        members: { create: [{ userId: aId }, { userId: bId }] },
      },
      include: memberInclude,
    });
  },

  getById(id: string) {
    return prisma.conversation.findUnique({ where: { id }, include: memberInclude });
  },

  /** Create a named group conversation with the creator (ADMIN) + the given members. */
  createGroup(creatorId: string, name: string, memberIds: string[]) {
    const others = Array.from(new Set(memberIds)).filter((id) => id !== creatorId);
    return prisma.conversation.create({
      data: {
        isGroup: true,
        name,
        createdById: creatorId,
        members: {
          create: [
            { userId: creatorId, role: 'ADMIN' },
            ...others.map((userId) => ({ userId, role: 'MEMBER' as const })),
          ],
        },
      },
      include: memberInclude,
    });
  },

  /** Rename a group conversation. */
  renameConversation(id: string, name: string) {
    return prisma.conversation.update({ where: { id }, data: { name }, include: memberInclude });
  },

  /** Add members to a group (idempotent — skips anyone already in it). */
  addMembers(conversationId: string, userIds: string[]) {
    return prisma.conversationMember.createMany({
      data: userIds.map((userId) => ({ conversationId, userId, role: 'MEMBER' as const })),
      skipDuplicates: true,
    });
  },

  /** Remove a single member from a conversation. */
  removeMember(conversationId: string, userId: string) {
    return prisma.conversationMember.deleteMany({ where: { conversationId, userId } });
  },

  /** Count remaining members (used to tear down an empty group after the last leaves). */
  memberCount(conversationId: string) {
    return prisma.conversationMember.count({ where: { conversationId } });
  },

  deleteConversation(id: string) {
    return prisma.conversation.delete({ where: { id } });
  },

  /** All members of a conversation with role + presence, oldest first. */
  listMembers(conversationId: string) {
    return prisma.conversationMember.findMany({
      where: { conversationId },
      include: { user: { select: { ...userRefSelect, isOnline: true } } },
      orderBy: { joinedAt: 'asc' },
    });
  },

  /** True if either user has blocked the other. */
  async isBlockedBetween(a: string, b: string) {
    return (
      (await prisma.block.count({
        where: { OR: [{ blockerId: a, blockedId: b }, { blockerId: b, blockedId: a }] },
      })) > 0
    );
  },

  /** Of the given user ids, return those that actually exist. */
  existingUserIds(ids: string[]) {
    return prisma.user
      .findMany({ where: { id: { in: ids } }, select: { id: true } })
      .then((rows) => rows.map((r) => r.id));
  },

  listForUser(userId: string) {
    return prisma.conversation.findMany({
      // Include freshly-started conversations that have no messages yet so the
      // user can open them and send the first message. Empty ones (null
      // lastMessageAt) sort to the bottom.
      where: { members: { some: { userId } } },
      include: {
        ...memberInclude,
        messages: { orderBy: { createdAt: 'desc' }, take: 1, include: { sender: { select: userRefSelect } } },
      },
      orderBy: [{ lastMessageAt: { sort: 'desc', nulls: 'last' } }, { createdAt: 'desc' }],
      take: 50,
    });
  },

  async isMember(conversationId: string, userId: string) {
    return (await prisma.conversationMember.count({ where: { conversationId, userId } })) > 0;
  },

  getMember(conversationId: string, userId: string) {
    return prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
  },

  otherMemberIds(conversationId: string, exceptUserId: string) {
    return prisma.conversationMember
      .findMany({ where: { conversationId, userId: { not: exceptUserId } }, select: { userId: true } })
      .then((rows) => rows.map((r) => r.userId));
  },

  /** Resolve @mention handles to the ids of members in this conversation (case-insensitive). */
  async mentionTargets(conversationId: string, exceptUserId: string, handles: string[]): Promise<string[]> {
    if (handles.length === 0) return [];
    const rows = await prisma.conversationMember.findMany({
      where: { conversationId, userId: { not: exceptUserId } },
      select: { userId: true, user: { select: { username: true } } },
    });
    const wanted = new Set(handles.map((h) => h.toLowerCase()));
    return rows.filter((r) => wanted.has(r.user.username.toLowerCase())).map((r) => r.userId);
  },

  /** A single message with the bits needed to copy it when forwarding. */
  getMessageById(id: string) {
    return prisma.message.findUnique({
      where: { id },
      include: {
        attachments: {
          select: { type: true, url: true, mimeType: true, size: true, duration: true, altText: true },
          orderBy: { position: 'asc' },
        },
      },
    });
  },

  listMessages(conversationId: string, take: number, cursor?: string) {
    // Deleted messages stay in the thread as tombstones ("unsent") — the
    // service strips their content. Unread counts still ignore them.
    return prisma.message.findMany({
      where: { conversationId },
      include: messageInclude,
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  },

  /**
   * Overwrite a message's content in place (used for live-location position
   * pings + stop). Deliberately does NOT touch lastMessageAt so a live share
   * doesn't keep re-sorting the conversation list on every update.
   */
  setMessageContent(id: string, content: string) {
    return prisma.message.update({ where: { id }, data: { content }, include: messageInclude });
  },

  /** Soft-delete ("unsend") a message for everyone: tombstone + strip content. */
  softDeleteMessage(id: string) {
    return prisma.$transaction(async (tx) => {
      // Drop any attached media so files can't be fetched after deletion.
      await tx.media.deleteMany({ where: { messageId: id } });
      return tx.message.update({
        where: { id },
        data: { deletedAt: new Date(), content: null, voiceDuration: null },
        include: messageInclude,
      });
    });
  },

  async createMessage(conversationId: string, senderId: string, content: string) {
    return prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: { conversationId, senderId, content, type: 'TEXT' },
        include: messageInclude,
      });
      await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: message.createdAt } });
      // sender has implicitly read their own message
      await tx.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: senderId } },
        data: { lastReadAt: message.createdAt },
      });
      return message;
    });
  },

  /** Create a SYSTEM message (e.g. a call log) and bump the conversation. */
  async createSystemMessage(conversationId: string, senderId: string, content: string) {
    return prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: { conversationId, senderId, content, type: 'SYSTEM' },
        include: messageInclude,
      });
      await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: message.createdAt } });
      // The caller has implicitly "read" the log they just created.
      await tx.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: senderId } },
        data: { lastReadAt: message.createdAt },
      });
      return message;
    });
  },

  /** Copy a source message into another conversation, recording the link. */
  async forwardMessage(
    targetConversationId: string,
    senderId: string,
    source: {
      id: string;
      type: MessageType;
      content: string | null;
      voiceDuration: number | null;
      attachments: Array<{ type: MediaType; url: string; mimeType: string | null; size: number | null; duration: number | null; altText: string | null }>;
    },
  ) {
    return prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId: targetConversationId,
          senderId,
          type: source.type,
          content: source.content,
          voiceDuration: source.voiceDuration,
          forwardedFromId: source.id,
          ...(source.attachments.length
            ? {
                attachments: {
                  create: source.attachments.map((a) => ({
                    uploaderId: senderId,
                    type: a.type,
                    url: a.url,
                    mimeType: a.mimeType,
                    size: a.size,
                    duration: a.duration,
                    altText: a.altText,
                  })),
                },
              }
            : {}),
        },
        include: messageInclude,
      });
      await tx.conversation.update({ where: { id: targetConversationId }, data: { lastMessageAt: message.createdAt } });
      await tx.conversationMember.update({
        where: { conversationId_userId: { conversationId: targetConversationId, userId: senderId } },
        data: { lastReadAt: message.createdAt },
      });
      return message;
    });
  },

  /** Create a VOICE message with an attached AUDIO Media row. */
  async createVoiceMessage(
    conversationId: string,
    senderId: string,
    audio: { url: string; mimeType: string; size: number; duration: number },
  ) {
    return prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId,
          senderId,
          type: 'VOICE',
          voiceDuration: audio.duration,
          attachments: {
            create: {
              uploader: { connect: { id: senderId } },
              type: 'AUDIO',
              url: audio.url,
              mimeType: audio.mimeType,
              size: audio.size,
              duration: audio.duration,
            },
          },
        },
        include: messageInclude,
      });
      await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: message.createdAt } });
      await tx.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: senderId } },
        data: { lastReadAt: message.createdAt },
      });
      return message;
    });
  },

  /** Create a FILE message with an attached FILE Media row (name held in altText). */
  async createFileMessage(
    conversationId: string,
    senderId: string,
    file: { url: string; mimeType: string; size: number; fileName: string },
  ) {
    return prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId,
          senderId,
          type: 'FILE',
          attachments: {
            create: {
              uploader: { connect: { id: senderId } },
              type: 'FILE',
              url: file.url,
              mimeType: file.mimeType,
              size: file.size,
              altText: file.fileName,
            },
          },
        },
        include: messageInclude,
      });
      await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: message.createdAt } });
      await tx.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: senderId } },
        data: { lastReadAt: message.createdAt },
      });
      return message;
    });
  },

  /** Create an IMAGE/VIDEO message with an attached Media row of that type. */
  async createMediaMessage(
    conversationId: string,
    senderId: string,
    media: { url: string; mimeType: string; size: number; mediaType: 'IMAGE' | 'VIDEO' },
  ) {
    return prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId,
          senderId,
          type: media.mediaType, // MessageType IMAGE | VIDEO
          attachments: {
            create: {
              uploader: { connect: { id: senderId } },
              type: media.mediaType, // MediaType IMAGE | VIDEO
              url: media.url,
              mimeType: media.mimeType,
              size: media.size,
            },
          },
        },
        include: messageInclude,
      });
      await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: message.createdAt } });
      await tx.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId: senderId } },
        data: { lastReadAt: message.createdAt },
      });
      return message;
    });
  },

  /** Call-log SYSTEM messages across all the user's conversations, newest first. */
  listCallLogs(userId: string, take: number) {
    return prisma.message.findMany({
      where: {
        type: 'SYSTEM',
        deletedAt: null,
        content: { contains: '__call' },
        conversation: { members: { some: { userId } } },
      },
      include: {
        sender: { select: userRefSelect },
        conversation: { include: memberInclude },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });
  },

  // ----- Message reactions ---------------------------------------------------
  findMessageById(id: string) {
    return prisma.message.findUnique({ where: { id }, include: messageInclude });
  },

  setMessageReaction(messageId: string, userId: string, emoji: string) {
    return prisma.messageReaction.upsert({
      where: { messageId_userId: { messageId, userId } },
      create: { messageId, userId, emoji },
      update: { emoji },
    });
  },

  removeMessageReaction(messageId: string, userId: string) {
    return prisma.messageReaction.deleteMany({ where: { messageId, userId } });
  },

  markRead(conversationId: string, userId: string) {
    return prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
  },

  unreadCount(conversationId: string, userId: string, after: Date | null) {
    return prisma.message.count({
      where: {
        conversationId,
        senderId: { not: userId },
        deletedAt: null,
        ...(after ? { createdAt: { gt: after } } : {}),
      },
    });
  },
};
