// apps/web/components/dashboard/BarangayFilterIndicator.tsx
"use client";

import { MapPin, X } from "lucide-react";
import { useBarangayFilter } from "../../lib/barangay-filter";

/**
 * A small pill in the header that shows the currently-active barangay filter.
 * Clicking the X clears the filter back to "All".
 * If no filter is active, nothing is rendered.
 */
export function BarangayFilterIndicator() {
  const { selectedBarangay, setSelectedBarangay } = useBarangayFilter();

  if (!selectedBarangay) return null;

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-blue-500/30 bg-blue-600/10 px-3 py-1 text-xs font-medium text-blue-300">
      <MapPin className="h-3 w-3" />
      <span className="max-w-[180px] truncate">{selectedBarangay}</span>
      <button
        onClick={() => setSelectedBarangay(null)}
        className="rounded-full p-0.5 hover:bg-blue-500/20"
        title="Clear barangay filter"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
