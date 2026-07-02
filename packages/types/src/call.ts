import { z } from 'zod';
import type { UserRef } from './user';

/**
 * Realtime voice-call signaling. The server relays these messages between the
 * two participants over Socket.io (it never inspects the SDP/ICE payloads) —
 * the actual audio flows peer-to-peer via WebRTC.
 *
 * Flow: caller emits `offer` → callee emits `answer` → both exchange `ice`
 * candidates. Either side can `end`; the callee can `reject`; the caller can
 * `cancel` before it's answered; a participant already on a call replies `busy`.
 */
export type CallSignalKind = 'offer' | 'answer' | 'ice' | 'reject' | 'end' | 'cancel' | 'busy';

/** Sent by the client; the server stamps `fromUserId` before relaying. */
export interface CallSignalOutgoing {
  /** the user to relay this signal to (the other participant) */
  toUserId: string;
  conversationId: string;
  kind: CallSignalKind;
  /** SDP for offer/answer, an RTCIceCandidate for ice; omitted otherwise */
  data?: unknown;
  /** caller identity, included on the initial `offer` so the callee can ring */
  from?: UserRef;
  /** true on a video call's `offer` so the callee rings with video + camera */
  video?: boolean;
}

/** Received by the client; the server has attached `fromUserId`. */
export interface CallSignalIncoming extends CallSignalOutgoing {
  fromUserId: string;
}

// ----- Call log (a SYSTEM message left in the thread when a call ends) -------

export type CallMedia = 'audio' | 'video';
export type CallLogStatus = 'answered' | 'missed' | 'declined';

export interface CallLog {
  media: CallMedia;
  status: CallLogStatus;
  /** call length in seconds — only present for `answered` calls */
  duration?: number;
}

/** One entry in the Calls screen — a past call across any of my conversations. */
export interface CallHistoryDTO {
  id: string;
  conversationId: string;
  otherUser: UserRef | null;
  media: CallMedia;
  status: CallLogStatus;
  /** true if I placed the call (outgoing), false if I received it */
  outgoing: boolean;
  duration: number | null;
  createdAt: string;
}

export const callLogSchema = z.object({
  media: z.enum(['audio', 'video']),
  status: z.enum(['answered', 'missed', 'declined']),
  duration: z.number().int().min(0).max(86_400).optional(),
});
export type CallLogInput = z.infer<typeof callLogSchema>;

/**
 * A call log is persisted as a SYSTEM message whose `content` holds the encoded
 * log — this avoids a schema migration. Both ends share these codecs so the API
 * writes and the web client reads the exact same shape.
 */
export function encodeCallLog(log: CallLog): string {
  return JSON.stringify({ __call: log });
}

/** Decode a SYSTEM message's content into a CallLog, or null if it isn't one. */
export function parseCallLog(content: string | null | undefined): CallLog | null {
  if (!content) return null;
  try {
    const parsed = JSON.parse(content) as { __call?: CallLog };
    const c = parsed?.__call;
    if (
      c &&
      (c.media === 'audio' || c.media === 'video') &&
      (c.status === 'answered' || c.status === 'missed' || c.status === 'declined')
    ) {
      return c;
    }
  } catch {
    /* not JSON / not a call log */
  }
  return null;
}
