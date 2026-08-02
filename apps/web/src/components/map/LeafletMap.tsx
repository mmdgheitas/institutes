'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLngValue } from './MapPicker';

const TEHRAN_CENTER: [number, number] = [35.7219, 51.3347];

const markerIcon = L.divIcon({
  className: '',
  html: `<div style="width:22px;height:22px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#2563eb;border:3px solid white;box-shadow:0 2px 8px rgba(37,99,235,.5);"></div>`,
  iconSize: [22, 22],
  iconAnchor: [11, 22],
});

export default function LeafletMap({
  value,
  onChange,
  height,
}: {
  value: LatLngValue;
  onChange: (value: LatLngValue) => void;
  height: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: TEHRAN_CENTER,
      zoom: 11,
      scrollWheelZoom: false,
    });

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    mapRef.current = map;

    const marker = L.marker(TEHRAN_CENTER, { icon: markerIcon, draggable: true }).addTo(map);
    markerRef.current = marker;

    const sync = (latlng: L.LatLng) => {
      marker.setLatLng(latlng);
      map.panTo(latlng);
      onChangeRef.current({ lat: Number(latlng.lat.toFixed(6)), lng: Number(latlng.lng.toFixed(6)) });
    };

    marker.on('dragend', () => {
      const latlng = marker.getLatLng();
      onChangeRef.current({ lat: Number(latlng.lat.toFixed(6)), lng: Number(latlng.lng.toFixed(6)) });
    });

    map.on('click', (event: L.LeafletMouseEvent) => sync(event.latlng));

    // Apply the initial value once the tiles are ready.
    map.whenReady(() => {
      if (value.lat && value.lng) {
        const latlng = L.latLng(value.lat, value.lng);
        marker.setLatLng(latlng);
        map.setView(latlng, Math.max(map.getZoom(), 14));
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep marker in sync when the parent resets coordinates.
  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    if (value.lat && value.lng) {
      const latlng = L.latLng(value.lat, value.lng);
      if (marker.getLatLng().distanceTo(latlng) > 5) {
        marker.setLatLng(latlng);
        map.panTo(latlng);
      }
    }
  }, [value.lat, value.lng]);

  return (
    <div
      ref={containerRef}
      style={{ height }}
      className="z-0 w-full overflow-hidden rounded-card border border-slate-200"
      aria-label="انتخاب موقعیت روی نقشه — برای تغییر موقعیت، روی نقشه کلیک کنید یا نشانگر را بکشید"
    />
  );
}
