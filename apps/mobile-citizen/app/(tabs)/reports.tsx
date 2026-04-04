// app/(tabs)/reports.tsx — REPLACES the placeholder
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../utils/supabase";

interface SOSReport {
  id: string;
  status: string;
  barangay: string;
  message: string | null;
  people_count: number;
  created_at: string;
  flood_severity: string | null;
}

const STATUS_COLORS: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  pending: { color: "#f59e0b", bg: "#f59e0b15", label: "Pending" },
  assigned: { color: "#3b82f6", bg: "#3b82f615", label: "Assigned" },
  in_progress: { color: "#8b5cf6", bg: "#8b5cf615", label: "En Route" },
  resolved: { color: "#22c55e", bg: "#22c55e15", label: "Resolved" },
  false_alarm: { color: "#64748b", bg: "#64748b15", label: "False Alarm" },
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHrs = Math.floor(diffMin / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  const diffDays = Math.floor(diffHrs / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

export default function ReportsScreen() {
  const { user } = useAuth();
  const [reports, setReports] = useState<SOSReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Fetch citizen's own SOS reports — one query, no polling
  async function fetchReports() {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("sos_incidents")
        .select(
          "id, status, barangay, message, people_count, created_at, flood_severity",
        )
        .eq("reporter_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30);
      if (data) setReports(data);
    } catch (e) {
      console.warn("Reports fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReports();
  }, [user]);

  // Real-time: update status when it changes for any of this user's reports
  useEffect(() => {
    if (!user) return;

    const channelId = `my-reports-${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sos_incidents",
          filter: `reporter_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as SOSReport;
          setReports((prev) =>
            prev.map((r) =>
              r.id === updated.id ? { ...r, status: updated.status } : r,
            ),
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchReports();
    setRefreshing(false);
  }, [user]);

  function renderItem({ item }: { item: SOSReport }) {
    const statusConfig = STATUS_COLORS[item.status] || STATUS_COLORS.pending;

    return (
      <TouchableOpacity
        onPress={() =>
          router.push({
            pathname: "/sos-confirm",
            params: { incidentId: item.id },
          })
        }
        style={{
          backgroundColor: "#1e293b",
          borderRadius: 12,
          padding: 16,
          marginBottom: 10,
          borderLeftWidth: 3,
          borderLeftColor: statusConfig.color,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 6,
          }}
        >
          <View
            style={{
              backgroundColor: statusConfig.bg,
              borderRadius: 6,
              paddingHorizontal: 8,
              paddingVertical: 2,
            }}
          >
            <Text
              style={{
                color: statusConfig.color,
                fontSize: 11,
                fontWeight: "700",
              }}
            >
              {statusConfig.label}
            </Text>
          </View>
          <Text style={{ color: "#64748b", fontSize: 11 }}>
            {timeAgo(item.created_at)}
          </Text>
        </View>

        <Text style={{ color: "#e2e8f0", fontSize: 14, fontWeight: "600" }}>
          {item.barangay} — {item.people_count}{" "}
          {item.people_count === 1 ? "person" : "people"}
        </Text>

        {item.message && (
          <Text
            style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}
            numberOfLines={2}
          >
            {item.message}
          </Text>
        )}

        <Text style={{ color: "#475569", fontSize: 11, marginTop: 6 }}>
          Tap to view details
        </Text>
      </TouchableOpacity>
    );
  }

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0f172a",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0f172a", paddingTop: 50 }}>
      <Text
        style={{
          fontSize: 20,
          fontWeight: "700",
          color: "#e2e8f0",
          paddingHorizontal: 20,
          marginBottom: 16,
        }}
      >
        My Reports
      </Text>

      <FlatList
        data={reports}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
            colors={["#3b82f6"]}
          />
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Text style={{ color: "#64748b", fontSize: 14 }}>
              No SOS reports yet.
            </Text>
            <Text style={{ color: "#475569", fontSize: 12, marginTop: 4 }}>
              Your submitted reports will appear here.
            </Text>
          </View>
        }
      />
    </View>
  );
}
