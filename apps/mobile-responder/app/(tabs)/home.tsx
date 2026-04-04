// app/(tabs)/home.tsx
import React, { useState } from "react";
import { View, Text, Switch, Alert, ActivityIndicator } from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import Config from "../../utils/config";

export default function HomeScreen() {
  const { profile, responder, user, refreshResponder } = useAuth();
  const [toggling, setToggling] = useState(false);

  const isAvailable = responder?.is_available ?? false;
  const currentLoad = responder?.current_load ?? 0;
  const maxCapacity = responder?.max_capacity ?? 10;
  const loadPct = maxCapacity > 0 ? Math.round((currentLoad / maxCapacity) * 100) : 0;

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

      // Refresh local responder data
      await refreshResponder();
    } catch (e) {
      Alert.alert("Error", "Cannot reach server. Check your connection.");
    } finally {
      setToggling(false);
    }
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
            <Text style={{ color: "#e2e8f0", fontSize: 16, fontWeight: "600" }}>
              Duty Status
            </Text>
            <Text style={{ color: isAvailable ? "#22c55e" : "#dc2626", fontSize: 14, fontWeight: "700", marginTop: 4 }}>
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

      {/* Vehicle Info */}
      <View style={{ backgroundColor: "#1e293b", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <Text style={{ color: "#64748b", fontSize: 11, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
          Vehicle
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: "#94a3b8", fontSize: 13 }}>Type</Text>
          <Text style={{ color: "#e2e8f0", fontSize: 13 }}>{responder?.vehicle_type || "—"}</Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
          <Text style={{ color: "#94a3b8", fontSize: 13 }}>Max Capacity</Text>
          <Text style={{ color: "#e2e8f0", fontSize: 13 }}>{maxCapacity} people</Text>
        </View>
      </View>

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
          {currentLoad === 0
            ? "Vehicle empty — ready for assignment"
            : `${currentLoad} people on board`}
        </Text>
      </View>

      {/* Status Message */}
      <View style={{ backgroundColor: "#1e293b", borderRadius: 16, padding: 20, alignItems: "center" }}>
        {isAvailable ? (
          <>
            <Text style={{ color: "#22c55e", fontSize: 14, fontWeight: "600" }}>
              Waiting for assignment...
            </Text>
            <Text style={{ color: "#64748b", fontSize: 12, marginTop: 4, textAlign: "center" }}>
              You will receive an assignment when a citizen sends an SOS near your location.
            </Text>
          </>
        ) : (
          <>
            <Text style={{ color: "#dc2626", fontSize: 14, fontWeight: "600" }}>
              You are off duty
            </Text>
            <Text style={{ color: "#64748b", fontSize: 12, marginTop: 4, textAlign: "center" }}>
              Toggle duty ON to start receiving assignments and enable GPS tracking.
            </Text>
          </>
        )}
      </View>
    </View>
  );
}
