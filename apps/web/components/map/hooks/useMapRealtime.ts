// apps/web/components/map/hooks/useMapRealtime.ts
"use client";

import { useEffect } from "react";
import { createClient } from "../../../lib/supabase/client";
import type { EvacCenter, Responder, SOSIncident, TripPlan } from "../types";

const supabase = createClient();

export function useMapRealtime(
  selectedBarangay: string | null,
  disposedRef: React.MutableRefObject<boolean>,
  setIncidents: React.Dispatch<React.SetStateAction<SOSIncident[]>>,
  setResponders: React.Dispatch<React.SetStateAction<Responder[]>>,
  setEvacCenters: React.Dispatch<React.SetStateAction<EvacCenter[]>>,
  setActiveTrips: React.Dispatch<React.SetStateAction<TripPlan[]>>,
) {
  useEffect(() => {
    const channelId = `livemap-${Date.now()}`;

    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sos_incidents" },
        (payload) => {
          if (disposedRef.current) return;

          if (payload.eventType === "INSERT") {
            const n = payload.new as SOSIncident;
            if (!["pending", "assigned", "in_progress"].includes(n.status))
              return;
            if (selectedBarangay && n.barangay !== selectedBarangay) return;
            setIncidents((prev) => [n, ...prev]);
          } else if (payload.eventType === "UPDATE") {
            const u = payload.new as SOSIncident;
            if (["resolved", "false_alarm"].includes(u.status)) {
              setIncidents((prev) => prev.filter((i) => i.id !== u.id));
            } else if (selectedBarangay && u.barangay !== selectedBarangay) {
              setIncidents((prev) => prev.filter((i) => i.id !== u.id));
            } else {
              setIncidents((prev) =>
                prev.map((i) => (i.id === u.id ? { ...i, ...u } : i)),
              );
            }
          } else if (payload.eventType === "DELETE") {
            setIncidents((prev) =>
              prev.filter((i) => i.id !== (payload.old as any).id),
            );
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "responders" },
        (payload) => {
          if (disposedRef.current) return;

          setResponders((prev) =>
            prev.map((r) =>
              r.id !== payload.new.id
                ? r
                : {
                    ...r,
                    ...(payload.new as any),
                    home_barangay: r.home_barangay,
                  },
            ),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "evacuation_centers" },
        (payload) => {
          if (disposedRef.current) return;
          const u = payload.new as EvacCenter;
          if (selectedBarangay && u.barangay !== selectedBarangay) return;

          setEvacCenters((prev) =>
            prev.map((e) => (e.id === u.id ? { ...e, ...u } : e)),
          );
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trip_plans" },
        (payload) => {
          if (disposedRef.current) return;

          if (payload.eventType === "INSERT") {
            const n = payload.new as TripPlan;
            if (n.status === "active") {
              setActiveTrips((prev) => [...prev, n]);
            }
          } else if (payload.eventType === "UPDATE") {
            const u = payload.new as TripPlan;
            if (u.status === "active") {
              setActiveTrips((prev) => {
                const has = prev.find((t) => t.id === u.id);
                return has
                  ? prev.map((t) => (t.id === u.id ? u : t))
                  : [...prev, u];
              });
            } else {
              setActiveTrips((prev) => prev.filter((t) => t.id !== u.id));
            }
          } else if (payload.eventType === "DELETE") {
            setActiveTrips((prev) =>
              prev.filter((t) => t.id !== (payload.old as any).id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [
    selectedBarangay,
    disposedRef,
    setIncidents,
    setResponders,
    setEvacCenters,
    setActiveTrips,
  ]);
}
