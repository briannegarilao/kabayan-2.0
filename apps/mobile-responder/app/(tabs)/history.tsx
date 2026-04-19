// app/(tabs)/history.tsx — REPLACES the placeholder
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../utils/supabase";

interface CompletedTrip {
  id: string;
  status: string;
  stops: any[];
  evac_center_id: string | null;
  total_distance_km: number | null;
  estimated_time_minutes: number | null;
  created_at: string;
  completed_at: string | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });
}

function durationMinutes(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hrs}h ${rem}m`;
}

export default function HistoryScreen() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<CompletedTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchHistory() {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("trip_plans")
        .select("id, status, stops, evac_center_id, total_distance_km, estimated_time_minutes, created_at, completed_at")
        .eq("responder_id", user.id)
        .in("status", ["completed", "cancelled"])
        .order("created_at", { ascending: false })
        .limit(20);

      if (data) setTrips(data as CompletedTrip[]);
    } catch (e) {
      console.warn("History fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHistory();
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  }, [user]);

  // Compute lifetime stats from loaded data (no extra query)
  const completedTrips = trips.filter((t) => t.status === "completed");
  const totalPeopleRescued = completedTrips.reduce((sum, t) => {
    const pickups = (t.stops || []).filter((s: any) => s.type === "pickup");
    return sum + pickups.reduce((pSum: number, s: any) => pSum + (s.people_count || 0), 0);
  }, 0);
  const totalDistance = completedTrips.reduce((sum, t) => sum + (t.total_distance_km || 0), 0);

  function renderItem({ item }: { item: CompletedTrip }) {
    const pickups = (item.stops || []).filter((s: any) => s.type === "pickup");
    const dropoff = (item.stops || []).find((s: any) => s.type === "dropoff");
    const peopleRescued = pickups.reduce((sum: number, s: any) => sum + (s.people_count || 0), 0);
    const isCancelled = item.status === "cancelled";

    return (
      <View
        style={{
          backgroundColor: "#1e293b",
          borderRadius: 12,
          padding: 16,
          marginBottom: 10,
          borderLeftWidth: 3,
          borderLeftColor: isCancelled ? "#64748b" : "#22c55e",
          opacity: isCancelled ? 0.6 : 1,
        }}
      >
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <View style={{ backgroundColor: isCancelled ? "#64748b15" : "#22c55e15", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
            <Text style={{ color: isCancelled ? "#64748b" : "#22c55e", fontSize: 10, fontWeight: "700" }}>
              {isCancelled ? "CANCELLED" : "COMPLETED"}
            </Text>
          </View>
          <Text style={{ color: "#64748b", fontSize: 11 }}>
            {formatDate(item.created_at)}
          </Text>
        </View>

        {/* Stops summary */}
        <View style={{ gap: 4 }}>
          {pickups.map((stop: any, i: number) => (
            <Text key={i} style={{ color: "#e2e8f0", fontSize: 13 }}>
              Stop {i + 1}: {stop.barangay || "—"} ({stop.people_count} people)
            </Text>
          ))}
          {dropoff && (
            <Text style={{ color: "#3b82f6", fontSize: 12, marginTop: 2 }}>
              → {(dropoff as any).evac_center_name || dropoff.barangay || "Evacuation Center"}
            </Text>
          )}
        </View>

        {/* Stats row */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#334155" }}>
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: "#f59e0b", fontSize: 15, fontWeight: "700" }}>{peopleRescued}</Text>
            <Text style={{ color: "#64748b", fontSize: 10 }}>rescued</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: "#94a3b8", fontSize: 15, fontWeight: "700" }}>{pickups.length}</Text>
            <Text style={{ color: "#64748b", fontSize: 10 }}>stops</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: "#94a3b8", fontSize: 15, fontWeight: "700" }}>
              {item.total_distance_km ? `${item.total_distance_km.toFixed(1)}` : "—"}
            </Text>
            <Text style={{ color: "#64748b", fontSize: 10 }}>km</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <Text style={{ color: "#94a3b8", fontSize: 15, fontWeight: "700" }}>
              {durationMinutes(item.created_at, item.completed_at)}
            </Text>
            <Text style={{ color: "#64748b", fontSize: 10 }}>duration</Text>
          </View>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0f172a", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0f172a", paddingTop: 50 }}>
      <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#e2e8f0" }}>Trip History</Text>
        <Text style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
          {completedTrips.length} completed · {totalPeopleRescued} people rescued · {totalDistance.toFixed(1)} km total
        </Text>
      </View>

      <FlatList
        data={trips}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#f59e0b" colors={["#f59e0b"]} />
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Text style={{ color: "#64748b", fontSize: 14 }}>No trips yet.</Text>
            <Text style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>
              Completed rescue operations will appear here.
            </Text>
          </View>
        }
      />
    </View>
  );
}
