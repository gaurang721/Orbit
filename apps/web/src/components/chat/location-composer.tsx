'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { ArrowLeft, ChevronRight, Loader2, LocateFixed, MapPin, Radio, X } from 'lucide-react';
import { toast } from 'sonner';
import { LIVE_LOCATION_DURATIONS, type LiveLocationDuration } from '@fbclone/types';
import { cn } from '@/lib/utils';
import { useLiveLocationStore } from '@/stores/live-location-store';

// Leaflet must not touch the server — load the picker client-only.
const MapPicker = dynamic(() => import('./map-picker'), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 items-center justify-center rounded-lg border">
      <Loader2 className="size-5 animate-spin text-primary" />
    </div>
  ),
});

type View = 'menu' | 'map' | 'live';

const DURATION_LABELS: Record<LiveLocationDuration, string> = {
  15: '15 minutes',
  60: '1 hour',
  480: '8 hours',
};

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/**
 * The Location composer opened from the chat attach menu. Opens on an action
 * menu where "Send current location" sends in a single click; "Choose on map"
 * and "Share live" open their own views. Static sends go through `onSendStatic`;
 * live starts via the live-location store.
 */
export function LocationComposer({
  conversationId,
  onSendStatic,
  onClose,
}: {
  conversationId: string;
  onSendStatic: (loc: { latitude: number; longitude: number; label?: string }) => void;
  onClose: () => void;
}) {
  const [view, setView] = React.useState<View>('menu');
  const [current, setCurrent] = React.useState<{ latitude: number; longitude: number } | null>(null);
  const [geoError, setGeoError] = React.useState<string | null>(null);
  // Set when the user hits "Send current location" before the fix has arrived.
  const [pendingCurrent, setPendingCurrent] = React.useState(false);
  const sentRef = React.useRef(false);
  // Map-tab selection (seeded from current position once we have it).
  const [picked, setPicked] = React.useState({ latitude: 20, longitude: 0 });
  const [pickedTouched, setPickedTouched] = React.useState(false);
  const [label, setLabel] = React.useState('');
  const [duration, setDuration] = React.useState<LiveLocationDuration>(60);

  const startLive = useLiveLocationStore((s) => s.start);
  const liveStarting = useLiveLocationStore((s) => s.starting);
  const liveActive = useLiveLocationStore((s) => s.active);

  // Grab the current position once on open (for the menu + map seeding).
  React.useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('Location is not supported on this device');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = {
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
        };
        setCurrent(c);
        setPicked((prev) => (prev.latitude === 20 && prev.longitude === 0 ? c : prev));
      },
      (err) =>
        setGeoError(
          err.code === err.PERMISSION_DENIED ? 'Location permission denied' : 'Could not get your location',
        ),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const doSendCurrent = React.useCallback(
    (loc: { latitude: number; longitude: number }) => {
      if (sentRef.current) return;
      sentRef.current = true;
      onSendStatic(loc);
      onClose();
    },
    [onSendStatic, onClose],
  );

  // If the user tapped "Send current" before the fix landed, send once it does.
  React.useEffect(() => {
    if (pendingCurrent && current) doSendCurrent(current);
  }, [pendingCurrent, current, doSendCurrent]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (view === 'menu') onClose();
      else setView('menu');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, view]);

  // One-click current send: fire now if we have a fix, else wait for one.
  const sendCurrent = () => {
    if (current) {
      doSendCurrent(current);
    } else if (geoError) {
      toast.error(geoError);
    } else {
      setPendingCurrent(true);
    }
  };

  const sendPicked = () => {
    onSendStatic({ latitude: picked.latitude, longitude: picked.longitude, label: label.trim() || undefined });
    onClose();
  };

  const beginLive = () => {
    void startLive(conversationId, duration);
    onClose();
  };

  const useCurrentForMap = () => {
    if (current) {
      setPicked(current);
      setPickedTouched(true);
    }
  };

  const currentSubtitle = pendingCurrent
    ? 'Locating…'
    : current
      ? `${current.latitude.toFixed(5)}, ${current.longitude.toFixed(5)}`
      : geoError ?? 'Finding your location…';

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="Close" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl border bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-center gap-2 border-b px-4 py-3">
          {view !== 'menu' && (
            <button
              type="button"
              onClick={() => setView('menu')}
              className="rounded-full p-1 text-muted-foreground hover:bg-accent"
              aria-label="Back"
            >
              <ArrowLeft className="size-5" />
            </button>
          )}
          <h2 className="flex flex-1 items-center gap-2 font-semibold">
            <MapPin className="size-5 text-red-500" />
            {view === 'map' ? 'Choose on map' : view === 'live' ? 'Share live location' : 'Share location'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-accent"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {view === 'menu' && (
            <div className="space-y-2">
              <button
                type="button"
                onClick={sendCurrent}
                disabled={!!geoError && !current}
                className="flex w-full items-center gap-3 rounded-xl border p-3 text-left hover:bg-accent disabled:opacity-60"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-500/15 text-red-500">
                  {pendingCurrent || (!current && !geoError) ? (
                    <Loader2 className="size-5 animate-spin" />
                  ) : (
                    <LocateFixed className="size-5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Send current location</span>
                  <span className="block truncate text-xs text-muted-foreground">{currentSubtitle}</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setView('map')}
                className="flex w-full items-center gap-3 rounded-xl border p-3 text-left hover:bg-accent"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-sky-500/15 text-sky-500">
                  <MapPin className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Choose location on map</span>
                  <span className="block truncate text-xs text-muted-foreground">Search, drop a pin, or type coordinates</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>

              <button
                type="button"
                onClick={() => setView('live')}
                className="flex w-full items-center gap-3 rounded-xl border p-3 text-left hover:bg-accent"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-500/15 text-emerald-500">
                  <Radio className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Share live location</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {liveActive ? 'Already sharing — stop it first' : 'Real-time, for 15 min · 1 hr · 8 hr'}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>
            </div>
          )}

          {view === 'map' && (
            <div className="space-y-3">
              <MapPicker
                value={picked}
                onChange={(v) => {
                  setPicked({ latitude: v.latitude, longitude: v.longitude });
                  setPickedTouched(true);
                  if (v.label) setLabel(v.label);
                }}
              />
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-muted-foreground">
                  Latitude
                  <input
                    type="number"
                    step="any"
                    value={picked.latitude}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n)) {
                        setPicked((p) => ({ ...p, latitude: clamp(n, -90, 90) }));
                        setPickedTouched(true);
                      }
                    }}
                    className="mt-1 w-full rounded-lg border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
                <label className="text-xs text-muted-foreground">
                  Longitude
                  <input
                    type="number"
                    step="any"
                    value={picked.longitude}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (Number.isFinite(n)) {
                        setPicked((p) => ({ ...p, longitude: clamp(n, -180, 180) }));
                        setPickedTouched(true);
                      }
                    }}
                    className="mt-1 w-full rounded-lg border bg-background px-2 py-1.5 text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
              </div>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Add a label (optional)"
                maxLength={200}
                className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              {current && (
                <button
                  type="button"
                  onClick={useCurrentForMap}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <LocateFixed className="size-4" /> Use my current position
                </button>
              )}
              <button
                type="button"
                onClick={sendPicked}
                disabled={!pickedTouched}
                className="w-full rounded-lg bg-primary py-2.5 font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                Send this location
              </button>
            </div>
          )}

          {view === 'live' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Share your real-time location. It updates as you move and stops automatically when the time runs
                out.
              </p>
              <div className="space-y-1.5">
                {LIVE_LOCATION_DURATIONS.map((d) => (
                  <label
                    key={d}
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm',
                      duration === d ? 'border-primary bg-primary/5' : 'hover:bg-accent',
                    )}
                  >
                    <input
                      type="radio"
                      name="live-duration"
                      checked={duration === d}
                      onChange={() => setDuration(d)}
                      className="accent-primary"
                    />
                    {DURATION_LABELS[d]}
                  </label>
                ))}
              </div>
              {liveActive ? (
                <p className="rounded-lg bg-secondary/60 p-2 text-center text-xs text-muted-foreground">
                  You&apos;re already sharing a live location. Stop it first to start a new one.
                </p>
              ) : (
                <button
                  type="button"
                  onClick={beginLive}
                  disabled={liveStarting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 font-medium text-white hover:opacity-90 disabled:opacity-60"
                >
                  {liveStarting ? <Loader2 className="size-4 animate-spin" /> : <Radio className="size-4" />}
                  Share live location
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
