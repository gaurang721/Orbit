import type { CallHistoryDTO, CallLogInput, ConversationDTO, ConversationMemberDTO, MessageDTO, Paginated, ShareLocationInput, UpdateLiveLocationInput, UserRef } from '@fbclone/types';
import { encodeCallLog, encodeLocation, parseCallLog, parseLocation } from '@fbclone/types';
import { errors } from '../../utils/http-error.js';
import { emitToUser } from '../../socket/index.js';
import { extractMentions } from '../../lib/text-parse.js';
import { notificationsService } from '../notifications/notifications.service.js';
import { chatRepository } from './chat.repository.js';

type ConvWithMembers = NonNullable<Awaited<ReturnType<typeof chatRepository.getById>>>;
type MessageRow = Awaited<ReturnType<typeof chatRepository.createMessage>>;

function toUserRef(u: { id: string; firstName: string; lastName: string; username: string; profilePicture: string | null; verified: boolean }): UserRef {
  return { id: u.id, firstName: u.firstName, lastName: u.lastName, username: u.username, profilePicture: u.profilePicture, verified: u.verified };
}

/** Group raw message reactions into per-emoji counts + whether the viewer reacted. */
function aggregateReactions(
  rows: Array<{ emoji: string; userId: string }>,
  meId: string,
): MessageDTO['reactions'] {
  const byEmoji = new Map<string, { count: number; reactedByMe: boolean }>();
  for (const r of rows) {
    const e = byEmoji.get(r.emoji) ?? { count: 0, reactedByMe: false };
    e.count += 1;
    if (r.userId === meId) e.reactedByMe = true;
    byEmoji.set(r.emoji, e);
  }
  return [...byEmoji.entries()].map(([emoji, v]) => ({ emoji, count: v.count, reactedByMe: v.reactedByMe }));
}

function mapMessage(m: MessageRow, meId: string): MessageDTO {
  const deleted = m.deletedAt != null;
  // A shared location is encoded as JSON in `content`; surface it as a typed
  // field and hide the raw blob from the plain-text `content`.
  const location = deleted ? null : parseLocation(m.content);
  return {
    id: m.id,
    conversationId: m.conversationId,
    sender: toUserRef(m.sender),
    // A deleted message is a tombstone — never surface its old content/media.
    content: deleted || location ? null : m.content,
    type: m.type,
    voiceDuration: deleted ? null : (m.voiceDuration ?? null),
    attachments: deleted
      ? []
      : (m.attachments ?? []).map((a) => ({
          id: a.id,
          type: a.type,
          url: a.url,
          mimeType: a.mimeType,
          duration: a.duration ?? null,
          size: a.size ?? null,
          fileName: a.altText ?? null,
        })),
    reactions: deleted ? [] : aggregateReactions(m.reactions ?? [], meId),
    location,
    forwarded: !deleted && m.forwardedFromId != null,
    deleted,
    createdAt: m.createdAt.toISOString(),
    isOwn: m.senderId === meId,
  };
}

export const chatService = {
  async startDirect(meId: string, otherId: string): Promise<ConversationDTO> {
    if (meId === otherId) throw errors.badRequest('You cannot message yourself');
    if (await chatRepository.isBlockedBetween(meId, otherId)) {
      throw errors.forbidden('You cannot message this user');
    }
    const existing = await chatRepository.findDirect(meId, otherId);
    const conv = existing ?? (await chatRepository.createDirect(meId, otherId));
    return this.mapConversation(conv, meId, 0, null);
  },

  /** Create a named group chat with the creator plus the chosen members. */
  async createGroup(meId: string, name: string, memberIds: string[]): Promise<ConversationDTO> {
    const others = Array.from(new Set(memberIds)).filter((id) => id !== meId);
    const valid = await chatRepository.existingUserIds(others);
    if (valid.length < 2) throw errors.badRequest('Pick at least 2 people for a group');
    const conv = await chatRepository.createGroup(meId, name.trim(), valid);

    // Let the new members see the group appear in their list immediately.
    for (const uid of valid) emitToUser(uid, 'conversation:updated', { conversationId: conv.id });
    return this.mapConversation(conv, meId, 0, null);
  },

  /** A group conversation the viewer belongs to, or throw. Returns members too. */
  async requireGroupMembership(meId: string, conversationId: string) {
    const conv = await chatRepository.getById(conversationId);
    if (!conv || !conv.isGroup) throw errors.notFound('Group not found');
    if (!conv.members.some((m) => m.userId === meId)) throw errors.forbidden('Not in this conversation');
    return conv;
  },

  /** True if the viewer can manage the group (admin, or the original creator). */
  isGroupAdmin(conv: ConvWithMembers, meId: string): boolean {
    const me = conv.members.find((m) => m.userId === meId);
    return me?.role === 'ADMIN' || conv.createdById === meId;
  },

  /** Rename a group (any member). */
  async renameGroup(meId: string, conversationId: string, name: string): Promise<void> {
    await this.requireGroupMembership(meId, conversationId);
    const updated = await chatRepository.renameConversation(conversationId, name.trim());
    for (const m of updated.members) emitToUser(m.userId, 'conversation:updated', { conversationId });
  },

  /** Add members to a group (any member can add). */
  async addGroupMembers(meId: string, conversationId: string, memberIds: string[]): Promise<void> {
    const conv = await this.requireGroupMembership(meId, conversationId);
    const current = new Set(conv.members.map((m) => m.userId));
    const requested = Array.from(new Set(memberIds)).filter((id) => id !== meId && !current.has(id));
    const valid = await chatRepository.existingUserIds(requested);
    if (valid.length === 0) throw errors.badRequest('No new members to add');
    await chatRepository.addMembers(conversationId, valid);
    // Notify everyone (existing + newly added) so their lists refresh.
    for (const uid of [...current, ...valid]) emitToUser(uid, 'conversation:updated', { conversationId });
  },

  /** Remove a member from a group (admins/creator only). */
  async removeGroupMember(meId: string, conversationId: string, targetUserId: string): Promise<void> {
    const conv = await this.requireGroupMembership(meId, conversationId);
    if (!this.isGroupAdmin(conv, meId)) throw errors.forbidden('Only group admins can remove members');
    if (targetUserId === meId) throw errors.badRequest('Use leave to remove yourself');
    if (!conv.members.some((m) => m.userId === targetUserId)) throw errors.notFound('Member not found');
    await chatRepository.removeMember(conversationId, targetUserId);
    // Notify the removed user too so the group disappears from their list.
    for (const m of conv.members) emitToUser(m.userId, 'conversation:updated', { conversationId });
  },

  /** Leave a group. Deletes the conversation once the last member leaves. */
  async leaveGroup(meId: string, conversationId: string): Promise<void> {
    const conv = await this.requireGroupMembership(meId, conversationId);
    await chatRepository.removeMember(conversationId, meId);
    const remaining = await chatRepository.memberCount(conversationId);
    if (remaining === 0) {
      await chatRepository.deleteConversation(conversationId);
    } else {
      for (const m of conv.members) emitToUser(m.userId, 'conversation:updated', { conversationId });
    }
  },

  /** All members of a group, with role + presence (for the group-info panel). */
  async listMembers(meId: string, conversationId: string): Promise<ConversationMemberDTO[]> {
    const conv = await this.requireGroupMembership(meId, conversationId);
    const rows = await chatRepository.listMembers(conversationId);
    return rows.map((m) => ({
      ...toUserRef(m.user),
      role: m.role === 'ADMIN' || conv.createdById === m.userId ? 'ADMIN' : 'MEMBER',
      isOnline: m.user.isOnline,
      isMe: m.userId === meId,
    }));
  },

  mapConversation(
    conv: ConvWithMembers,
    meId: string,
    unreadCount: number,
    lastMessage: ConversationDTO['lastMessage'],
  ): ConversationDTO {
    const otherMembers = conv.members.filter((m) => m.userId !== meId);
    const otherMember = otherMembers[0] ?? null;
    const other = otherMember?.user ?? null;
    const myMember = conv.members.find((m) => m.userId === meId) ?? null;
    // The group creator is treated as an admin even if their stored role predates
    // admin assignment (older groups seeded everyone as MEMBER).
    const myRole = !conv.isGroup
      ? null
      : myMember?.role === 'ADMIN' || conv.createdById === meId
        ? 'ADMIN'
        : 'MEMBER';
    return {
      id: conv.id,
      isGroup: conv.isGroup,
      name: conv.name,
      // A 1:1 conversation has a single "other user"; groups have none.
      otherUser: conv.isGroup ? null : other ? toUserRef(other) : null,
      otherOnline: conv.isGroup ? false : (other?.isOnline ?? false),
      members: otherMembers.map((m) => toUserRef(m.user)),
      myRole,
      lastMessage,
      lastMessageAt: conv.lastMessageAt ? conv.lastMessageAt.toISOString() : null,
      unreadCount,
      // Seen receipts are a 1:1 concept (one reader); skip for groups.
      otherLastReadAt:
        conv.isGroup || !otherMember?.lastReadAt ? null : otherMember.lastReadAt.toISOString(),
    };
  },

  async listConversations(meId: string): Promise<ConversationDTO[]> {
    const convs = await chatRepository.listForUser(meId);
    return Promise.all(
      convs.map(async (c) => {
        const myMember = c.members.find((m) => m.userId === meId);
        const unread = await chatRepository.unreadCount(c.id, meId, myMember?.lastReadAt ?? null);
        const last = c.messages[0];
        const lastDeleted = last?.deletedAt != null;
        const lastMessage = last
          ? {
              id: last.id,
              content: lastDeleted ? null : last.content,
              type: last.type,
              senderId: last.senderId,
              deleted: lastDeleted,
              createdAt: last.createdAt.toISOString(),
            }
          : null;
        return this.mapConversation(c, meId, unread, lastMessage);
      }),
    );
  },

  async listMessages(meId: string, conversationId: string, cursor: string | undefined, limit: number): Promise<Paginated<MessageDTO>> {
    if (!(await chatRepository.isMember(conversationId, meId))) throw errors.forbidden('Not in this conversation');
    const rows = await chatRepository.listMessages(conversationId, limit + 1, cursor);
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      items: page.map((m) => mapMessage(m as MessageRow, meId)),
      nextCursor: hasMore ? (page[page.length - 1]?.id ?? null) : null,
      hasMore,
    };
  },

  async sendMessage(meId: string, conversationId: string, content: string): Promise<MessageDTO> {
    if (!(await chatRepository.isMember(conversationId, meId))) throw errors.forbidden('Not in this conversation');
    const trimmed = content.trim();
    const message = await chatRepository.createMessage(conversationId, meId, trimmed);
    const dto = mapMessage(message, meId);

    // Push to the other participants in real time (their own isOwn=false).
    const others = await chatRepository.otherMemberIds(conversationId, meId);
    for (const uid of others) {
      emitToUser(uid, 'message:new', { ...dto, isOwn: false });
      emitToUser(uid, 'conversation:updated', { conversationId });
    }

    // Notify any @mentioned members of this conversation.
    await this.notifyMentions(meId, conversationId, message.id, trimmed);
    return dto;
  },

  /** Send a MENTION notification to each conversation member @mentioned in the text. */
  async notifyMentions(meId: string, conversationId: string, messageId: string, content: string): Promise<void> {
    if (!content.includes('@')) return;
    const handles = extractMentions(content);
    if (handles.length === 0) return;
    const targets = await chatRepository.mentionTargets(conversationId, meId, handles);
    for (const uid of targets) {
      await notificationsService.notify({
        recipientId: uid,
        actorId: meId,
        type: 'MENTION',
        message: 'mentioned you in a chat',
        link: `/messages?c=${conversationId}`,
        entityType: 'Message',
        entityId: messageId,
      });
    }
  },

  async sendVoiceMessage(
    meId: string,
    conversationId: string,
    audio: { url: string; mimeType: string; size: number; duration: number },
  ): Promise<MessageDTO> {
    if (!(await chatRepository.isMember(conversationId, meId))) throw errors.forbidden('Not in this conversation');
    const message = await chatRepository.createVoiceMessage(conversationId, meId, audio);
    const dto = mapMessage(message, meId);

    const others = await chatRepository.otherMemberIds(conversationId, meId);
    for (const uid of others) {
      emitToUser(uid, 'message:new', { ...dto, isOwn: false });
      emitToUser(uid, 'conversation:updated', { conversationId });
    }
    return dto;
  },

  async sendFileMessage(
    meId: string,
    conversationId: string,
    file: { url: string; mimeType: string; size: number; fileName: string },
  ): Promise<MessageDTO> {
    if (!(await chatRepository.isMember(conversationId, meId))) throw errors.forbidden('Not in this conversation');
    const message = await chatRepository.createFileMessage(conversationId, meId, file);
    const dto = mapMessage(message, meId);

    const others = await chatRepository.otherMemberIds(conversationId, meId);
    for (const uid of others) {
      emitToUser(uid, 'message:new', { ...dto, isOwn: false });
      emitToUser(uid, 'conversation:updated', { conversationId });
    }
    return dto;
  },

  async sendMediaMessage(
    meId: string,
    conversationId: string,
    media: { url: string; mimeType: string; size: number; mediaType: 'IMAGE' | 'VIDEO' },
  ): Promise<MessageDTO> {
    if (!(await chatRepository.isMember(conversationId, meId))) throw errors.forbidden('Not in this conversation');
    const message = await chatRepository.createMediaMessage(conversationId, meId, media);
    const dto = mapMessage(message, meId);

    const others = await chatRepository.otherMemberIds(conversationId, meId);
    for (const uid of others) {
      emitToUser(uid, 'message:new', { ...dto, isOwn: false });
      emitToUser(uid, 'conversation:updated', { conversationId });
    }
    return dto;
  },

  /**
   * Share a geographic location as a message. With `liveDurationMinutes` it
   * starts a LIVE share that keeps updating until it expires or is stopped;
   * otherwise it's a one-off static pin. Encoded into a normal message.
   */
  async sendLocation(meId: string, conversationId: string, input: ShareLocationInput): Promise<MessageDTO> {
    if (!(await chatRepository.isMember(conversationId, meId))) throw errors.forbidden('Not in this conversation');
    const live = input.liveDurationMinutes != null;
    const now = new Date();
    const message = await chatRepository.createMessage(
      conversationId,
      meId,
      encodeLocation({
        latitude: input.latitude,
        longitude: input.longitude,
        label: input.label ?? null,
        live,
        expiresAt: live ? new Date(now.getTime() + input.liveDurationMinutes! * 60_000).toISOString() : null,
        endedAt: null,
        updatedAt: live ? now.toISOString() : null,
      }),
    );
    const dto = mapMessage(message, meId);

    const others = await chatRepository.otherMemberIds(conversationId, meId);
    for (const uid of others) {
      emitToUser(uid, 'message:new', { ...dto, isOwn: false });
      emitToUser(uid, 'conversation:updated', { conversationId });
    }
    return dto;
  },

  /** Push a fresh position into an active live-location share (owner only). */
  async updateLiveLocation(
    meId: string,
    messageId: string,
    input: UpdateLiveLocationInput,
  ): Promise<MessageDTO> {
    const existing = await chatRepository.getMessageById(messageId);
    if (!existing || existing.deletedAt) throw errors.notFound('Location not found');
    if (existing.senderId !== meId) throw errors.forbidden('You can only update your own location');
    const loc = parseLocation(existing.content);
    if (!loc || !loc.live) throw errors.badRequest('Not a live location');
    if (loc.endedAt || (loc.expiresAt && new Date(loc.expiresAt).getTime() <= Date.now())) {
      throw errors.badRequest('This live location has ended');
    }

    const updatedAt = new Date().toISOString();
    const message = await chatRepository.setMessageContent(
      messageId,
      encodeLocation({ ...loc, latitude: input.latitude, longitude: input.longitude, updatedAt }),
    );
    const dto = mapMessage(message, meId);

    // Push just the moving coordinates to the others (no conversation reorder).
    const others = await chatRepository.otherMemberIds(existing.conversationId, meId);
    for (const uid of others) {
      emitToUser(uid, 'location:update', {
        conversationId: existing.conversationId,
        messageId,
        latitude: input.latitude,
        longitude: input.longitude,
        updatedAt,
      });
    }
    return dto;
  },

  /** End a live-location share early (owner only). */
  async stopLiveLocation(meId: string, messageId: string): Promise<MessageDTO> {
    const existing = await chatRepository.getMessageById(messageId);
    if (!existing || existing.deletedAt) throw errors.notFound('Location not found');
    if (existing.senderId !== meId) throw errors.forbidden('You can only stop your own location');
    const loc = parseLocation(existing.content);
    if (!loc || !loc.live) throw errors.badRequest('Not a live location');

    const endedAt = loc.endedAt ?? new Date().toISOString();
    const message = await chatRepository.setMessageContent(messageId, encodeLocation({ ...loc, endedAt }));
    const dto = mapMessage(message, meId);

    const others = await chatRepository.otherMemberIds(existing.conversationId, meId);
    for (const uid of others) {
      emitToUser(uid, 'location:ended', { conversationId: existing.conversationId, messageId, endedAt });
      emitToUser(uid, 'conversation:updated', { conversationId: existing.conversationId });
    }
    return dto;
  },

  async forwardMessage(meId: string, targetConversationId: string, messageId: string): Promise<MessageDTO> {
    if (!(await chatRepository.isMember(targetConversationId, meId))) throw errors.forbidden('Not in this conversation');
    const source = await chatRepository.getMessageById(messageId);
    if (!source || source.deletedAt) throw errors.notFound('Message not found');
    // You can only forward a message from a conversation you're part of.
    if (!(await chatRepository.isMember(source.conversationId, meId))) {
      throw errors.forbidden('You cannot forward this message');
    }

    const message = await chatRepository.forwardMessage(targetConversationId, meId, source);
    const dto = mapMessage(message, meId);

    const others = await chatRepository.otherMemberIds(targetConversationId, meId);
    for (const uid of others) {
      emitToUser(uid, 'message:new', { ...dto, isOwn: false });
      emitToUser(uid, 'conversation:updated', { conversationId: targetConversationId });
    }
    return dto;
  },

  /** Add/replace the viewer's reaction (one emoji per user) on a message. */
  async reactToMessage(meId: string, messageId: string, emoji: string): Promise<MessageDTO> {
    const msg = await chatRepository.getMessageById(messageId);
    if (!msg || msg.deletedAt) throw errors.notFound('Message not found');
    if (!(await chatRepository.isMember(msg.conversationId, meId))) throw errors.forbidden('Not in this conversation');
    await chatRepository.setMessageReaction(messageId, meId, emoji);
    return this.emitReactionUpdate(msg.conversationId, messageId, meId);
  },

  /** Remove the viewer's reaction from a message. */
  async unreactMessage(meId: string, messageId: string): Promise<MessageDTO> {
    const msg = await chatRepository.getMessageById(messageId);
    if (!msg) throw errors.notFound('Message not found');
    if (!(await chatRepository.isMember(msg.conversationId, meId))) throw errors.forbidden('Not in this conversation');
    await chatRepository.removeMessageReaction(messageId, meId);
    return this.emitReactionUpdate(msg.conversationId, messageId, meId);
  },

  async emitReactionUpdate(conversationId: string, messageId: string, meId: string): Promise<MessageDTO> {
    const fresh = await chatRepository.findMessageById(messageId);
    const dto = mapMessage(fresh!, meId);
    // Others recompute their own reactedByMe by refetching the thread.
    const others = await chatRepository.otherMemberIds(conversationId, meId);
    for (const uid of others) emitToUser(uid, 'message:reaction', { conversationId, messageId });
    return dto;
  },

  /** Unsend (delete for everyone) a message you sent. */
  async deleteMessage(meId: string, messageId: string): Promise<MessageDTO> {
    const existing = await chatRepository.getMessageById(messageId);
    if (!existing) throw errors.notFound('Message not found');
    if (existing.senderId !== meId) throw errors.forbidden('You can only delete your own messages');

    const message = await chatRepository.softDeleteMessage(messageId);
    const dto = mapMessage(message, meId);

    const others = await chatRepository.otherMemberIds(message.conversationId, meId);
    for (const uid of others) {
      emitToUser(uid, 'message:deleted', { messageId, conversationId: message.conversationId });
      emitToUser(uid, 'conversation:updated', { conversationId: message.conversationId });
    }
    return dto;
  },

  /** Record a finished call as a SYSTEM message visible to both participants. */
  async logCall(meId: string, conversationId: string, input: CallLogInput): Promise<MessageDTO> {
    if (!(await chatRepository.isMember(conversationId, meId))) throw errors.forbidden('Not in this conversation');
    const message = await chatRepository.createSystemMessage(conversationId, meId, encodeCallLog(input));
    const dto = mapMessage(message, meId);

    const others = await chatRepository.otherMemberIds(conversationId, meId);
    for (const uid of others) {
      emitToUser(uid, 'message:new', { ...dto, isOwn: false });
      emitToUser(uid, 'conversation:updated', { conversationId });
    }
    // Also notify the caller's own sessions — unlike a composed message there's
    // no optimistic insert, so the caller's thread/list refresh from this event.
    emitToUser(meId, 'message:new', dto);
    emitToUser(meId, 'conversation:updated', { conversationId });
    return dto;
  },

  /** Recent calls across all the user's conversations, for the Calls screen. */
  async listCalls(meId: string, limit: number): Promise<CallHistoryDTO[]> {
    const rows = await chatRepository.listCallLogs(meId, limit);
    const calls: CallHistoryDTO[] = [];
    for (const m of rows) {
      const log = parseCallLog(m.content);
      if (!log) continue; // skip any non-call SYSTEM message
      const otherMember = m.conversation.members.find((mem) => mem.userId !== meId);
      const other = otherMember?.user ?? null;
      calls.push({
        id: m.id,
        conversationId: m.conversationId,
        otherUser: other ? toUserRef(other) : null,
        media: log.media,
        status: log.status,
        outgoing: m.senderId === meId,
        duration: log.duration ?? null,
        createdAt: m.createdAt.toISOString(),
      });
    }
    return calls;
  },

  async markRead(meId: string, conversationId: string): Promise<void> {
    if (!(await chatRepository.isMember(conversationId, meId))) return;
    await chatRepository.markRead(conversationId, meId);
    const others = await chatRepository.otherMemberIds(conversationId, meId);
    for (const uid of others) emitToUser(uid, 'message:read', { conversationId, readerId: meId });
  },
};
