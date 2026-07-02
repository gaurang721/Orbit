import { create } from 'zustand';
import type { CallMedia, CallLogStatus, CallSignalIncoming, CallSignalKind, UserRef } from '@fbclone/types';
import { api } from '@/lib/api-client';
import { getSocket } from '@/lib/socket';
import { useAuthStore } from './auth-store';

/**
 * 1:1 voice calling over WebRTC. Signaling (offer/answer/ICE) is relayed by the
 * API via the `call:signal` socket event; audio flows peer-to-peer. This store
 * owns the call lifecycle + display state; the live RTCPeerConnection and media
 * streams are kept in module-scoped refs (not reactive state) and torn down on
 * every terminal transition.
 */

export type CallStatus =
  | 'idle'
  | 'outgoing' // we placed the call, waiting for the other side to pick up
  | 'incoming' // someone is calling us, not yet accepted
  | 'connecting' // answered, ICE negotiating
  | 'active' // media connected
  | 'ended'; // brief terminal state before resetting to idle

interface CallState {
  status: CallStatus;
  /** the other participant */
  peer: UserRef | null;
  conversationId: string | null;
  /** true when this is a video call (camera + remote video), false = voice only */
  video: boolean;
  muted: boolean;
  /** true when our camera is turned off (video calls only) */
  cameraOff: boolean;
  /** our own mic/cam, attached to the self-view <video> by the overlay */
  localStream: MediaStream | null;
  /** the remote peer's media, attached to an <audio>/<video> by the overlay */
  remoteStream: MediaStream | null;
  /** epoch ms when the call connected, drives the duration timer */
  connectedAt: number | null;
  /** seconds since connect, ticked once per second while active */
  durationSec: number;
  /** why the call ended, shown briefly in the overlay */
  endReason: string | null;

  startCall: (conversationId: string, peer: UserRef, video?: boolean) => Promise<void>;
  acceptCall: () => Promise<void>;
  rejectCall: () => void;
  /** Hang up / cancel an in-progress or active call. */
  hangUp: () => void;
  toggleMute: () => void;
  /** Turn the local camera on/off (video calls only). */
  toggleCamera: () => void;
  /** Handle an inbound signal relayed from the other participant. */
  handleSignal: (signal: CallSignalIncoming) => Promise<void>;
}

// ICE servers are configurable so a deployment can add a TURN server (required
// for calls to connect across restrictive NATs/firewalls). Without TURN config
// we fall back to public STUN, which only works on the same LAN / open networks.
function buildIceServers(): RTCIceServer[] {
  const stun = process.env.NEXT_PUBLIC_STUN_URLS;
  const servers: RTCIceServer[] = [
    {
      urls: stun
        ? stun.split(',').map((s) => s.trim()).filter(Boolean)
        : ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
    },
  ];

  const turnUrl = process.env.NEXT_PUBLIC_TURN_URL;
  const turnUsername = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const turnCredential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
  if (turnUrl && turnUsername && turnCredential) {
    servers.push({
      urls: turnUrl.split(',').map((s) => s.trim()).filter(Boolean),
      username: turnUsername,
      credential: turnCredential,
    });
  }
  return servers;
}

const ICE_SERVERS: RTCIceServer[] = buildIceServers();

// ----- Non-reactive call internals ------------------------------------------
let pc: RTCPeerConnection | null = null;
let localStream: MediaStream | null = null;
/** Remote ICE candidates that arrive before the remote SDP is set. */
let pendingCandidates: RTCIceCandidateInit[] = [];
/** The pending inbound offer, held while the incoming-call UI is shown. */
let pendingOffer: RTCSessionDescriptionInit | null = null;
/** Whether the pending inbound offer requested video. */
let pendingVideo = false;
let durationTimer: ReturnType<typeof setInterval> | null = null;
// Call-log bookkeeping: only the caller logs the outcome, and only once an
// offer actually went out. `declinedByPeer` distinguishes a decline from a miss.
let isCaller = false;
let offerSent = false;
let declinedByPeer = false;

function meAsUserRef(): UserRef | null {
  const u = useAuthStore.getState().user;
  if (!u) return null;
  return {
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    username: u.username,
    profilePicture: u.profilePicture,
    verified: u.verified,
  };
}

function emitSignal(
  toUserId: string,
  conversationId: string,
  kind: CallSignalKind,
  data?: unknown,
  from?: UserRef,
  video?: boolean,
): void {
  getSocket()?.emit('call:signal', { toUserId, conversationId, kind, data, from, video });
}

/** Persist the call outcome as a system message in the thread (fire-and-forget). */
function logCall(conversationId: string, media: CallMedia, status: CallLogStatus, duration?: number): void {
  void api
    .post(`/chat/conversations/${conversationId}/call-log`, {
      media,
      status,
      ...(duration != null ? { duration } : {}),
    })
    .catch(() => {
      /* logging is best-effort — don't surface a failure after the call ends */
    });
}

/** Stop the mic, close the peer connection, and clear all call internals. */
function teardown(): void {
  if (durationTimer) {
    clearInterval(durationTimer);
    durationTimer = null;
  }
  localStream?.getTracks().forEach((t) => t.stop());
  localStream = null;
  if (pc) {
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    pc.close();
    pc = null;
  }
  pendingCandidates = [];
  pendingOffer = null;
  pendingVideo = false;
  isCaller = false;
  offerSent = false;
  declinedByPeer = false;
}

export const useCallStore = create<CallState>((set, get) => {
  /** Build the RTCPeerConnection and wire its event handlers. */
  function createPeer(peerId: string, conversationId: string): RTCPeerConnection {
    const connection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    connection.onicecandidate = (e) => {
      if (e.candidate) emitSignal(peerId, conversationId, 'ice', e.candidate.toJSON());
    };

    connection.ontrack = (e) => {
      const [stream] = e.streams;
      if (stream) set({ remoteStream: stream });
    };

    connection.onconnectionstatechange = () => {
      const cs = connection.connectionState;
      if (cs === 'connected') {
        if (get().status !== 'active') {
          set({ status: 'active', connectedAt: Date.now(), durationSec: 0 });
          durationTimer = setInterval(() => {
            const at = get().connectedAt;
            if (at) set({ durationSec: Math.floor((Date.now() - at) / 1000) });
          }, 1000);
        }
      } else if (cs === 'failed' || cs === 'disconnected' || cs === 'closed') {
        // Only treat as a drop if we were mid-call (avoid racing normal teardown).
        if (['connecting', 'active', 'outgoing'].includes(get().status)) {
          finish('Call ended');
        }
      }
    };

    return connection;
  }

  /** Get the mic (+ camera for video calls) and add the tracks to the peer. */
  async function attachMedia(wantVideo: boolean): Promise<void> {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: wantVideo });
    localStream.getTracks().forEach((t) => pc!.addTrack(t, localStream!));
    set({ localStream });
  }

  /** Drain any ICE candidates that arrived before the remote description. */
  async function drainCandidates(): Promise<void> {
    if (!pc) return;
    const queued = pendingCandidates;
    pendingCandidates = [];
    for (const c of queued) {
      try {
        await pc.addIceCandidate(c);
      } catch {
        /* stale candidate — ignore */
      }
    }
  }

  /** Reset to idle after showing a brief end state. */
  function finish(reason: string): void {
    // Log the call outcome before teardown wipes the state. Caller-only, and
    // only if an offer actually went out (so failed-before-dial doesn't log).
    const { conversationId, video, connectedAt, durationSec } = get();
    if (isCaller && offerSent && conversationId) {
      const connected = connectedAt != null;
      const status: CallLogStatus = connected ? 'answered' : declinedByPeer ? 'declined' : 'missed';
      logCall(conversationId, video ? 'video' : 'audio', status, connected ? durationSec : undefined);
    }
    teardown();
    set({ status: 'ended', endReason: reason, localStream: null, remoteStream: null, connectedAt: null });
    setTimeout(() => {
      // Don't clobber a brand-new call that started during the grace period.
      if (get().status === 'ended') {
        set({
          status: 'idle',
          peer: null,
          conversationId: null,
          video: false,
          muted: false,
          cameraOff: false,
          localStream: null,
          remoteStream: null,
          connectedAt: null,
          durationSec: 0,
          endReason: null,
        });
      }
    }, 1500);
  }

  return {
    status: 'idle',
    peer: null,
    conversationId: null,
    video: false,
    muted: false,
    cameraOff: false,
    localStream: null,
    remoteStream: null,
    connectedAt: null,
    durationSec: 0,
    endReason: null,

    async startCall(conversationId, peer, video = false) {
      if (get().status !== 'idle') return;
      isCaller = true;
      offerSent = false;
      declinedByPeer = false;
      set({ status: 'outgoing', peer, conversationId, video, muted: false, cameraOff: false, endReason: null });
      try {
        pc = createPeer(peer.id, conversationId);
        await attachMedia(video);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        emitSignal(peer.id, conversationId, 'offer', offer, meAsUserRef() ?? undefined, video);
        offerSent = true;
      } catch {
        emitSignal(peer.id, conversationId, 'cancel');
        finish(video ? 'Could not access camera/microphone' : 'Could not access microphone');
      }
    },

    async acceptCall() {
      const { peer, conversationId, video } = get();
      if (!peer || !conversationId || !pendingOffer) return;
      set({ status: 'connecting' });
      try {
        pc = createPeer(peer.id, conversationId);
        await attachMedia(video);
        await pc.setRemoteDescription(pendingOffer);
        pendingOffer = null;
        await drainCandidates();
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        emitSignal(peer.id, conversationId, 'answer', answer);
      } catch {
        emitSignal(peer.id, conversationId, 'reject');
        finish(video ? 'Could not access camera/microphone' : 'Could not access microphone');
      }
    },

    rejectCall() {
      const { peer, conversationId } = get();
      if (peer && conversationId) emitSignal(peer.id, conversationId, 'reject');
      finish('Declined');
    },

    hangUp() {
      const { peer, conversationId, status } = get();
      if (peer && conversationId) {
        // Cancel if it never connected, otherwise a normal end.
        emitSignal(peer.id, conversationId, status === 'outgoing' ? 'cancel' : 'end');
      }
      finish('Call ended');
    },

    toggleMute() {
      if (!localStream) return;
      const next = !get().muted;
      localStream.getAudioTracks().forEach((t) => (t.enabled = !next));
      set({ muted: next });
    },

    toggleCamera() {
      if (!localStream) return;
      const next = !get().cameraOff;
      localStream.getVideoTracks().forEach((t) => (t.enabled = !next));
      set({ cameraOff: next });
    },

    async handleSignal(signal) {
      const { kind, fromUserId, conversationId, data, from } = signal;
      const state = get();

      switch (kind) {
        case 'offer': {
          // Busy: already in a call with someone → tell them, ignore.
          if (state.status !== 'idle') {
            emitSignal(fromUserId, conversationId, 'busy');
            return;
          }
          isCaller = false; // we're the callee — the caller logs this call
          pendingOffer = data as RTCSessionDescriptionInit;
          pendingVideo = signal.video ?? false;
          set({
            status: 'incoming',
            peer: from ?? null,
            conversationId,
            video: pendingVideo,
            muted: false,
            cameraOff: false,
            endReason: null,
          });
          return;
        }
        case 'answer': {
          if (pc && state.status === 'outgoing') {
            set({ status: 'connecting' });
            await pc.setRemoteDescription(data as RTCSessionDescriptionInit);
            await drainCandidates();
          }
          return;
        }
        case 'ice': {
          const candidate = data as RTCIceCandidateInit;
          if (pc?.remoteDescription) {
            try {
              await pc.addIceCandidate(candidate);
            } catch {
              /* ignore */
            }
          } else {
            pendingCandidates.push(candidate);
          }
          return;
        }
        case 'reject':
          declinedByPeer = true;
          finish('Call declined');
          return;
        case 'busy':
          finish('User is busy');
          return;
        case 'cancel':
          finish('Call cancelled');
          return;
        case 'end':
          finish('Call ended');
          return;
      }
    },
  };
});
