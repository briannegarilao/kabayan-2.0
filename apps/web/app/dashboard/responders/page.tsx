// apps/web/app/dashboard/responders/page.tsx
"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Users, Clock, Truck, Wifi, WifiOff, MapPin } from "lucide-react";
import { createClient } from "../../../lib/supabase/client";
import { useBarangayFilter } from "../../../lib/barangay-filter";
import type { Responder } from "../../../lib/types";

const supabase = createClient();

function RespondersPageInner() {
  const { selectedBarangay } = useBarangayFilter();
  const searchParams = useSearchParams();
  const focusId = searchParams.get("focus");

  const [responders, setResponders] = useState<Responder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const focusedCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function fetch() {
      let q = supabase
        .from("responders")
        .select(`
          id, is_available, current_location, current_incident_id,
          last_location_update, vehicle_type, team_name, barangay
        `)
        .order("is_available", { ascending: false });

      if (selectedBarangay) {
        q = q.eq("barangay", selectedBarangay);
      }

      const { data, error } = await q;

      if (!error && data) setResponders(data as Responder[]);
      setIsLoading(false);
    }

    fetch();

    const channel = supabase
      .channel(`responder-updates-${Date.now()}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "responders",
      }, (payload) => {
        if (payload.eventType === "UPDATE") {
          const u = payload.new as any;
          // If barangay filter is active and the new row doesn't match, drop it
          if (selectedBarangay && u.barangay !== selectedBarangay) {
            setResponders((prev) => prev.filter((r) => r.id !== u.id));
          } else {
            setResponders((prev) =>
              prev.map((r) => r.id === u.id ? { ...r, ...u } : r)
            );
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedBarangay]);

  useEffect(() => {
    if (!focusId || isLoading) return;
    const t = setTimeout(() => {
      focusedCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    return () => clearTimeout(t);
  }, [focusId, isLoading, responders]);

  const available = responders.filter((r) => r.is_available);
  const onDuty = responders.filter((r) => !r.is_available);

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-600 border-t-blue-400" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-800 bg-gray-900 p-4">
          <p className="text-xs text-gray-500">
            {selectedBarangay ? `Responders (${selectedBarangay})` : "Total Responders"}
          </p>
          <p className="mt-1 text-2xl font-bold text-white">{responders.length}</p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-400/10 p-4">
          <p className="text-xs text-gray-500">Available</p>
          <p className="mt-1 text-2xl font-bold text-emerald-400">{available.length}</p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-400/10 p-4">
          <p className="text-xs text-gray-500">On Duty</p>
          <p className="mt-1 text-2xl font-bold text-amber-400">{onDuty.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {responders.length === 0 ? (
          <div className="col-span-full rounded-xl border border-gray-800 bg-gray-900 p-8 text-center">
            <Users className="mx-auto mb-2 h-8 w-8 text-gray-600" />
            <p className="text-sm text-gray-400">
              {selectedBarangay
                ? `No responders registered in ${selectedBarangay}.`
                : "No responders registered yet."}
            </p>
            <p className="text-xs text-gray-600">Responders are added via the mobile app.</p>
          </div>
        ) : (
          responders.map((r) => {
            const isFocused = r.id === focusId;
            return (
              <div
                key={r.id}
                ref={isFocused ? focusedCardRef : null}
                className={`rounded-xl border p-4 transition-all ${
                  isFocused
                    ? "border-blue-500 ring-2 ring-blue-500/50 bg-gray-900"
                    : r.is_available
                    ? "border-emerald-500/20 bg-gray-900"
                    : "border-amber-500/20 bg-gray-900"
                }`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${r.is_available ? "bg-emerald-400" : "bg-amber-400"}`} />
                    <span className="text-sm font-medium text-gray-200">
                      {r.team_name || "Responder"}
                    </span>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    r.is_available
                      ? "bg-emerald-400/10 text-emerald-400"
                      : "bg-amber-400/10 text-amber-400"
                  }`}>
                    {r.is_available ? "Available" : "On Duty"}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-gray-400">
                  {(r as any).barangay && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 text-gray-600" />
                      {(r as any).barangay}
                    </div>
                  )}
                  {r.vehicle_type && (
                    <div className="flex items-center gap-1.5">
                      <Truck className="h-3 w-3 text-gray-600" />
                      {r.vehicle_type}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    {r.current_location ? (
                      <Wifi className="h-3 w-3 text-emerald-500" />
                    ) : (
                      <WifiOff className="h-3 w-3 text-gray-600" />
                    )}
                    {r.current_location ? "GPS Active" : "No GPS signal"}
                  </div>
                  {r.last_location_update && (
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3 w-3 text-gray-600" />
                      Last update: {formatDistanceToNow(new Date(r.last_location_update), { addSuffix: true })}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function RespondersPage() {
  return (
    <Suspense fallback={<div className="text-sm text-gray-500">Loading...</div>}>
      <RespondersPageInner />
    </Suspense>
  );
}
