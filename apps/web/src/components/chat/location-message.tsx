'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { ExternalLink, MapPin, Square } from 'lucide-react';
import type { LocationDTO } from '@fbclone/types';
import { googleMapsUrl, isLiveActive } from '@fbclone/types';
import { cn } from '@/lib/utils';

// Leaflet is client-only; a live card renders a real map, static cards don't.
const LocationMap = dynamic(() => import('./location-map'), {
  ssr: false,
  loading: () => <div className="h-28 w-full animate-pulse bg-muted" />,
});

/** m:ss (or h:mm:ss past an hour) for a countdown in ms. */
function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    : `${m}:${s.toString().padStart(2, '0')}`;
}

/** "just now" / "12s ago" / "3m ago" for the last live-position update. */
function updatedAgo(iso: string | null, now: number): string {
  if (!iso) return '';
  const sec = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (sec < 5) return 'just now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  return min < 60 ? `${min}m ago` : `${Math.floor(min / 60)}h ago`;
}

/** A self-contained faux-map header (CSS grid) for static / ended locations. */
function FauxMap({ url, muted }: { url: string; muted?: boolean }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'relative flex h-28 items-center justify-center bg-gradient-to-br from-emerald-500/20 via-sky-500/10 to-indigo-500/20',
        muted && 'opacity-60 grayscale',
      )}
      aria-label="Open location in Google Maps"
    >
      <span
        aria-hidden
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(120,120,120,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(120,120,120,0.25) 1px, transparent 1px)',
          backgroundSize: '22px 22px',
        }}
      />
      <span className="relative grid size-10 place-items-center rounded-full bg-red-500 text-white shadow-lg">
        <MapPin className="size-5" />
      </span>
    </a>
  );
}

/**
 * Renders a shared location. Static locations show a self-contained faux-map
 * card; live locations show a real (OpenStreetMap) map that follows the moving
 * pin, a LIVE badge + countdown, and — for the owner — a Stop button. Ended /
 * expired live shares fall back to the faux-map card. Always offers an "Open in
 * Google Maps" link at the latest coordinates.
 */
export function LocationMessage({
  location,
  isOwn = false,
  onStop,
  className,
}: {
  location: LocationDTO;
  isOwn?: boolean;
  onStop?: () => void;
  className?: string;
}) {
  const [now, setNow] = React.useState(() => Date.now());
  const active = isLiveActive(location, now);

  // Tick each second while a live share is on-screen (countdown + updated-ago),
  // and once more right after it ends so the card flips to its ended state.
  React.useEffect(() => {
    if (!location.live || location.endedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(id);
  }, [location.live, location.endedAt]);

  const url = googleMapsUrl(location);
  const coords = `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`;

  // --- Static location ---
  if (!location.live) {
    return (
      <div className={cn('overflow-hidden rounded-2xl border bg-card', className)}>
        <FauxMap url={url} />
        <div className="p-3">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <MapPin className="size-4 shrink-0 text-red-500" />
            <span className="truncate">{location.label || 'Shared location'}</span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{coords}</div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ExternalLink className="size-3.5" /> Open in Google Maps
          </a>
        </div>
      </div>
    );
  }

  // --- Live location ---
  const remaining = location.expiresAt ? new Date(location.expiresAt).getTime() - now : 0;
  return (
    <div className={cn('overflow-hidden rounded-2xl border bg-card', className)}>
      {active ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block" aria-label="Open live location in Google Maps">
          <LocationMap latitude={location.latitude} longitude={location.longitude} className="h-28 w-full" />
        </a>
      ) : (
        <FauxMap url={url} muted />
      )}
      <div className="p-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          {active ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-600">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              Live
            </span>
          ) : (
            <MapPin className="size-4 shrink-0 text-muted-foreground" />
          )}
          <span className="truncate">
            {location.label || (active ? 'Live location' : 'Live location ended')}
          </span>
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">
          {active ? (
            <>
              {fmtCountdown(remaining)} left · updated {updatedAgo(location.updatedAt, now)}
            </>
          ) : (
            <>Ended · last seen {coords}</>
          )}
        </div>
        <div className="mt-2 flex items-center gap-3">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            <ExternalLink className="size-3.5" /> Open in Google Maps
          </a>
          {isOwn && active && onStop && (
            <button
              type="button"
              onClick={onStop}
              className="inline-flex items-center gap-1 text-sm font-medium text-destructive hover:underline"
            >
              <Square className="size-3.5 fill-current" /> Stop sharing
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
