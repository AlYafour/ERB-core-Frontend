'use client';

import { useEffect, useRef } from 'react';

// Lightweight Leaflet loader — pulls the library + CSS from the CDN once and
// caches the promise. No API key, OpenStreetMap tiles. Kept out of the bundle
// so it only loads on pages that actually render a map.
let leafletPromise: Promise<any> | null = null;
function loadLeaflet(): Promise<any> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  const w = window as any;
  if (w.L) return Promise.resolve(w.L);
  if (leafletPromise) return leafletPromise;
  leafletPromise = new Promise((resolve, reject) => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    s.async = true;
    s.onload = () => resolve((window as any).L);
    s.onerror = () => reject(new Error('Leaflet failed to load'));
    document.body.appendChild(s);
  });
  return leafletPromise;
}

const PIN_HTML =
  '<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;background:#C9943A;' +
  'border:2px solid #fff;transform:rotate(-45deg);box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>';

interface Props {
  lat: number | null;
  lng: number | null;
  radius: number;
  onChange: (lat: number, lng: number) => void;
  height?: number;
}

// Default centre when nothing is set yet — Abu Dhabi.
const FALLBACK: [number, number] = [24.4539, 54.3773];

export default function MapPicker({ lat, lng, radius, onChange, height = 300 }: Props) {
  const elRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Initialise the map once.
  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then((L) => {
      if (cancelled || !elRef.current || mapRef.current) return;
      const hasPoint = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);
      const start: [number, number] = hasPoint ? [lat as number, lng as number] : FALLBACK;

      const map = L.map(elRef.current).setView(start, hasPoint ? 16 : 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap', maxZoom: 19,
      }).addTo(map);

      const icon = L.divIcon({ className: '', html: PIN_HTML, iconSize: [22, 22], iconAnchor: [11, 22] });
      const marker = L.marker(start, { draggable: true, icon }).addTo(map);
      const circle = L.circle(start, {
        radius: radius || 0, color: '#C9943A', fillColor: '#C9943A', fillOpacity: 0.12, weight: 2,
      }).addTo(map);

      const move = (ll: any, fire: boolean) => {
        marker.setLatLng(ll);
        circle.setLatLng(ll);
        if (fire) onChangeRef.current(ll.lat, ll.lng);
      };
      marker.on('drag', () => circle.setLatLng(marker.getLatLng()));
      marker.on('dragend', () => onChangeRef.current(marker.getLatLng().lat, marker.getLatLng().lng));
      map.on('click', (e: any) => move(e.latlng, true));

      mapRef.current = map;
      markerRef.current = marker;
      circleRef.current = circle;
      // Drawers animate in — recompute size once settled so tiles fill the box.
      setTimeout(() => map.invalidateSize(), 250);
    }).catch(() => { /* offline / blocked — the number inputs still work */ });

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // React to lat/lng set from outside (typing, "use my location") — but ignore
  // echoes of our own marker move to avoid a recentre/jitter loop.
  useEffect(() => {
    if (!mapRef.current || lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) return;
    const cur = markerRef.current.getLatLng();
    if (Math.abs(cur.lat - lat) < 1e-7 && Math.abs(cur.lng - lng) < 1e-7) return;
    const p: [number, number] = [lat, lng];
    markerRef.current.setLatLng(p);
    circleRef.current.setLatLng(p);
    mapRef.current.setView(p, Math.max(mapRef.current.getZoom(), 16));
  }, [lat, lng]);

  // Live radius circle.
  useEffect(() => {
    if (circleRef.current) circleRef.current.setRadius(radius > 0 ? radius : 0);
  }, [radius]);

  return (
    <div
      ref={elRef}
      style={{ height, width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border-subtle)', background: 'var(--surface-subtle)' }}
    />
  );
}
