// apps/web/app/dashboard/map/page.tsx
"use client";

import dynamic from "next/dynamic";

// Leaflet accesses `window` at import time — must be browser-only.
// Same dynamic import pattern as KabayanMap.tsx.
const LiveMapView = dynamic(
  () => import("../../../components/map/LiveMapView"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-gray-950">
        <div className="text-center">
          <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
          <p className="text-xs text-gray-500">Loading live map...</p>
        </div>
      </div>
    ),
  }
);

export default function LiveMapPage() {
  // -m-6 cancels the dashboard layout's p-6 padding for full-bleed map.
  // h-[calc(100vh-4rem)] accounts for the 64px header.
  return (
    <div className="-m-6 h-[calc(100vh-4rem)]">
      <LiveMapView />
    </div>
  );
}
