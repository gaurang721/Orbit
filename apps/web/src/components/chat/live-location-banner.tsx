'use client';

import Link from 'next/link';
import { MapPin } from 'lucide-react';
import { useLiveLocationStore } from '@/stores/live-location-store';

/** Format a remaining duration in ms as m:ss (or h:mm:ss past an hour). */
function fmtRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * A fixed pill shown app-wide while the user is broadcasting a live location, so
 * it's obvious sharing is on even after navigating away from the chat. Reads the
 * live-location store; the store's `tick` re-renders the countdown each second.
 */
export function LiveLocationBanner() {
  const active = useLiveLocationStore((s) => s.active);
  const stop = useLiveLocationStore((s) => s.stop);
  // Subscribe to the per-second tick so the countdown stays live.
  useLiveLocationStore((s) => s.tick);
  if (!active) return null;

  const remaining = active.expiresAt - Date.now();
  return (
    <div className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4">
      <div className="flex items-center gap-3 rounded-full border border-emerald-500/40 bg-card/95 px-4 py-2 text-sm shadow-2xl backdrop-blur">
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium">
          <MapPin className="size-4 text-emerald-500" /> Sharing live location
        </span>
        <span className="tabular-nums text-muted-foreground">{fmtRemaining(remaining)} left</span>
        <Link
          href={`/messages?c=${active.conversationId}`}
          className="rounded-full px-2 py-1 text-primary hover:bg-accent"
        >
          View
        </Link>
        <button
          type="button"
          onClick={() => void stop()}
          className="rounded-full bg-destructive px-3 py-1 font-medium text-destructive-foreground hover:opacity-90"
        >
          Stop
        </button>
      </div>
    </div>
  );
}
