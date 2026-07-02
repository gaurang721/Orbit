import { create } from 'zustand';
import { toast } from 'sonner';
import type { InfiniteData } from '@tanstack/react-query';
import type { LiveLocationDuration, MessageDTO, Paginated } from '@fbclone/types';
import { api } from '@/lib/api-client';
import { getQueryClient } from '@/lib/query-client';
import { patchMessageLocation } from '@/lib/location-cache';

type MsgData = InfiniteData<Paginated<MessageDTO>>;

/**
 * Drives an outgoing LIVE-location share. The share is a normal chat message
 * whose encoded coordinates we keep PATCHing from `watchPosition`. This store is
 * a module singleton so sharing continues across route changes (like the call
 * store); the geolocation watch + timers live in module-scoped refs and are torn
 * down on stop/expiry. Only one active share at a time.
 */

interface ActiveShare {
  conversationId: string;
  messageId: string;
  /** epoch ms when the share auto-expires */
  expiresAt: number;
}

interface LiveLocationState {
  active: ActiveShare | null;
  starting: boolean;
  /** bumped once a second so subscribers (the banner countdown) re-render */
  tick: number;
  start: (conversationId: string, durationMinutes: LiveLocationDuration) => Promise<void>;
  stop: () => Promise<void>;
}

// Don't hammer the API on every GPS fix — one update every 8s is plenty.
const MIN_SEND_INTERVAL = 8_000;

let watchId: number | null = null;
let expiryTimer: ReturnType<typeof setTimeout> | null = null;
let tickTimer: ReturnType<typeof setInterval> | null = null;
let lastSentAt = 0;

const round6 = (n: number) => Number(n.toFixed(6));

function clearInternals(): void {
  if (watchId != null && typeof navigator !== 'undefined' && navigator.geolocation) {
    navigator.geolocation.clearWatch(watchId);
  }
  watchId = null;
  if (expiryTimer) { clearTimeout(expiryTimer); expiryTimer = null; }
  if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  lastSentAt = 0;
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10_000 }),
  );
}

export const useLiveLocationStore = create<LiveLocationState>((set, get) => {
  /** Throttled push of a fresh GPS fix into the active share. */
  async function pushFix(share: ActiveShare, pos: GeolocationPosition): Promise<void> {
    const now = Date.now();
    if (now - lastSentAt < MIN_SEND_INTERVAL) return;
    lastSentAt = now;
    const latitude = round6(pos.coords.latitude);
    const longitude = round6(pos.coords.longitude);
    try {
      const { message } = await api.patch<{ message: MessageDTO }>(
        `/chat/conversations/${share.conversationId}/location/${share.messageId}`,
        { latitude, longitude },
      );
      patchMessageLocation(getQueryClient(), share.conversationId, share.messageId, {
        latitude,
        longitude,
        updatedAt: message.location?.updatedAt ?? new Date().toISOString(),
      });
    } catch {
      /* transient GPS/network hiccup — keep watching, retry on the next fix */
    }
  }

  return {
    active: null,
    starting: false,
    tick: 0,

    async start(conversationId, durationMinutes) {
      if (get().active || get().starting) return;
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        toast.error('Location is not supported on this device');
        return;
      }
      set({ starting: true });

      let pos: GeolocationPosition;
      try {
        pos = await getCurrentPosition();
      } catch {
        set({ starting: false });
        toast.error('Location permission denied');
        return;
      }

      let message: MessageDTO;
      try {
        const res = await api.post<{ message: MessageDTO }>(
          `/chat/conversations/${conversationId}/location`,
          {
            latitude: round6(pos.coords.latitude),
            longitude: round6(pos.coords.longitude),
            liveDurationMinutes: durationMinutes,
          },
        );
        message = res.message;
      } catch {
        set({ starting: false });
        toast.error('Could not start live location');
        return;
      }

      // Show it in our own thread immediately + refresh the list preview.
      const qc = getQueryClient();
      qc.setQueryData<MsgData>(['messages', conversationId], (data) => {
        if (!data) return data;
        const pages = [...data.pages];
        pages[0] = { ...pages[0]!, items: [message, ...pages[0]!.items] };
        return { ...data, pages };
      });
      qc.invalidateQueries({ queryKey: ['conversations'] });

      const expiresAt = message.location?.expiresAt
        ? new Date(message.location.expiresAt).getTime()
        : Date.now() + durationMinutes * 60_000;
      const share: ActiveShare = { conversationId, messageId: message.id, expiresAt };
      set({ active: share, starting: false, tick: Date.now() });
      lastSentAt = Date.now();

      watchId = navigator.geolocation.watchPosition(
        (p) => void pushFix(share, p),
        () => { /* ignore transient watch errors */ },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
      );
      tickTimer = setInterval(() => set({ tick: Date.now() }), 1_000);
      expiryTimer = setTimeout(() => void get().stop(), Math.max(0, expiresAt - Date.now()) + 500);

      toast.success('Sharing live location');
    },

    async stop() {
      const active = get().active;
      clearInternals();
      set({ active: null, starting: false });
      if (!active) return;
      try {
        const { message } = await api.post<{ message: MessageDTO }>(
          `/chat/conversations/${active.conversationId}/location/${active.messageId}/stop`,
        );
        patchMessageLocation(getQueryClient(), active.conversationId, active.messageId, {
          endedAt: message.location?.endedAt ?? new Date().toISOString(),
        });
      } catch {
        /* best-effort — it also auto-expires server-side by time */
      }
      getQueryClient().invalidateQueries({ queryKey: ['conversations'] });
    },
  };
});
