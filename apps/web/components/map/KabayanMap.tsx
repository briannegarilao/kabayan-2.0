// apps/web/components/map/KabayanMap.tsx
"use client";

import dynamic from "next/dynamic";
import type { SOSIncident } from "../../lib/types";

// CRITICAL: Leaflet accesses `window` and `document` at import time.
// dynamic() with ssr:false ensures this only loads in the browser.
const MapContent = dynamic(() => import("./MapContent"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-gray-700 bg-gray-900">
      <div className="text-center">
        <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
        <p className="text-xs text-gray-500">Loading map...</p>
      </div>
    </div>
  ),
});

interface KabayanMapProps {
  incidents: SOSIncident[];
  className?: string;
}

export default function KabayanMap({ incidents, className }: KabayanMapProps) {
  return (
    <div className={className}>
      <MapContent incidents={incidents} />
    </div>
  );
}
