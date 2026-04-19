// app/(tabs)/settings.tsx — REPLACES Step 1 version. Enhanced with emergency contacts.
import React from "react";
import { View, Text, TouchableOpacity, Alert, ScrollView, Linking } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";

const EMERGENCY_CONTACTS = [
  { label: "National Emergency", number: "911" },
  { label: "Philippine Red Cross", number: "143" },
  { label: "NDRRMC", number: "(02) 8911-5061" },
  { label: "PNP Hotline", number: "117" },
  { label: "BFP (Fire)", number: "(02) 8426-0219" },
];

export default function SettingsScreen() {
  const { profile, responder, user, signOut } = useAuth();

  async function handleSignOut() {
    Alert.alert("Sign Out", "This will stop GPS tracking and take you off duty. Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/login");
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: "#0f172a" }}
      contentContainerStyle={{ padding: 20, paddingTop: 50, paddingBottom: 40 }}
    >
      <Text style={{ fontSize: 20, fontWeight: "700", color: "#e2e8f0", marginBottom: 24 }}>
        Settings
      </Text>

      {/* Profile */}
      <View style={{ backgroundColor: "#1e293b", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: "600", color: "#e2e8f0" }}>
          {profile?.full_name || "Responder"}
        </Text>
        <Text style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>{user?.email}</Text>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <View style={{ backgroundColor: "#f59e0b20", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: "#f59e0b", fontSize: 12, fontWeight: "600" }}>responder</Text>
          </View>
          <View style={{ backgroundColor: "#334155", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: "#94a3b8", fontSize: 12 }}>{profile?.barangay || "—"}</Text>
          </View>
        </View>
        {profile?.phone_number && (
          <Text style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
            Phone: {profile.phone_number}
          </Text>
        )}
      </View>

      {/* Vehicle & Team */}
      <View style={{ backgroundColor: "#1e293b", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#e2e8f0", marginBottom: 12 }}>
          Vehicle & Team
        </Text>
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: "#94a3b8", fontSize: 13 }}>Team Name</Text>
            <Text style={{ color: "#e2e8f0", fontSize: 13, fontWeight: "600" }}>{responder?.team_name || "—"}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: "#94a3b8", fontSize: 13 }}>Vehicle Type</Text>
            <Text style={{ color: "#e2e8f0", fontSize: 13 }}>{responder?.vehicle_type || "—"}</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: "#94a3b8", fontSize: 13 }}>Max Capacity</Text>
            <Text style={{ color: "#e2e8f0", fontSize: 13 }}>{responder?.max_capacity || 0} people</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: "#94a3b8", fontSize: 13 }}>Current Load</Text>
            <Text style={{ color: "#e2e8f0", fontSize: 13 }}>{responder?.current_load || 0} on board</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: "#94a3b8", fontSize: 13 }}>Duty Status</Text>
            <Text
              style={{
                color: responder?.is_available ? "#22c55e" : "#dc2626",
                fontSize: 13,
                fontWeight: "600",
              }}
            >
              {responder?.is_available ? "On Duty" : "Off Duty"}
            </Text>
          </View>
        </View>
      </View>

      {/* Emergency Contacts */}
      <View style={{ backgroundColor: "#1e293b", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#e2e8f0", marginBottom: 12 }}>
          Emergency Contacts
        </Text>
        {EMERGENCY_CONTACTS.map((contact, i) => (
          <TouchableOpacity
            key={contact.number}
            onPress={() => Linking.openURL(`tel:${contact.number}`)}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              paddingVertical: 10,
              borderTopWidth: i > 0 ? 1 : 0,
              borderTopColor: "#334155",
            }}
          >
            <Text style={{ color: "#94a3b8", fontSize: 13 }}>{contact.label}</Text>
            <Text style={{ color: "#3b82f6", fontSize: 13, fontWeight: "600" }}>{contact.number}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* App Info */}
      <View style={{ backgroundColor: "#1e293b", borderRadius: 16, padding: 20, marginBottom: 24 }}>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: "#94a3b8", fontSize: 12 }}>App</Text>
            <Text style={{ color: "#e2e8f0", fontSize: 12 }}>KABAYAN Responder v1.0.0</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: "#94a3b8", fontSize: 12 }}>Coverage</Text>
            <Text style={{ color: "#e2e8f0", fontSize: 12 }}>Dasmarinas City, Cavite</Text>
          </View>
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity
        onPress={handleSignOut}
        style={{ backgroundColor: "#dc2626", padding: 14, borderRadius: 12, alignItems: "center" }}
      >
        <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "600" }}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={{ textAlign: "center", color: "#475569", fontSize: 11, marginTop: 20 }}>
        KABAYAN — Barangay Emergency Response System{"\n"}Dasmarinas City, Cavite
      </Text>
    </ScrollView>
  );
}
