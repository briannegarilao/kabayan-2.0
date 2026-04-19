// app/(tabs)/trip.tsx — REPLACES the placeholder. Full trip lifecycle.
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Linking,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { supabase } from "../../utils/supabase";
import { useAuth } from "../../contexts/AuthContext";
import { markPickup, markDropoff, TripStop } from "../../services/tripService";

interface TripData {
  id: string;
  status: string;
  stops: TripStop[];
  evac_center_id: string | null;
  total_distance_km: number | null;
  estimated_time_minutes: number | null;
}

export default function TripScreen() {
  const params = useLocalSearchParams<{ tripId?: string }>();
  const { user, responder, refreshResponder } = useAuth();

  const [trip, setTrip] = useState<TripData | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickedUpIds, setPickedUpIds] = useState<Set<string>>(new Set());
  const [currentLoad, setCurrentLoad] = useState(responder?.current_load ?? 0);
  const maxCapacity = responder?.max_capacity ?? 10;
  const [processingStop, setProcessingStop] = useState<string | null>(null);
  const [droppingOff, setDroppingOff] = useState(false);

  // Load the active trip — either from params or find the latest active one
  useEffect(() => {
    if (!user) return;

    (async () => {
      try {
        let tripId = params.tripId;

        if (!tripId) {
          // Find the most recent active trip for this responder
          const { data } = await supabase
            .from("trip_plans")
            .select("id")
            .eq("responder_id", user.id)
            .eq("status", "active")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (data) tripId = data.id;
        }

        if (!tripId) {
          setLoading(false);
          return;
        }

        const { data } = await supabase
          .from("trip_plans")
          .select(
            "id, status, stops, evac_center_id, total_distance_km, estimated_time_minutes",
          )
          .eq("id", tripId)
          .maybeSingle();

        if (data && data.status === "active") {
          setTrip(data as TripData);
        }
      } catch (e) {
        console.warn("Failed to load trip:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user, params.tripId]);

  // Sync current_load from responder context
  useEffect(() => {
    setCurrentLoad(responder?.current_load ?? 0);
  }, [responder]);

  function openNavigation(lat: number, lng: number) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.openURL(url);
  }

  async function handlePickup(stop: TripStop) {
    if (!trip) return;
    const stopKey = stop.incident_id || `stop-${stop.sequence}`;
    setProcessingStop(stopKey);

    try {
      const result = await markPickup(
        trip.id,
        stop.incident_id,
        stop.people_count,
      );
      setCurrentLoad(result.current_load);
      setPickedUpIds((prev) => new Set(prev).add(stopKey));
      await refreshResponder();

      Alert.alert(
        "Picked Up",
        `${stop.people_count} people picked up at ${stop.barangay}.\nVehicle load: ${result.current_load}/${result.max_capacity}`,
      );
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to mark pickup.");
    } finally {
      setProcessingStop(null);
    }
  }

  async function handleDropoff() {
    if (!trip) return;

    Alert.alert(
      "Confirm Drop-off",
      `Drop off ${currentLoad} people at the evacuation center?\nThis will complete the trip.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm Drop-off",
          onPress: async () => {
            setDroppingOff(true);
            try {
              const result = await markDropoff(trip.id);
              await refreshResponder();

              Alert.alert(
                "Trip Complete",
                `${result.people_dropped} people safely delivered to the evacuation center.`,
                [
                  {
                    text: "OK",
                    onPress: () => {
                      setTrip(null);
                      setPickedUpIds(new Set());
                      setCurrentLoad(0);
                      router.replace("/(tabs)/home");
                    },
                  },
                ],
              );
            } catch (e: any) {
              Alert.alert("Error", e.message || "Failed to mark drop-off.");
            } finally {
              setDroppingOff(false);
            }
          },
        },
      ],
    );
  }

  // ── No active trip ──
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
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  if (!trip) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0f172a",
          justifyContent: "center",
          alignItems: "center",
          padding: 24,
        }}
      >
        <Text style={{ color: "#f59e0b", fontSize: 18, fontWeight: "700" }}>
          Active Trip
        </Text>
        <Text
          style={{
            color: "#64748b",
            fontSize: 13,
            marginTop: 8,
            textAlign: "center",
          }}
        >
          No active trip. Accept an assignment from the Dashboard to start a
          rescue operation.
        </Text>
      </View>
    );
  }

  // ── Active trip view ──
  const pickupStops = trip.stops.filter((s) => s.type === "pickup");
  const dropoffStop = trip.stops.find((s) => s.type === "dropoff");
  const allPickedUp = pickupStops.every((s) =>
    pickedUpIds.has(s.incident_id || `stop-${s.sequence}`),
  );
  const loadPct =
    maxCapacity > 0 ? Math.round((currentLoad / maxCapacity) * 100) : 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#0f172a" }}
      contentContainerStyle={{
        padding: 20,
        paddingTop: 50,
        paddingBottom: 120,
      }}
    >
      {/* Header */}
      <View style={{ marginBottom: 20 }}>
        <Text style={{ fontSize: 20, fontWeight: "800", color: "#f59e0b" }}>
          Active Rescue
        </Text>
        <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
          {pickupStops.length} {pickupStops.length === 1 ? "stop" : "stops"} ·
          Est.{" "}
          {trip.estimated_time_minutes
            ? `${Math.round(trip.estimated_time_minutes)} min`
            : "—"}{" "}
          ·{" "}
          {trip.total_distance_km
            ? `${trip.total_distance_km.toFixed(1)} km`
            : "—"}
        </Text>
      </View>

      {/* Load Bar — persistent */}
      <View
        style={{
          backgroundColor: "#1e293b",
          borderRadius: 12,
          padding: 14,
          marginBottom: 20,
          borderWidth: 1,
          borderColor:
            loadPct >= 80
              ? "#dc262640"
              : loadPct >= 50
                ? "#f59e0b40"
                : "#22c55e40",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            marginBottom: 6,
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
            Vehicle Load
          </Text>
          <Text
            style={{
              color:
                loadPct >= 80
                  ? "#dc2626"
                  : loadPct >= 50
                    ? "#f59e0b"
                    : "#22c55e",
              fontSize: 15,
              fontWeight: "800",
            }}
          >
            {currentLoad}/{maxCapacity}
          </Text>
        </View>
        <View
          style={{
            height: 10,
            backgroundColor: "#334155",
            borderRadius: 5,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: 10,
              borderRadius: 5,
              backgroundColor:
                loadPct >= 80
                  ? "#dc2626"
                  : loadPct >= 50
                    ? "#f59e0b"
                    : "#22c55e",
              width: `${Math.min(loadPct, 100)}%`,
            }}
          />
        </View>
      </View>

      {/* Pickup Stops */}
      {pickupStops.map((stop, i) => {
        const stopKey = stop.incident_id || `stop-${stop.sequence}`;
        const isPickedUp = pickedUpIds.has(stopKey);
        const isProcessing = processingStop === stopKey;

        return (
          <View
            key={stopKey}
            style={{
              backgroundColor: isPickedUp ? "#22c55e10" : "#1e293b",
              borderRadius: 12,
              padding: 16,
              marginBottom: 10,
              borderLeftWidth: 4,
              borderLeftColor: isPickedUp ? "#22c55e" : "#dc2626",
              opacity: isPickedUp ? 0.7 : 1,
            }}
          >
            {/* Stop header */}
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                <View
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: isPickedUp ? "#22c55e" : "#f59e0b",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: "#0f172a",
                      fontSize: 13,
                      fontWeight: "800",
                    }}
                  >
                    {i + 1}
                  </Text>
                </View>
                <View>
                  <Text
                    style={{
                      color: "#e2e8f0",
                      fontSize: 14,
                      fontWeight: "600",
                    }}
                  >
                    {stop.barangay || "Pickup"}
                  </Text>
                  {(stop as any).severity && (
                    <Text
                      style={{ color: "#64748b", fontSize: 11, marginTop: 1 }}
                    >
                      Severity: {(stop as any).severity}
                    </Text>
                  )}
                </View>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text
                  style={{ color: "#f59e0b", fontSize: 15, fontWeight: "700" }}
                >
                  {stop.people_count}
                </Text>
                <Text style={{ color: "#64748b", fontSize: 10 }}>people</Text>
              </View>
            </View>

            {/* Action buttons */}
            {!isPickedUp && (
              <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
                {stop.lat && stop.lng && (
                  <TouchableOpacity
                    onPress={() =>
                      openNavigation(stop.lat as number, stop.lng as number)
                    }
                    style={{
                      flex: 1,
                      backgroundColor: "#334155",
                      borderRadius: 8,
                      padding: 10,
                      alignItems: "center",
                    }}
                  >
                    <Text
                      style={{
                        color: "#3b82f6",
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      Navigate
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => handlePickup(stop)}
                  disabled={isProcessing}
                  style={{
                    flex: 1,
                    backgroundColor: isProcessing ? "#166534" : "#22c55e",
                    borderRadius: 8,
                    padding: 10,
                    alignItems: "center",
                  }}
                >
                  {isProcessing ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <Text
                      style={{
                        color: "#ffffff",
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      Mark Picked Up
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}

            {isPickedUp && (
              <View
                style={{
                  marginTop: 8,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Text style={{ fontSize: 14 }}>✅</Text>
                <Text
                  style={{ color: "#22c55e", fontSize: 12, fontWeight: "600" }}
                >
                  Picked up {stop.people_count} people
                </Text>
              </View>
            )}
          </View>
        );
      })}

      {/* Connector line */}
      {allPickedUp && dropoffStop && (
        <View style={{ alignItems: "center", marginVertical: 4 }}>
          <Text style={{ color: "#475569", fontSize: 11 }}>
            ▼ Proceed to evacuation center ▼
          </Text>
        </View>
      )}

      {/* Dropoff Stop — Evacuation Center */}
      {dropoffStop && (
        <View
          style={{
            backgroundColor: allPickedUp ? "#3b82f610" : "#1e293b",
            borderRadius: 12,
            padding: 16,
            marginBottom: 10,
            borderLeftWidth: 4,
            borderLeftColor: "#3b82f6",
            opacity: allPickedUp ? 1 : 0.5,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: "#3b82f6",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text
                style={{ color: "#ffffff", fontSize: 11, fontWeight: "800" }}
              >
                EC
              </Text>
            </View>
            <View>
              <Text
                style={{ color: "#e2e8f0", fontSize: 14, fontWeight: "600" }}
              >
                {(dropoffStop as any).evac_center_name ||
                  dropoffStop.barangay ||
                  "Evacuation Center"}
              </Text>
              <Text style={{ color: "#64748b", fontSize: 11 }}>
                Drop-off point
              </Text>
            </View>
          </View>

          {allPickedUp && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
              {dropoffStop.lat && dropoffStop.lng && (
                <TouchableOpacity
                  onPress={() =>
                    openNavigation(
                      dropoffStop.lat as number,
                      dropoffStop.lng as number,
                    )
                  }
                  style={{
                    flex: 1,
                    backgroundColor: "#334155",
                    borderRadius: 8,
                    padding: 10,
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: "#3b82f6",
                      fontSize: 12,
                      fontWeight: "600",
                    }}
                  >
                    Navigate
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                onPress={handleDropoff}
                disabled={droppingOff}
                style={{
                  flex: 1,
                  backgroundColor: droppingOff ? "#1e40af" : "#3b82f6",
                  borderRadius: 8,
                  padding: 10,
                  alignItems: "center",
                }}
              >
                {droppingOff ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <Text
                    style={{
                      color: "#ffffff",
                      fontSize: 12,
                      fontWeight: "700",
                    }}
                  >
                    Mark Dropped Off
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {!allPickedUp && (
            <Text style={{ color: "#475569", fontSize: 11, marginTop: 8 }}>
              Complete all pickups first before dropping off.
            </Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}
