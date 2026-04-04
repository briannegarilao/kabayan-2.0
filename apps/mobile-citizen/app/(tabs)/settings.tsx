// app/(tabs)/settings.tsx — REPLACES the Step 2 version
import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Alert, Switch, Linking, ScrollView } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { registerPushToken } from "../../services/pushNotifications";

const EMERGENCY_CONTACTS = [
  { label: "National Emergency", number: "911" },
  { label: "Philippine Red Cross", number: "143" },
  { label: "NDRRMC", number: "(02) 8911-5061" },
  { label: "PNP Hotline", number: "117" },
  { label: "BFP (Fire)", number: "(02) 8426-0219" },
];

export default function SettingsScreen() {
  const { profile, user, signOut } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // Check if push token is already registered
  useEffect(() => {
    if (profile && (profile as any).expo_push_token) {
      setPushEnabled(true);
    }
  }, [profile]);

  async function togglePush(value: boolean) {
    if (!user) return;

    if (value) {
      setPushLoading(true);
      const token = await registerPushToken(user.id);
      setPushLoading(false);
      if (token) {
        setPushEnabled(true);
        Alert.alert("Notifications Enabled", "You'll receive alerts when responders are assigned to your SOS.");
      } else {
        Alert.alert("Permission Denied", "Please enable notifications in your device settings.");
      }
    } else {
      // Don't actually remove the token — just tell user
      Alert.alert(
        "Disable Notifications",
        "To disable notifications, go to your device Settings > Apps > KABAYAN > Notifications."
      );
    }
  }

  async function handleSignOut() {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
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

      {/* Profile Card */}
      <View style={{ backgroundColor: "#1e293b", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: "600", color: "#e2e8f0" }}>
          {profile?.full_name || "Citizen"}
        </Text>
        <Text style={{ fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
          {user?.email}
        </Text>
        <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
          <View style={{ backgroundColor: "#334155", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: "#3b82f6", fontSize: 12, fontWeight: "600" }}>
              {profile?.role || "citizen"}
            </Text>
          </View>
          <View style={{ backgroundColor: "#334155", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: "#94a3b8", fontSize: 12 }}>
              {profile?.barangay || "—"}
            </Text>
          </View>
        </View>
        {profile?.phone_number && (
          <Text style={{ color: "#64748b", fontSize: 12, marginTop: 8 }}>
            Phone: {profile.phone_number}
          </Text>
        )}
      </View>

      {/* Notifications */}
      <View style={{ backgroundColor: "#1e293b", borderRadius: 16, padding: 20, marginBottom: 16 }}>
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#e2e8f0", marginBottom: 12 }}>
          Notifications
        </Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={{ color: "#e2e8f0", fontSize: 13 }}>Push Notifications</Text>
            <Text style={{ color: "#64748b", fontSize: 11, marginTop: 2 }}>
              Receive alerts for SOS status updates and announcements
            </Text>
          </View>
          <Switch
            value={pushEnabled}
            onValueChange={togglePush}
            disabled={pushLoading}
            trackColor={{ false: "#334155", true: "#3b82f640" }}
            thumbColor={pushEnabled ? "#3b82f6" : "#64748b"}
          />
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
        <Text style={{ fontSize: 14, fontWeight: "600", color: "#e2e8f0", marginBottom: 8 }}>
          About
        </Text>
        <View style={{ gap: 6 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: "#94a3b8", fontSize: 12 }}>App Version</Text>
            <Text style={{ color: "#e2e8f0", fontSize: 12 }}>1.0.0</Text>
          </View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: "#94a3b8", fontSize: 12 }}>System</Text>
            <Text style={{ color: "#e2e8f0", fontSize: 12 }}>KABAYAN Citizen</Text>
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
        style={{
          backgroundColor: "#dc2626",
          padding: 14,
          borderRadius: 12,
          alignItems: "center",
        }}
      >
        <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "600" }}>Sign Out</Text>
      </TouchableOpacity>

      <Text style={{ textAlign: "center", color: "#475569", fontSize: 11, marginTop: 20 }}>
        KABAYAN — Barangay Emergency Response System{"\n"}Dasmarinas City, Cavite
      </Text>
    </ScrollView>
  );
}
