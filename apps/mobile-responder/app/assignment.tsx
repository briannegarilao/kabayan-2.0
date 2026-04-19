// app/assignment.tsx — REPLACES Step 3 version. Fixes post-accept navigation to trip tab.
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  ScrollView,
  Vibration,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "../utils/supabase";
import { acceptTrip, declineTrip, TripStop } from "../services/tripService";
import { useAuth } from "../contexts/AuthContext";

const COUNTDOWN_SECONDS = 180;

const DECLINE_REASONS = [
  { key: "route_blocked", label: "Route Blocked" },
  { key: "vehicle_issue", label: "Vehicle Issue" },
  { key: "off_duty", label: "Going Off Duty" },
  { key: "other", label: "Other" },
];

export default function AssignmentScreen() {
  const { tripId } = useLocalSearchParams<{ tripId: string }>();
  const { refreshResponder } = useAuth();

  const [trip, setTrip] = useState<any>(null);
  const [incidentDetails, setIncidentDetails] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [showDeclineReasons, setShowDeclineReasons] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAutoDeclined = useRef(false);

  useEffect(() => {
    if (!tripId) return;

    (async () => {
      try {
        const { data } = await supabase
          .from("trip_plans")
          .select("id, responder_id, status, stops, evac_center_id, total_distance_km, estimated_time_minutes, created_at")
          .eq("id", tripId)
          .maybeSingle();

        if (data) {
          setTrip(data);
          const pickupIds = (data.stops || [])
            .filter((s: TripStop) => s.type === "pickup" && s.incident_id)
            .map((s: TripStop) => s.incident_id);

          if (pickupIds.length > 0) {
            const { data: incidents } = await supabase
              .from("sos_incidents")
              .select("id, barangay, people_count, message, flood_severity, vulnerability_flags")
              .in("id", pickupIds);
            if (incidents) setIncidentDetails(incidents);
          }
        }
      } catch (e) {
        console.warn("Failed to fetch trip:", e);
      } finally {
        setLoading(false);
      }
    })();

    Vibration.vibrate([0, 500, 200, 500]);
  }, [tripId]);

  useEffect(() => {
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          if (!hasAutoDeclined.current) {
            hasAutoDeclined.current = true;
            handleAutoDecline();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  function formatCountdown(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  }

  async function handleAccept() {
    if (!tripId) return;
    setAccepting(true);
    if (countdownRef.current) clearInterval(countdownRef.current);

    try {
      await acceptTrip(tripId);
      await refreshResponder();
      // Navigate to the trip tab — pass tripId so it loads this trip
      router.replace({
        pathname: "/(tabs)/trip",
        params: { tripId },
      });
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to accept trip.");
      setAccepting(false);
    }
  }

  async function handleDecline(reason: string) {
    if (!tripId) return;
    setDeclining(true);
    if (countdownRef.current) clearInterval(countdownRef.current);

    try {
      const barangay = incidentDetails[0]?.barangay || null;
      await declineTrip(tripId, reason, barangay);
      await refreshResponder();
      router.replace("/(tabs)/home");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to decline trip.");
      setDeclining(false);
    }
  }

  async function handleAutoDecline() {
    if (!tripId) return;
    try {
      const barangay = incidentDetails[0]?.barangay || null;
      await declineTrip(tripId, "timeout", barangay);
      await refreshResponder();
    } catch {}
    Alert.alert("Assignment Expired", "The 3-minute window has passed. The incident will be reassigned.", [
      { text: "OK", onPress: () => router.replace("/(tabs)/home") },
    ]);
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0f172a", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  if (!trip) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0f172a", justifyContent: "center", alignItems: "center", padding: 24 }}>
        <Text style={{ color: "#dc2626", fontSize: 16 }}>Trip not found.</Text>
        <TouchableOpacity onPress={() => router.replace("/(tabs)/home")} style={{ marginTop: 16 }}>
          <Text style={{ color: "#3b82f6" }}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pickupStops = (trip.stops || []).filter((s: any) => s.type === "pickup");
  const totalPeople = pickupStops.reduce((sum: number, s: any) => sum + (s.people_count || 0), 0);
  const countdownPct = (countdown / COUNTDOWN_SECONDS) * 100;
  const isUrgent = countdown <= 60;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#0f172a" }}
      contentContainerStyle={{ padding: 20, paddingTop: 50, paddingBottom: 40 }}
    >
      {/* Countdown */}
      <View style={{ marginBottom: 20 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
          <Text style={{ color: isUrgent ? "#dc2626" : "#f59e0b", fontSize: 13, fontWeight: "700" }}>
            RESPOND WITHIN
          </Text>
          <Text style={{ color: isUrgent ? "#dc2626" : "#f59e0b", fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] }}>
            {formatCountdown(countdown)}
          </Text>
        </View>
        <View style={{ height: 6, backgroundColor: "#334155", borderRadius: 3, overflow: "hidden" }}>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: isUrgent ? "#dc2626" : "#f59e0b", width: `${countdownPct}%` }} />
        </View>
      </View>

      {/* Alert Header */}
      <View style={{ backgroundColor: "#dc262620", borderRadius: 16, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: "#dc262640", alignItems: "center" }}>
        <Text style={{ fontSize: 28, marginBottom: 8 }}>🚨</Text>
        <Text style={{ color: "#dc2626", fontSize: 18, fontWeight: "800" }}>NEW ASSIGNMENT</Text>
        <Text style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>
          {pickupStops.length} {pickupStops.length === 1 ? "stop" : "stops"} · {totalPeople} people
        </Text>
      </View>

      {/* Trip Summary */}
      <View style={{ backgroundColor: "#1e293b", borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
          <Text style={{ color: "#94a3b8", fontSize: 13 }}>Est. Time</Text>
          <Text style={{ color: "#e2e8f0", fontSize: 13, fontWeight: "600" }}>
            {trip.estimated_time_minutes ? `${Math.round(trip.estimated_time_minutes)} min` : "—"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: "#94a3b8", fontSize: 13 }}>Est. Distance</Text>
          <Text style={{ color: "#e2e8f0", fontSize: 13, fontWeight: "600" }}>
            {trip.total_distance_km ? `${trip.total_distance_km.toFixed(1)} km` : "—"}
          </Text>
        </View>
      </View>

      {/* Incidents */}
      {incidentDetails.map((inc, i) => (
        <View key={inc.id} style={{ backgroundColor: "#1e293b", borderRadius: 12, padding: 16, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: "#dc2626" }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: "#e2e8f0", fontSize: 14, fontWeight: "600" }}>Stop {i + 1}: {inc.barangay}</Text>
            <Text style={{ color: "#f59e0b", fontSize: 13, fontWeight: "700" }}>{inc.people_count} people</Text>
          </View>
          {inc.message && <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 6 }}>{inc.message}</Text>}
          {inc.vulnerability_flags && inc.vulnerability_flags.length > 0 && (
            <View style={{ flexDirection: "row", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
              {inc.vulnerability_flags.map((f: string) => (
                <View key={f} style={{ backgroundColor: "#f59e0b20", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: "#f59e0b", fontSize: 10, fontWeight: "600" }}>{f}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}

      {/* Buttons */}
      {!showDeclineReasons ? (
        <View style={{ gap: 10, marginTop: 16 }}>
          <TouchableOpacity
            onPress={handleAccept}
            disabled={accepting || declining}
            style={{ backgroundColor: accepting ? "#166534" : "#22c55e", padding: 18, borderRadius: 14, alignItems: "center" }}
          >
            {accepting ? <ActivityIndicator color="#ffffff" /> : (
              <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800" }}>ACCEPT ASSIGNMENT</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setShowDeclineReasons(true)}
            disabled={accepting || declining}
            style={{ backgroundColor: "#334155", padding: 14, borderRadius: 12, alignItems: "center" }}
          >
            <Text style={{ color: "#dc2626", fontSize: 14, fontWeight: "600" }}>Decline</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ marginTop: 16 }}>
          <Text style={{ color: "#e2e8f0", fontSize: 14, fontWeight: "600", marginBottom: 10 }}>Reason for declining:</Text>
          {DECLINE_REASONS.map((r) => (
            <TouchableOpacity
              key={r.key}
              onPress={() => handleDecline(r.key)}
              disabled={declining}
              style={{ backgroundColor: "#1e293b", borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#334155" }}
            >
              <Text style={{ color: "#e2e8f0", fontSize: 14 }}>{r.label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity onPress={() => setShowDeclineReasons(false)} style={{ alignItems: "center", marginTop: 8 }}>
            <Text style={{ color: "#64748b", fontSize: 13 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}
