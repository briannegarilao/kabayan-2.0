// app/(tabs)/home.tsx — REPLACES Step 2 version. Adds Realtime trip subscription.
import React, { useState, useEffect } from "react";
import { View, Text, Switch, Alert, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../utils/supabase";
import Config from "../../utils/config";
import {
  startTracking,
  stopTracking,
  onLocationStatusChange,
  getLocationStatus,
  LocationStatus,
} from "../../services/locationTracker";

export default function HomeScreen() {
  const { profile, responder, user, refreshResponder } = useAuth();
  const [toggling, setToggling] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<LocationStatus>(getLocationStatus());

  const isAvailable = responder?.is_available ?? false;
  const currentLoad = responder?.current_load ?? 0;
  const maxCapacity = responder?.max_capacity ?? 10;
  const loadPct = maxCapacity > 0 ? Math.round((currentLoad / maxCapacity) * 100) : 0;

  // Listen for GPS status changes
  useEffect(() => {
    onLocationStatusChange(setGpsStatus);
    return () => {
      onLocationStatusChange(() => {});
    };
  }, []);

  // Auto-start/stop tracking based on duty status
  useEffect(() => {
    if (isAvailable && user) {
      startTracking(user.id);
    } else {
      stopTracking();
    }
  }, [isAvailable, user]);

  // Realtime subscription: listen for NEW trip assignments for this responder
  // When the engine creates a trip_plan with this responder_id, navigate to the assignment alert
  useEffect(() => {
    if (!user) return;

    const channelId = `trip-assign-${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trip_plans",
          filter: `responder_id=eq.${user.id}`,
        },
        (payload) => {
          const newTrip = payload.new as any;
          if (newTrip.status === "active") {
            // Navigate to assignment alert screen
            router.push({
              pathname: "/assignment",
              params: { tripId: newTrip.id },
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // Also check on mount: is there an active trip already assigned to me?
  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data } = await supabase
        .from("trip_plans")
        .select("id, status")
        .eq("responder_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        // There's an active trip — navigate to assignment alert
        router.push({
          pathname: "/assignment",
          params: { tripId: data.id },
        });
      }
    })();
  }, [user]);

  async function toggleDuty(value: boolean) {
    if (!user) return;
    setToggling(true);

    try {
      const resp = await fetch(
        `${Config.API_BASE_URL}/api/responders/${user.id}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_available: value }),
        }
      );

      if (!resp.ok) {
        Alert.alert("Error", "Failed to update duty status.");
        return;
      }

      await refreshResponder();
    } catch (e) {
      Alert.alert("Error", "Cannot reach server. Check your connection.");
    } finally {
      setToggling(false);
    }
  }

  function formatTime(iso: string | null): string {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0f172a", padding: 20, paddingTop: 50 }}>
      {/* Header */}
      <View style={{ marginBottom: 24 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: "#f59e0b" }}>
          {responder?.team_name || "Rescue Team"}
        </Text>
        <Text style={{ fontSize: 13, color: "#94a3b8", marginTop: 2 }}>
          {profile?.full_name || "Responder"} · {profile?.barangay}
        </Text>
      </View>

      {/* Duty Toggle Card */}
      <View
        style={{
          backgroundColor: isAvailable ? "#22c55e10" : "#1e293b",
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
          borderWidth: 1,
          borderColor: isAvailable ? "#22c55e30" : "#334155",
        }}
      >
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ color: "#e2e8f0", fontSize: 16, fontWeight: "600" }}>Duty Status</Text>
            <Text
              style={{
                color: isAvailable ? "#22c55e" : "#dc2626",
                fontSize: 14,
                fontWeight: "700",
                marginTop: 4,
              }}
            >
              {isAvailable ? "ON DUTY — Available" : "OFF DUTY"}
            </Text>
          </View>
          {toggling ? (
            <ActivityIndicator color="#f59e0b" />
          ) : (
            <Switch
              value={isAvailable}
              onValueChange={toggleDuty}
              trackColor={{ false: "#334155", true: "#22c55e40" }}
              thumbColor={isAvailable ? "#22c55e" : "#64748b"}
            />
          )}
        </View>
      </View>

      {/* GPS Status Card */}
      {isAvailable && (
        <View
          style={{
            backgroundColor: "#1e293b",
            borderRadius: 16,
            padding: 16,
            marginBottom: 16,
            borderLeftWidth: 3,
            borderLeftColor: gpsStatus.isTracking && !gpsStatus.error ? "#22c55e" : "#f59e0b",
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
              GPS Tracking
            </Text>
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: gpsStatus.isTracking && !gpsStatus.error ? "#22c55e" : "#f59e0b",
              }}
            />
          </View>
          {gpsStatus.lastLat && gpsStatus.lastLng ? (
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: "#94a3b8", fontSize: 12 }}>
                {gpsStatus.lastLat.toFixed(5)}, {gpsStatus.lastLng.toFixed(5)}
              </Text>
              <Text style={{ color: "#475569", fontSize: 11, marginTop: 2 }}>
                Last update: {formatTime(gpsStatus.lastUpdate)}
              </Text>
            </View>
          ) : (
            <Text style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>Acquiring GPS...</Text>
          )}
          <Text style={{ color: "#475569", fontSize: 10, marginTop: 6 }}>Updating every 15 seconds</Text>
        </View>
      )}

      {/* Load Bar */}
      <View style={{ backgroundColor: "#1e293b", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <Text style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
            Vehicle Load
          </Text>
          <Text
            style={{
              color: loadPct >= 80 ? "#dc2626" : loadPct >= 50 ? "#f59e0b" : "#22c55e",
              fontSize: 14,
              fontWeight: "700",
            }}
          >
            {currentLoad}/{maxCapacity}
          </Text>
        </View>
        <View style={{ height: 12, backgroundColor: "#334155", borderRadius: 6, overflow: "hidden" }}>
          <View
            style={{
              height: 12,
              borderRadius: 6,
              backgroundColor: loadPct >= 80 ? "#dc2626" : loadPct >= 50 ? "#f59e0b" : "#22c55e",
              width: `${Math.min(loadPct, 100)}%`,
            }}
          />
        </View>
        <Text style={{ color: "#64748b", fontSize: 11, marginTop: 6, textAlign: "center" }}>
          {currentLoad === 0 ? "Vehicle empty — ready for assignment" : `${currentLoad} people on board`}
        </Text>
      </View>

      {/* Status Message */}
      <View style={{ backgroundColor: "#1e293b", borderRadius: 16, padding: 20, alignItems: "center" }}>
        {isAvailable ? (
          <>
            <Text style={{ color: "#22c55e", fontSize: 14, fontWeight: "600" }}>Waiting for assignment...</Text>
            <Text style={{ color: "#64748b", fontSize: 12, marginTop: 4, textAlign: "center" }}>
              GPS is streaming. You will receive an alert when a citizen sends an SOS.
            </Text>
          </>
        ) : (
          <>
            <Text style={{ color: "#dc2626", fontSize: 14, fontWeight: "600" }}>You are off duty</Text>
            <Text style={{ color: "#64748b", fontSize: 12, marginTop: 4, textAlign: "center" }}>
              Toggle duty ON to start GPS tracking and receive assignments.
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
