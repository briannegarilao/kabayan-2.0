// apps/web/components/dashboard/BarangayFilter.tsx
"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { MapPin, X, ChevronDown, Search, Check } from "lucide-react";
import { DASMARINAS_BARANGAYS } from "../../lib/map-config";
import { useBarangayFilter } from "../../lib/barangay-filter";

export function BarangayFilter() {
  const { selectedBarangay, setSelectedBarangay, userBarangay } =
    useBarangayFilter();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Filtered list
  const filtered = useMemo(() => {
    if (!search.trim()) return DASMARINAS_BARANGAYS;
    const q = search.toLowerCase();
    return DASMARINAS_BARANGAYS.filter((b) => b.toLowerCase().includes(q));
  }, [search]);

  function handleSelect(b: string | null) {
    setSelectedBarangay(b);
    setOpen(false);
    setSearch("");
  }

  return (
    <div ref={rootRef} className="relative">
      {/* Section label */}
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
          Barangay Focus
        </span>
        {selectedBarangay && (
          <button
            onClick={() => handleSelect(null)}
            className="rounded p-0.5 text-gray-500 hover:bg-gray-800 hover:text-gray-300"
            title="Show all barangays"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-xs transition-colors ${
          selectedBarangay
            ? "border-blue-500/30 bg-blue-600/10 text-blue-300"
            : "border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600"
        }`}
      >
        <MapPin className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 truncate">
          {selectedBarangay ?? "All Barangays"}
        </span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-2xl">
          {/* Search */}
          <div className="relative border-b border-gray-800 p-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search barangay..."
              className="w-full rounded-md border border-gray-700 bg-gray-800 py-1.5 pl-8 pr-3 text-xs text-gray-200 placeholder-gray-500 outline-none focus:border-blue-500"
            />
          </div>

          {/* Options */}
          <div className="max-h-72 overflow-y-auto py-1">
            {/* "All" option */}
            <button
              onClick={() => handleSelect(null)}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-gray-800 ${
                selectedBarangay === null ? "text-blue-400" : "text-gray-300"
              }`}
            >
              <Check
                className={`h-3.5 w-3.5 shrink-0 ${
                  selectedBarangay === null ? "opacity-100" : "opacity-0"
                }`}
              />
              <span className="flex-1">All Barangays</span>
              <span className="text-[10px] text-gray-500">Citywide</span>
            </button>

            {/* User's home barangay — surfaced at top if present */}
            {userBarangay && (
              <button
                onClick={() => handleSelect(userBarangay)}
                className={`flex w-full items-center gap-2 border-y border-gray-800 bg-gray-800/30 px-3 py-1.5 text-left text-xs transition-colors hover:bg-gray-800 ${
                  selectedBarangay === userBarangay
                    ? "text-blue-400"
                    : "text-gray-300"
                }`}
              >
                <Check
                  className={`h-3.5 w-3.5 shrink-0 ${
                    selectedBarangay === userBarangay
                      ? "opacity-100"
                      : "opacity-0"
                  }`}
                />
                <span className="flex-1 truncate">{userBarangay}</span>
                <span className="text-[10px] text-emerald-400">Your area</span>
              </button>
            )}

            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-center text-[10px] text-gray-500">
                No barangays match
              </div>
            ) : (
              filtered.map((b) => (
                <button
                  key={b}
                  onClick={() => handleSelect(b)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-gray-800 ${
                    selectedBarangay === b ? "text-blue-400" : "text-gray-300"
                  }`}
                >
                  <Check
                    className={`h-3.5 w-3.5 shrink-0 ${
                      selectedBarangay === b ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <span className="flex-1 truncate">{b}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
