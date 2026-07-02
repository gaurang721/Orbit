'use client';

import * as React from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Loader2, Search } from 'lucide-react';

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
}

const round6 = (n: number) => Number(n.toFixed(6));
const coordKey = (lat: number, lng: number) => `${lat.toFixed(5)},${lng.toFixed(5)}`;

function pinIcon(): L.DivIcon {
  return L.divIcon({
    className: 'fbclone-map-pin',
    html:
      '<svg width="30" height="30" viewBox="0 0 24 24" fill="#ef4444" stroke="white" stroke-width="1.5" stroke-linejoin="round"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.4" fill="white" stroke="none"/></svg>',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
  });
}

/**
 * An interactive OpenStreetMap picker: tap the map or drag the pin to choose a
 * spot, or search a place by name (OSM Nominatim geocoder). Controlled via
 * `value`/`onChange` so the parent can also drive it from manual lat/lng inputs.
 * Loaded via next/dynamic (ssr:false) so Leaflet never runs on the server.
 */
export default function MapPicker({
  value,
  onChange,
}: {
  value: { latitude: number; longitude: number };
  onChange: (v: { latitude: number; longitude: number; label?: string }) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  const markerRef = React.useRef<L.Marker | null>(null);
  // The coords we've already synced to the map — guards the value→map effect
  // from fighting a change that originated from the map itself.
  const applied = React.useRef('');
  const onChangeRef = React.useRef(onChange);
  onChangeRef.current = onChange;

  const [query, setQuery] = React.useState('');
  const [searching, setSearching] = React.useState(false);
  const [results, setResults] = React.useState<NominatimResult[]>([]);

  React.useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, {
      center: [value.latitude, value.longitude],
      zoom: 15,
      scrollWheelZoom: true,
      attributionControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    const marker = L.marker([value.latitude, value.longitude], { icon: pinIcon(), draggable: true }).addTo(map);

    const report = (lat: number, lng: number) => {
      applied.current = coordKey(lat, lng);
      onChangeRef.current({ latitude: round6(lat), longitude: round6(lng) });
    };
    marker.on('dragend', () => {
      const { lat, lng } = marker.getLatLng();
      report(lat, lng);
    });
    map.on('click', (e: L.LeafletMouseEvent) => {
      marker.setLatLng(e.latlng);
      report(e.latlng.lat, e.latlng.lng);
    });

    mapRef.current = map;
    markerRef.current = marker;
    applied.current = coordKey(value.latitude, value.longitude);
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External value changes (manual inputs / "use current location") → move map.
  React.useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    const key = coordKey(value.latitude, value.longitude);
    if (key === applied.current) return;
    applied.current = key;
    marker.setLatLng([value.latitude, value.longitude]);
    map.setView([value.latitude, value.longitude], map.getZoom(), { animate: true });
  }, [value.latitude, value.longitude]);

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=${encodeURIComponent(q)}`,
        { headers: { Accept: 'application/json' } },
      );
      setResults(res.ok ? ((await res.json()) as NominatimResult[]) : []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const choose = (r: NominatimResult) => {
    const latitude = round6(Number(r.lat));
    const longitude = round6(Number(r.lon));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
    setResults([]);
    setQuery(r.display_name.split(',')[0] ?? '');
    onChangeRef.current({
      latitude,
      longitude,
      label: r.display_name.split(',').slice(0, 3).join(',').trim(),
    });
  };

  return (
    <div className="space-y-2">
      <form onSubmit={runSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search a place or address"
            className="w-full rounded-lg border bg-background py-2 pl-8 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
        <button
          type="submit"
          disabled={searching}
          className="inline-flex items-center gap-1 rounded-lg bg-secondary px-3 text-sm font-medium hover:bg-accent disabled:opacity-60"
        >
          {searching ? <Loader2 className="size-4 animate-spin" /> : 'Search'}
        </button>
      </form>
      {results.length > 0 && (
        <div className="max-h-40 overflow-y-auto rounded-lg border bg-card text-sm">
          {results.map((r, i) => (
            <button
              key={`${r.lat},${r.lon},${i}`}
              type="button"
              onClick={() => choose(r)}
              className="block w-full truncate px-3 py-2 text-left hover:bg-accent"
              title={r.display_name}
            >
              {r.display_name}
            </button>
          ))}
        </div>
      )}
      <div ref={ref} className="h-56 w-full overflow-hidden rounded-lg border" />
      <p className="text-xs text-muted-foreground">Tap the map or drag the pin to choose a spot.</p>
    </div>
  );
}
