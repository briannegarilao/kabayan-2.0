// app/(tabs)/home.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { supabase } from "../../utils/supabase";
import Config from "../../utils/config";
import WeatherCard from "../../components/WeatherCard";
import AnnouncementCard from "../../components/AnnouncementCard";

interface Announcement {
  id: string;
  title: string;
  body: string;
  priority: string;
  created_at: string;
}

export default function HomeScreen() {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [weather, setWeather] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [weatherLoading, setWeatherLoading] = useState(true);

  // Fetch weather from FastAPI (cached 30 min on server side)
  async function fetchWeather() {
    try {
      const resp = await fetch(`${Config.API_BASE_URL}/api/weather/current`);
      const json = await resp.json();
      if (json.data) setWeather(json.data);
    } catch (e) {
      console.warn("Weather fetch failed:", e);
    } finally {
      setWeatherLoading(false);
    }
  }

  // Fetch announcements from Supabase (one query, no polling)
  async function fetchAnnouncements() {
    try {
      const { data } = await supabase
        .from("announcements")
        .select("id, title, body, priority, created_at")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(5);
      if (data) setAnnouncements(data);
    } catch (e) {
      console.warn("Announcements fetch failed:", e);
    }
  }

  // Initial load — one weather call + one announcements query
  useEffect(() => {
    fetchWeather();
    fetchAnnouncements();
  }, []);

  // Realtime subscription for NEW announcements only (no polling)
  useEffect(() => {
    const channelId = `announcements-feed-${Date.now()}`;
    const channel = supabase
      .channel(channelId)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "announcements" },
        (payload) => {
          const newAnn = payload.new as Announcement;
          setAnnouncements((prev) => [newAnn, ...prev].slice(0, 5));
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Pull-to-refresh: re-fetches both weather and announcements
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchWeather(), fetchAnnouncements()]);
    setRefreshing(false);
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#0f172a" }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          paddingTop: 50,
          paddingBottom: 100,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
            colors={["#3b82f6"]}
          />
        }
      >
        {/* Header */}
        <View style={{ marginBottom: 24 }}>
          <Text style={{ fontSize: 14, color: "#94a3b8" }}>
            Welcome, {profile?.full_name || "Citizen"}
          </Text>
          <Text style={{ fontSize: 12, color: "#64748b" }}>
            {profile?.barangay || "Dasmarinas"} · KABAYAN Emergency App
          </Text>
        </View>

        {/* SOS Button */}
        <TouchableOpacity
          onPress={() => router.push("/sos-form")}
          activeOpacity={0.8}
          style={{
            backgroundColor: "#dc2626",
            borderRadius: 20,
            padding: 32,
            alignItems: "center",
            marginBottom: 24,
            shadowColor: "#dc2626",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.4,
            shadowRadius: 16,
            elevation: 12,
          }}
        >
          <Text style={{ fontSize: 48, fontWeight: "900", color: "#ffffff" }}>
            SOS
          </Text>
          <Text style={{ fontSize: 13, color: "#fecaca", marginTop: 4 }}>
            Tap to send emergency alert
          </Text>
        </TouchableOpacity>

        {/* Weather Card */}
        {weatherLoading ? (
          <View
            style={{
              backgroundColor: "#1e293b",
              borderRadius: 16,
              padding: 20,
              marginBottom: 24,
              alignItems: "center",
            }}
          >
            <ActivityIndicator color="#3b82f6" />
            <Text style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
              Loading weather...
            </Text>
          </View>
        ) : weather ? (
          <WeatherCard weather={weather} />
        ) : null}

        {/* Announcements */}
        <Text
          style={{
            fontSize: 16,
            fontWeight: "700",
            color: "#e2e8f0",
            marginBottom: 12,
          }}
        >
          Announcements
        </Text>

        {announcements.length === 0 ? (
          <View
            style={{
              backgroundColor: "#1e293b",
              borderRadius: 12,
              padding: 20,
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#64748b", fontSize: 13 }}>
              No announcements yet.
            </Text>
          </View>
        ) : (
          announcements.map((ann) => (
            <AnnouncementCard key={ann.id} announcement={ann} />
          ))
        )}
      </ScrollView>
    </View>
  );
}
