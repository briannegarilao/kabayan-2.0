// app/(tabs)/evacuation.tsx — REPLACES the placeholder
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Linking,
  TouchableOpacity,
} from "react-native";
import * as Location from "expo-location";
import { supabase } from "../../utils/supabase";

interface EvacCenter {
  id: string;
  name: string;
  barangay: string;
  address: string | null;
  capacity: number | null;
  current_occupancy: number;
  is_open: boolean;
  contact_number: string | null;
  facilities: string[] | null;
  lat: number;
  lng: number;
  distance_km: number | null;
}

// Haversine formula — calculates distance between two GPS points
// No API call needed, pure math
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function EvacuationScreen() {
  const [centers, setCenters] = useState<EvacCenter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);

  async function fetchCenters() {
    try {
      // Get user's GPS — one request
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === "granted") {
          const loc = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
            new Promise((_, reject) => setTimeout(() => reject("timeout"), 8000)),
          ]) as Location.LocationObject;
          setUserLat(loc.coords.latitude);
          setUserLng(loc.coords.longitude);
        }
      } catch {
        // GPS failed — show centers without distances
      }

      // Fetch evacuation centers — one query, selected columns only
      const { data } = await supabase
        .from("evacuation_centers")
        .select("id, name, barangay, address, capacity, current_occupancy, is_open, contact_number, facilities, location")
        .order("is_open", { ascending: false });

      if (data) {
        const parsed: EvacCenter[] = data.map((c: any) => {
          // Extract lat/lng from PostGIS geography
          let lat = 0;
          let lng = 0;
          if (c.location) {
            // location comes as WKT or GeoJSON string from Supabase
            const match = String(c.location).match(/POINT\(([^ ]+) ([^)]+)\)/);
            if (match) {
              lng = parseFloat(match[1]);
              lat = parseFloat(match[2]);
            }
          }

          return {
            id: c.id,
            name: c.name,
            barangay: c.barangay,
            address: c.address,
            capacity: c.capacity,
            current_occupancy: c.current_occupancy || 0,
            is_open: c.is_open,
            contact_number: c.contact_number,
            facilities: c.facilities,
            lat,
            lng,
            distance_km: null,
          };
        });

        setCenters(parsed);
      }
    } catch (e) {
      console.warn("Evacuation fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchCenters();
  }, []);

  // Calculate distances after we have both GPS and centers
  // Pure math — no API calls
  const centersWithDistance = centers.map((c) => ({
    ...c,
    distance_km:
      userLat && userLng && c.lat && c.lng
        ? haversineKm(userLat, userLng, c.lat, c.lng)
        : null,
  }));

  // Sort: open first, then by distance (nearest first)
  const sorted = [...centersWithDistance].sort((a, b) => {
    if (a.is_open !== b.is_open) return a.is_open ? -1 : 1;
    if (a.distance_km !== null && b.distance_km !== null) return a.distance_km - b.distance_km;
    return 0;
  });

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCenters();
    setRefreshing(false);
  }, []);

  function openInMaps(lat: number, lng: number, name: string) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
    Linking.openURL(url);
  }

  function renderItem({ item }: { item: EvacCenter }) {
    const occupancyPct = item.capacity ? Math.round((item.current_occupancy / item.capacity) * 100) : 0;
    const isFull = item.capacity ? item.current_occupancy >= item.capacity : false;

    return (
      <View
        style={{
          backgroundColor: "#1e293b",
          borderRadius: 12,
          padding: 16,
          marginBottom: 10,
          borderLeftWidth: 3,
          borderLeftColor: !item.is_open ? "#475569" : isFull ? "#dc2626" : "#22c55e",
          opacity: item.is_open ? 1 : 0.6,
        }}
      >
        {/* Header row */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text style={{ color: "#e2e8f0", fontSize: 15, fontWeight: "600" }}>{item.name}</Text>
            <Text style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{item.barangay}</Text>
            {item.address && (
              <Text style={{ color: "#64748b", fontSize: 11, marginTop: 1 }}>{item.address}</Text>
            )}
          </View>

          <View style={{ alignItems: "flex-end" }}>
            <View
              style={{
                backgroundColor: !item.is_open ? "#47556915" : isFull ? "#dc262615" : "#22c55e15",
                borderRadius: 6,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <Text
                style={{
                  color: !item.is_open ? "#475569" : isFull ? "#dc2626" : "#22c55e",
                  fontSize: 10,
                  fontWeight: "700",
                }}
              >
                {!item.is_open ? "CLOSED" : isFull ? "FULL" : "OPEN"}
              </Text>
            </View>
            {item.distance_km !== null && (
              <Text style={{ color: "#3b82f6", fontSize: 12, fontWeight: "600", marginTop: 4 }}>
                {item.distance_km < 1
                  ? `${Math.round(item.distance_km * 1000)}m`
                  : `${item.distance_km.toFixed(1)}km`}
              </Text>
            )}
          </View>
        </View>

        {/* Occupancy bar */}
        {item.is_open && item.capacity && (
          <View style={{ marginTop: 10 }}>
            <Text style={{ color: "#64748b", fontSize: 11, marginBottom: 4 }}>
              {item.current_occupancy} / {item.capacity} ({occupancyPct}%)
            </Text>
            <View style={{ height: 6, backgroundColor: "#334155", borderRadius: 3, overflow: "hidden" }}>
              <View
                style={{
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: occupancyPct >= 90 ? "#dc2626" : occupancyPct >= 70 ? "#f59e0b" : "#22c55e",
                  width: `${Math.min(occupancyPct, 100)}%`,
                }}
              />
            </View>
          </View>
        )}

        {/* Facilities */}
        {item.facilities && item.facilities.length > 0 && (
          <Text style={{ color: "#475569", fontSize: 11, marginTop: 8 }}>
            {item.facilities.join(" · ")}
          </Text>
        )}

        {/* Action buttons */}
        <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
          {item.lat !== 0 && item.lng !== 0 && (
            <TouchableOpacity
              onPress={() => openInMaps(item.lat, item.lng, item.name)}
              style={{ flex: 1, backgroundColor: "#334155", borderRadius: 8, padding: 10, alignItems: "center" }}
            >
              <Text style={{ color: "#3b82f6", fontSize: 12, fontWeight: "600" }}>Get Directions</Text>
            </TouchableOpacity>
          )}
          {item.contact_number && (
            <TouchableOpacity
              onPress={() => Linking.openURL(`tel:${item.contact_number}`)}
              style={{ flex: 1, backgroundColor: "#334155", borderRadius: 8, padding: 10, alignItems: "center" }}
            >
              <Text style={{ color: "#22c55e", fontSize: 12, fontWeight: "600" }}>Call</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#0f172a", justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  const openCount = sorted.filter((c) => c.is_open).length;

  return (
    <View style={{ flex: 1, backgroundColor: "#0f172a", paddingTop: 50 }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: "700", color: "#e2e8f0" }}>Evacuation Centers</Text>
        <Text style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
          {openCount} open · Sorted by distance from you
        </Text>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" colors={["#3b82f6"]} />
        }
        ListEmptyComponent={
          <View style={{ alignItems: "center", marginTop: 60 }}>
            <Text style={{ color: "#64748b", fontSize: 14 }}>No evacuation centers registered.</Text>
          </View>
        }
      />
    </View>
  );
}
