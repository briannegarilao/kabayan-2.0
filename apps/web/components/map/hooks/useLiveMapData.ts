"use client";

import { useEffect, useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import type { EvacCenter, Responder, SOSIncident, TripPlan } from "../types";

const supabase = createClient();

export function useLiveMapData(
  selectedBarangay: string | null,
  disposedRef: React.MutableRefObject<boolean>,
) {
  const [incidents, setIncidents] = useState<SOSIncident[]>([]);
  const [responders, setResponders] = useState<Responder[]>([]);
  const [evacCenters, setEvacCenters] = useState<EvacCenter[]>([]);
  const [activeTrips, setActiveTrips] = useState<TripPlan[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let incQ = supabase
        .from("sos_incidents")
        .select(
          "id, barangay, flood_severity, status, people_count, message, location, created_at",
        )
        .in("status", ["pending", "assigned", "in_progress"])
        .limit(200);

      if (selectedBarangay) incQ = incQ.eq("barangay", selectedBarangay);

      let evacQ = supabase
        .from("evacuation_centers")
        .select(
          "id, name, barangay, capacity, current_occupancy, is_open, location",
        );

      if (selectedBarangay) evacQ = evacQ.eq("barangay", selectedBarangay);

      const [incRes, respRes, evacRes, tripRes] = await Promise.all([
        incQ,
        supabase
          .from("responders")
          .select(
            "id, team_name, vehicle_type, is_available, current_load, max_capacity, current_location, last_location_update",
          ),
        evacQ,
        supabase
          .from("trip_plans")
          .select(
            "id, responder_id, status, stops, route_geometry, route_distance_meters, route_duration_seconds",
          )
          .eq("status", "active"),
      ]);

      if (cancelled || disposedRef.current) return;

      if (incRes.error)
        console.error("[LiveMap] incidents error:", incRes.error);
      if (respRes.error)
        console.error("[LiveMap] responders error:", respRes.error);
      if (evacRes.error) console.error("[LiveMap] evacs error:", evacRes.error);
      if (tripRes.error) console.error("[LiveMap] trips error:", tripRes.error);

      if (incRes.data) setIncidents(incRes.data as SOSIncident[]);

      if (respRes.data) {
        const responderIds = (respRes.data as any[])
          .map((r) => r.id)
          .filter(Boolean);

        const barangayById = new Map<string, string>();

        if (responderIds.length > 0) {
          const respUsersRes = await supabase
            .from("users")
            .select("id, barangay")
            .in("id", responderIds);

          if (cancelled || disposedRef.current) return;

          if (respUsersRes.error) {
            console.warn("[LiveMap] users barangay error:", respUsersRes.error);
          } else {
            (respUsersRes.data ?? []).forEach((u: any) => {
              if (u?.id && u?.barangay) barangayById.set(u.id, u.barangay);
            });
          }
        }

        const merged: Responder[] = (respRes.data as any[]).map((r) => ({
          id: r.id,
          team_name: r.team_name,
          vehicle_type: r.vehicle_type,
          is_available: r.is_available,
          current_load: r.current_load,
          max_capacity: r.max_capacity,
          current_location: r.current_location,
          last_location_update: r.last_location_update,
          home_barangay: barangayById.get(r.id) ?? null,
        }));

        setResponders(merged);
      }

      if (evacRes.data) setEvacCenters(evacRes.data as EvacCenter[]);
      if (tripRes.data) setActiveTrips(tripRes.data as TripPlan[]);
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedBarangay, disposedRef]);

  return {
    incidents,
    setIncidents,
    responders,
    setResponders,
    evacCenters,
    setEvacCenters,
    activeTrips,
    setActiveTrips,
  };
}
