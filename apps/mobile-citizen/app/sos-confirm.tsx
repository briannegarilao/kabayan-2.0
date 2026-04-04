// app/sos-confirm.tsx — REPLACES the Step 3 version. Adds responder tracking.
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "../utils/supabase";

const STATUS_CONFIG: Record<
  string,
  { color: string; bg: string; label: string; message: string }
> = {
  pending: {
    color: "#f59e0b",
    bg: "#f59e0b15",
    label: "PENDING",
    message: "Your SOS has been received. Looking for available responders...",
  },
  assigned: {
    color: "#3b82f6",
    bg: "#3b82f615",
    label: "ASSIGNED",
    message: "A rescue team has been assigned and is preparing to respond.",
  },
  in_progress: {
    color: "#8b5cf6",
    bg: "#8b5cf615",
    label: "EN ROUTE",
    message:
      "A rescue team is on the way to your location. Stay visible and safe.",
  },
  resolved: {
    color: "#22c55e",
    bg: "#22c55e15",
    label: "RESOLVED",
    message: "Your incident has been resolved. Stay safe.",
  },
};

interface ResponderInfo {
  team_name: string | null;
  vehicle_type: string | null;
  last_update: string | null;
}

export default function SOSConfirmScreen() {
  const { incidentId } = useLocalSearchParams<{ incidentId: string }>();
  const [status, setStatus] = useState("pending");
  const [responder, setResponder] = useState<ResponderInfo | null>(null);
  const [incidentDetails, setIncidentDetails] = useState<any>(null);

  // Fetch initial state + subscribe to changes
  useEffect(() => {
    if (!incidentId) return;

    // One initial query
    supabase
      .from("sos_incidents")
      .select(
        "status, assigned_responder_id, barangay, people_count, message, created_at",
      )
      .eq("id", incidentId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setStatus(data.status);
          setIncidentDetails(data);
          if (data.assigned_responder_id) {
            fetchResponder(data.assigned_responder_id);
          }
        }
      });

    // Realtime subscription — filtered to this specific incident
    const channel = supabase
      .channel(`sos-track-${incidentId}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sos_incidents",
          filter: `id=eq.${incidentId}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setStatus(updated.status);
          if (updated.assigned_responder_id) {
            fetchResponder(updated.assigned_responder_id);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [incidentId]);

  // Fetch responder details — one query, only when assigned
  async function fetchResponder(responderId: string) {
    try {
      const { data } = await supabase
        .from("responders")
        .select("team_name, vehicle_type, last_location_update")
        .eq("id", responderId)
        .maybeSingle();
      if (data) {
        setResponder({
          team_name: data.team_name,
          vehicle_type: data.vehicle_type,
          last_update: data.last_location_update,
        });
      }
    } catch {
      // Non-critical
    }
  }

  const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#0f172a" }}
      contentContainerStyle={{ padding: 20, paddingTop: 60, paddingBottom: 40 }}
    >
      {/* Status Header */}
      <View style={{ alignItems: "center", marginBottom: 28 }}>
        <View
          style={{
            width: 72,
            height: 72,
            borderRadius: 36,
            backgroundColor: config.bg,
            justifyContent: "center",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          {status === "pending" ? (
            <ActivityIndicator size="large" color={config.color} />
          ) : (
            <Text style={{ fontSize: 28 }}>
              {status === "assigned"
                ? "🚨"
                : status === "in_progress"
                  ? "🚁"
                  : "✅"}
            </Text>
          )}
        </View>

        <View
          style={{
            backgroundColor: config.bg,
            borderRadius: 8,
            paddingHorizontal: 14,
            paddingVertical: 4,
            marginBottom: 8,
          }}
        >
          <Text
            style={{ color: config.color, fontSize: 13, fontWeight: "700" }}
          >
            {config.label}
          </Text>
        </View>

        <Text
          style={{
            color: "#e2e8f0",
            fontSize: 18,
            fontWeight: "700",
            textAlign: "center",
          }}
        >
          SOS Submitted
        </Text>
        <Text
          style={{
            color: "#94a3b8",
            fontSize: 13,
            textAlign: "center",
            marginTop: 6,
            lineHeight: 20,
            paddingHorizontal: 20,
          }}
        >
          {config.message}
        </Text>
      </View>

      {/* Incident Details */}
      {incidentDetails && (
        <View
          style={{
            backgroundColor: "#1e293b",
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
          }}
        >
          <Text
            style={{
              color: "#64748b",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Details
          </Text>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 8,
            }}
          >
            <Text style={{ color: "#94a3b8", fontSize: 13 }}>Location</Text>
            <Text style={{ color: "#e2e8f0", fontSize: 13 }}>
              {incidentDetails.barangay}
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 6,
            }}
          >
            <Text style={{ color: "#94a3b8", fontSize: 13 }}>People</Text>
            <Text style={{ color: "#e2e8f0", fontSize: 13 }}>
              {incidentDetails.people_count}
            </Text>
          </View>
          {incidentDetails.message && (
            <View style={{ marginTop: 6 }}>
              <Text style={{ color: "#94a3b8", fontSize: 13 }}>Message</Text>
              <Text style={{ color: "#e2e8f0", fontSize: 13, marginTop: 2 }}>
                {incidentDetails.message}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Request ID */}
      <View
        style={{
          backgroundColor: "#1e293b",
          borderRadius: 12,
          padding: 16,
          marginBottom: 12,
        }}
      >
        <Text
          style={{
            color: "#64748b",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}
        >
          Request ID
        </Text>
        <Text
          style={{
            color: "#e2e8f0",
            fontSize: 12,
            fontFamily: "monospace",
            marginTop: 4,
          }}
        >
          {incidentId || "—"}
        </Text>
      </View>

      {/* Responder Info */}
      {responder && (
        <View
          style={{
            backgroundColor: "#1e293b",
            borderRadius: 12,
            padding: 16,
            marginBottom: 12,
            borderLeftWidth: 3,
            borderLeftColor: "#3b82f6",
          }}
        >
          <Text
            style={{
              color: "#64748b",
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}
          >
            Assigned Responder
          </Text>
          <Text
            style={{
              color: "#e2e8f0",
              fontSize: 15,
              fontWeight: "600",
              marginTop: 4,
            }}
          >
            {responder.team_name || "Rescue Team"}
          </Text>
          <Text style={{ color: "#94a3b8", fontSize: 13, marginTop: 2 }}>
            {responder.vehicle_type || "Vehicle"}
          </Text>
          {responder.last_update && (
            <Text style={{ color: "#475569", fontSize: 11, marginTop: 6 }}>
              Last GPS update:{" "}
              {new Date(responder.last_update).toLocaleTimeString("en-PH")}
            </Text>
          )}
        </View>
      )}

      {/* Status Timeline */}
      <View
        style={{
          backgroundColor: "#1e293b",
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
        }}
      >
        <Text
          style={{
            color: "#64748b",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 12,
          }}
        >
          Status Timeline
        </Text>
        {(["pending", "assigned", "in_progress", "resolved"] as const).map(
          (s, i) => {
            const steps = ["pending", "assigned", "in_progress", "resolved"];
            const currentIndex = steps.indexOf(status);
            const stepIndex = steps.indexOf(s);
            const isPast = currentIndex >= stepIndex;
            const isActive = s === status;
            const c = STATUS_CONFIG[s];
            return (
              <View
                key={s}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  marginBottom: i < 3 ? 14 : 0,
                }}
              >
                <View
                  style={{
                    width: isActive ? 14 : 10,
                    height: isActive ? 14 : 10,
                    borderRadius: 7,
                    backgroundColor: isPast ? c.color : "#334155",
                    marginRight: 12,
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: isPast ? c.color : "#475569",
                      fontSize: 13,
                      fontWeight: isActive ? "700" : "400",
                    }}
                  >
                    {c.label}
                  </Text>
                </View>
                {isActive && (
                  <View
                    style={{
                      backgroundColor: c.bg,
                      borderRadius: 4,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                    }}
                  >
                    <Text
                      style={{
                        color: c.color,
                        fontSize: 10,
                        fontWeight: "600",
                      }}
                    >
                      CURRENT
                    </Text>
                  </View>
                )}
              </View>
            );
          },
        )}
      </View>

      {/* Back Button */}
      <TouchableOpacity
        onPress={() => router.replace("/(tabs)/home")}
        style={{
          backgroundColor: "#334155",
          padding: 14,
          borderRadius: 12,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#e2e8f0", fontSize: 14, fontWeight: "600" }}>
          Back to Home
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
