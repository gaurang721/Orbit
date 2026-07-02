import { z } from 'zod';
import type { ConversationRole, MediaType, MessageType } from './enums';
import type { UserRef } from './user';

export const startConversationSchema = z.object({ userId: z.string().min(1) });

export const createGroupChatSchema = z.object({
  name: z.string().trim().min(1, 'Give the group a name').max(80, 'Name is too long'),
  // at least 2 other people (so the group has 3+ members including the creator)
  memberIds: z.array(z.string().min(1)).min(2, 'Pick at least 2 people').max(50),
});
export type CreateGroupChatInput = z.infer<typeof createGroupChatSchema>;

/** Rename a group chat (any member, WhatsApp-style). */
export const renameGroupChatSchema = z.object({
  name: z.string().trim().min(1, 'Give the group a name').max(80, 'Name is too long'),
});
export type RenameGroupChatInput = z.infer<typeof renameGroupChatSchema>;

/** Add one or more members to a group chat. */
export const addGroupMembersSchema = z.object({
  memberIds: z.array(z.string().min(1)).min(1, 'Pick someone to add').max(50),
});
export type AddGroupMembersInput = z.infer<typeof addGroupMembersSchema>;

/** A participant of a group chat, with role + presence (for the group-info panel). */
export interface ConversationMemberDTO extends UserRef {
  role: ConversationRole;
  isOnline: boolean;
  /** true if this is the viewer */
  isMe: boolean;
}

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message cannot be empty').max(5000),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const forwardMessageSchema = z.object({ messageId: z.string().min(1) });
export type ForwardMessageInput = z.infer<typeof forwardMessageSchema>;

export const messageReactionSchema = z.object({ emoji: z.string().trim().min(1).max(16) });
export type MessageReactionInput = z.infer<typeof messageReactionSchema>;

// ----- Shared location ("Share Location" message) ----------------------------

/** Allowed live-location durations, in minutes (15 min / 1 hr / 8 hr). */
export const LIVE_LOCATION_DURATIONS = [15, 60, 480] as const;
export type LiveLocationDuration = (typeof LIVE_LOCATION_DURATIONS)[number];

export const shareLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  /** optional place name / address the sender attached */
  label: z.string().trim().max(200).optional(),
  /**
   * When present, this is a LIVE share that keeps updating for this many
   * minutes; omit for a one-off static location.
   */
  liveDurationMinutes: z
    .number()
    .int()
    .refine((n) => (LIVE_LOCATION_DURATIONS as readonly number[]).includes(n), 'Invalid live duration')
    .optional(),
});
export type ShareLocationInput = z.infer<typeof shareLocationSchema>;

/** Body for a live-location position update (owner pings the fresh coordinates). */
export const updateLiveLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});
export type UpdateLiveLocationInput = z.infer<typeof updateLiveLocationSchema>;

export interface LocationDTO {
  latitude: number;
  longitude: number;
  label: string | null;
  /** true when this is a live location that updates over time */
  live: boolean;
  /** ISO — when a live share auto-expires (null for static locations) */
  expiresAt: string | null;
  /** ISO — when a live share was stopped early / ended (null while active/static) */
  endedAt: string | null;
  /** ISO — time of the last position fix (live only; null for static) */
  updatedAt: string | null;
}

/**
 * A shared location rides inside a normal message's `content` as encoded JSON —
 * this avoids a schema migration (there is no LOCATION MessageType), the same
 * trick the call log uses. The API encodes on write; the client decodes back
 * into `MessageDTO.location`, so both ends share these codecs.
 */
export function encodeLocation(loc: LocationDTO): string {
  return JSON.stringify({ __location: loc });
}

/** Decode a message's content into a LocationDTO, or null if it isn't one. */
export function parseLocation(content: string | null | undefined): LocationDTO | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as { __location?: Partial<LocationDTO> };
    const l = parsed?.__location;
    if (
      l &&
      typeof l.latitude === 'number' &&
      typeof l.longitude === 'number' &&
      Number.isFinite(l.latitude) &&
      Number.isFinite(l.longitude)
    ) {
      return {
        latitude: l.latitude,
        longitude: l.longitude,
        label: l.label ?? null,
        live: l.live === true,
        expiresAt: typeof l.expiresAt === 'string' ? l.expiresAt : null,
        endedAt: typeof l.endedAt === 'string' ? l.endedAt : null,
        updatedAt: typeof l.updatedAt === 'string' ? l.updatedAt : null,
      };
    }
  } catch {
    /* not JSON / not a location */
  }
  return null;
}

/** Whether a live-location share is still actively broadcasting (not stopped/expired). */
export function isLiveActive(loc: Pick<LocationDTO, 'live' | 'expiresAt' | 'endedAt'>, now = Date.now()): boolean {
  if (!loc.live || loc.endedAt) return false;
  if (loc.expiresAt && new Date(loc.expiresAt).getTime() <= now) return false;
  return true;
}

/** A Google Maps deep link that drops a pin at the given coordinates. */
export function googleMapsUrl(loc: { latitude: number; longitude: number }): string {
  return `https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`;
}

export interface MessageReactionDTO {
  emoji: string;
  count: number;
  /** whether the viewer reacted with this emoji */
  reactedByMe: boolean;
}

export interface MessageAttachmentDTO {
  id: string;
  type: MediaType;
  url: string;
  mimeType: string | null;
  /** seconds, for audio/video attachments */
  duration: number | null;
  /** bytes, for FILE attachments */
  size: number | null;
  /** original filename, for FILE attachments (used as the download name) */
  fileName: string | null;
}

export interface MessageDTO {
  id: string;
  conversationId: string;
  sender: UserRef;
  content: string | null;
  type: MessageType;
  /** cached length of a VOICE note, in seconds */
  voiceDuration: number | null;
  attachments: MessageAttachmentDTO[];
  /** emoji reactions grouped by emoji */
  reactions: MessageReactionDTO[];
  /** a shared geographic location, decoded from the message content (else null) */
  location: LocationDTO | null;
  /** true when this message was forwarded from another message */
  forwarded: boolean;
  /** true when the sender unsent (deleted) this message — content is stripped */
  deleted: boolean;
  createdAt: string;
  isOwn: boolean;
}

export interface ConversationDTO {
  id: string;
  isGroup: boolean;
  name: string | null;
  /** the other participant for a 1:1 conversation (null for groups) */
  otherUser: UserRef | null;
  otherOnline: boolean;
  /** all participants except me — drives group names, avatars, sender labels */
  members: UserRef[];
  /** the viewer's role in a group chat (null for 1:1); ADMIN can manage members */
  myRole: ConversationRole | null;
  lastMessage: {
    id: string;
    content: string | null;
    type: MessageType;
    senderId: string;
    deleted: boolean;
    createdAt: string;
  } | null;
  lastMessageAt: string | null;
  unreadCount: number;
  /** when the other 1:1 participant last read this conversation (for Seen receipts) */
  otherLastReadAt: string | null;
}
