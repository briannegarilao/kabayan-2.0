// apps/web/hooks/useRealtimeIncidents.ts
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "../lib/supabase/client";
import type { SOSIncident } from "../lib/types";

export function useRealtimeIncidents(barangay?: string) {
  const supabase = useMemo(() => createClient(), []);
  const [incidents, setIncidents] = useState<SOSIncident[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initial fetch — named columns only, never SELECT *
  const fetchIncidents = useCallback(async () => {
    setIsLoading(true);

    try {
      let query = supabase
        .from("sos_incidents")
        .select(
          `id, status, barangay, flood_severity, flood_severity_score,
           message, image_url, created_at, assigned_at, location`,
        )
        .in("status", ["pending", "assigned", "in_progress"])
        .order("created_at", { ascending: false })
        .limit(100); // Hard cap — never fetch more than 100 active at once

      if (barangay) {
        query = query.eq("barangay", barangay);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Failed to fetch incidents:", error.message);
        return;
      }

      setIncidents((data as SOSIncident[]) || []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown fetch failure";
      console.error("Failed to fetch incidents:", message);
    } finally {
      setIsLoading(false);
    }
  }, [barangay, supabase]);

  useEffect(() => {
    void fetchIncidents();

    // Subscribe to real-time changes on sos_incidents
    // Filter at DB level — only streams events the client needs
    const channel = supabase
      .channel(`active-incidents:${barangay ?? "all"}`)
      .on(
        "postgres_changes",
        {
          event: "*", // INSERT, UPDATE, DELETE
          schema: "public",
          table: "sos_incidents",
          filter: barangay
            ? `barangay=eq.${barangay}`
            : undefined,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newInc = payload.new as SOSIncident;
            // Only add if it's an active incident
            if (["pending", "assigned", "in_progress"].includes(newInc.status)) {
              setIncidents((prev) => [newInc, ...prev].slice(0, 100));
            }
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as SOSIncident;
            setIncidents((prev) => {
              // If resolved/false_alarm, remove from active list
              if (["resolved", "false_alarm"].includes(updated.status)) {
                return prev.filter((inc) => inc.id !== updated.id);
              }
              // Otherwise update in place
              return prev.map((inc) =>
                inc.id === updated.id ? { ...inc, ...updated } : inc
              );
            });
          } else if (payload.eventType === "DELETE") {
            setIncidents((prev) =>
              prev.filter((inc) => inc.id !== payload.old.id)
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [barangay, fetchIncidents, supabase]);

  return { incidents, isLoading, refetch: fetchIncidents };
}
