// apps/web/hooks/useRealtimeIncidents.ts
"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@kabayan/database/realtime";

export function useRealtimeIncidents(barangay?: string) {
  const [incidents, setIncidents] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initial fetch
  const fetchIncidents = useCallback(async () => {
    let query = supabase
      .from("sos_incidents")
      .select(
        `
        id, status, barangay, flood_severity, flood_severity_score,
        message, image_url, created_at, assigned_at,
        location, reporter:users(full_name, phone_number),
        responder:users!assigned_responder_id(full_name)
      `,
      )
      .in("status", ["pending", "assigned", "in_progress"]) // Only active incidents
      .order("created_at", { ascending: false })
      .limit(100); // Hard cap: never fetch more than 100 active incidents at once

    if (barangay) query = query.eq("barangay", barangay);

    const { data } = await query;
    setIncidents(data || []);
    setIsLoading(false);
  }, [barangay]);

  useEffect(() => {
    fetchIncidents();

    // Subscribe to changes — ONLY active incidents in the target barangay
    const channel = supabase
      .channel("active-incidents")
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT, UPDATE, DELETE
          schema: "public",
          table: "sos_incidents",
          // Filter at the database level — don't stream data the client doesn't need
          filter: barangay ? `barangay=eq.${barangay}` : undefined,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setIncidents((prev) => [payload.new, ...prev].slice(0, 100));
          } else if (payload.eventType === "UPDATE") {
            setIncidents((prev) =>
              prev.map((inc) =>
                inc.id === payload.new.id ? { ...inc, ...payload.new } : inc,
              ),
            );
          } else if (payload.eventType === "DELETE") {
            setIncidents((prev) =>
              prev.filter((inc) => inc.id !== payload.old.id),
            );
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barangay, fetchIncidents]);

  return { incidents, isLoading };
}
