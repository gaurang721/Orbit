'use client';

import * as React from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

/** A red teardrop pin as an inline-SVG divIcon (no external marker image / 404s). */
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
 * A lightweight, read-only OpenStreetMap view with a single pin. Used inside
 * live-location cards; recenters as the coordinates change so the pin appears to
 * move. Loaded via next/dynamic (ssr:false) so Leaflet never runs on the server.
 */
export default function LocationMap({
  latitude,
  longitude,
  className,
}: {
  latitude: number;
  longitude: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  const markerRef = React.useRef<L.Marker | null>(null);

  React.useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = L.map(ref.current, {
      center: [latitude, longitude],
      zoom: 15,
      zoomControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);
    markerRef.current = L.marker([latitude, longitude], { icon: pinIcon() }).addTo(map);
    mapRef.current = map;
    // Leaflet mis-sizes when its container animates in — recalc after layout.
    const t = setTimeout(() => map.invalidateSize(), 60);
    return () => {
      clearTimeout(t);
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow live movement.
  React.useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    marker.setLatLng([latitude, longitude]);
    map.setView([latitude, longitude], map.getZoom(), { animate: true });
  }, [latitude, longitude]);

  return <div ref={ref} className={className} aria-label="Map" />;
}
