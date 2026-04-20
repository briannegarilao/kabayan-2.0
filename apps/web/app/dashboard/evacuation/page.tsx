// apps/web/app/dashboard/evacuation/page.tsx
"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Building2, MapPin, Phone, ToggleLeft, ToggleRight, Loader2 } from "lucide-react";
import { createClient } from "../../../lib/supabase/client";
import { useBarangayFilter } from "../../../lib/barangay-filter";

const supabase = createClient();

interface EvacCenter {
  id: string;
  name: string;
  barangay: string;
  address: string | null;
  capacity: number | null;
  current_occupancy: number;
  is_open: boolean;
  contact_number: string | null;
  facilities: string[] | null;
  updated_at: string;
}

function EvacuationPageInner() {
  const { selectedBarangay } = useBarangayFilter();
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus");

  const [centers, setCenters] = useState<EvacCenter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const focusedCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function fetch() {
      let q = supabase
        .from("evacuation_centers")
        .select("id, name, barangay, address, capacity, current_occupancy, is_open, contact_number, facilities, updated_at")
        .order("is_open", { ascending: false })
        .order("name");

      if (selectedBarangay) {
        q = q.eq("barangay", selectedBarangay);
      }

      const { data } = await q;

      setCenters((data as EvacCenter[]) || []);
      setIsLoading(false);
    }
    fetch();
  }, [selectedBarangay]);

  useEffect(() => {
    if (!focusId || isLoading) return;
    const t = setTimeout(() => {
      focusedCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => clearTimeout(t);
  }, [focusId, isLoading, centers]);

  async function toggleOpen(center: EvacCenter) {
    setToggling(center.id);
    const newOpen = !center.is_open;

    const { error } = await supabase
      .from("evacuation_centers")
      .update({
        is_open: newOpen,
        current_occupancy: newOpen ? center.current_occupancy : 0,
      })
      .eq("id", center.id);

    if (!error) {
      setCenters((prev) =>
        prev.map((c) =>
          c.id === center.id
            ? { ...c, is_open: newOpen, current_occupancy: newOpen ? c.current_occupancy : 0 }
            : c
        )
      );
    }
    setToggling(null);
  }

  async function updateOccupancy(centerId: string, delta: number) {
    const center = centers.find((c) => c.id === centerId);
    if (!center) return;

    const newOcc = Math.max(0, Math.min(center.current_occupancy + delta, center.capacity || 9999));

    const { error } = await supabase
      .from("evacuation_centers")
      .update({ current_occupancy: newOcc })
      .eq("id", centerId);

    if (!error) {
      setCenters((prev) =>
        prev.map((c) => c.id === centerId ? { ...c, current_occupancy: newOcc } : c)
      );
    }
  }

  const openCount = centers.filter((c) => c.is_open).length;
  const totalCapacity = centers.reduce((sum, c) => sum + (c.is_open ? (c.capacity || 0) : 0), 0);
  const totalOccupancy = centers.reduce((sum, c) => sum + (c.is_open ? c.current_occupancy : 0), 0);

  if (isLoading) {
    return <div className="flex h-64 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs text-gray-500">
            {selectedBarangay ? `Centers (${selectedBarangay})` : "Total Centers"}
          </p>
          <p className="mt-1 text-2xl font-bold text-white">{centers.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-400/10 p-4">
          <p className="text-xs text-gray-500">Open for Evacuees</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">{openCount}</p>
        </div>
        <div className="rounded-xl border border-blue-500/20 bg-blue-400/10 p-4">
          <p className="text-xs text-gray-500">Occupancy</p>
          <p className="mt-1 text-2xl font-bold text-blue-400">
            {totalOccupancy} / {totalCapacity || "—"}
          </p>
        </div>
      </div>

      {centers.length === 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
          <Building2 className="mx-auto mb-2 h-8 w-8 text-gray-600" />
          <p className="text-sm text-gray-400">
            {selectedBarangay
              ? `No evacuation centers in ${selectedBarangay}.`
              : "No evacuation centers registered."}
          </p>
          <p className="text-xs text-gray-600">Add centers via the Supabase Table Editor.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {centers.map((c) => {
            const occupancyPct = c.capacity ? Math.round((c.current_occupancy / c.capacity) * 100) : 0;
            const isFull = c.capacity ? c.current_occupancy >= c.capacity : false;
            const isFocused = c.id === focusId;

            return (
              <div
                key={c.id}
                ref={isFocused ? focusedCardRef : null}
                className={`rounded-xl border p-4 transition-all ${
                  isFocused
                    ? "border-blue-500 ring-2 ring-blue-500/50 bg-gray-900"
                    : c.is_open
                    ? "border-emerald-500/20 bg-gray-900"
                    : "border-gray-800 bg-gray-900 opacity-60"
                }`}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <h4 className="text-sm font-medium text-white">{c.name}</h4>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="h-3 w-3" />
                      {c.barangay}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleOpen(c)}
                    disabled={toggling === c.id}
                    className="flex items-center gap-1 text-xs transition-colors"
                    title={c.is_open ? "Close center" : "Open for evacuees"}
                  >
                    {toggling === c.id ? (
                      <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
                    ) : c.is_open ? (
                      <ToggleRight className="h-6 w-6 text-emerald-400" />
                    ) : (
                      <ToggleLeft className="h-6 w-6 text-gray-500" />
                    )}
                  </button>
                </div>

                {c.is_open && c.capacity && (
                  <div className="mb-3">
                    <div className="mb-1 flex items-center justify-between text-[10px]">
                      <span className="text-gray-500">Occupancy</span>
                      <span className={isFull ? "text-red-400 font-semibold" : "text-gray-400"}>
                        {c.current_occupancy} / {c.capacity} ({occupancyPct}%)
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-700">
                      <div
                        className={`h-full rounded-full transition-all ${
                          occupancyPct >= 90 ? "bg-red-500" : occupancyPct >= 70 ? "bg-amber-500" : "bg-emerald-500"
                        }`}
                        style={{ width: `${Math.min(occupancyPct, 100)}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <button onClick={() => updateOccupancy(c.id, -5)} className="rounded bg-gray-700 px-2 py-0.5 text-[10px] text-gray-300 hover:bg-gray-600">-5</button>
                      <button onClick={() => updateOccupancy(c.id, -1)} className="rounded bg-gray-700 px-2 py-0.5 text-[10px] text-gray-300 hover:bg-gray-600">-1</button>
                      <span className="flex-1 text-center text-xs text-gray-400">{c.current_occupancy}</span>
                      <button onClick={() => updateOccupancy(c.id, 1)} className="rounded bg-gray-700 px-2 py-0.5 text-[10px] text-gray-300 hover:bg-gray-600">+1</button>
                      <button onClick={() => updateOccupancy(c.id, 5)} className="rounded bg-gray-700 px-2 py-0.5 text-[10px] text-gray-300 hover:bg-gray-600">+5</button>
                    </div>
                  </div>
                )}

                <div className="space-y-1 text-xs text-gray-500">
                  {c.facilities && c.facilities.length > 0 && (
                    <p>Facilities: {c.facilities.join(", ")}</p>
                  )}
                  {c.contact_number && (
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {c.contact_number}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function EvacuationPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-500">Loading...</div>}>
      <EvacuationPageInner />
    </Suspense>
  );
}
