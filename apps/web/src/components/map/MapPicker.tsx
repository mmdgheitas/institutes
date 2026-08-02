'use client';

import dynamic from 'next/dynamic';

// Leaflet is not SSR-safe — load it only in the browser.
const LeafletMap = dynamic(() => import('./LeafletMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 w-full animate-pulse items-center justify-center rounded-card bg-slate-100 text-sm text-slate-400">
      در حال بارگذاری نقشه…
    </div>
  ),
});

export interface LatLngValue {
  lat: number;
  lng: number;
}

export function MapPicker({
  value,
  onChange,
  height = 280,
}: {
  value: LatLngValue;
  onChange: (value: LatLngValue) => void;
  height?: number;
}) {
  return (
    <div dir="ltr">
      <LeafletMap value={value} onChange={onChange} height={height} />
    </div>
  );
}

