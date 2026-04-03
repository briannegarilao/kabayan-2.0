// app/home.tsx
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { useAuth } from "../contexts/AuthContext";

export default function HomeScreen() {
  const { profile, signOut } = useAuth();

  async function handleSignOut() {
    await signOut();
    router.replace("/login");
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0f172a", justifyContent: "center", alignItems: "center", padding: 24 }}>
      <Text style={{ fontSize: 32, fontWeight: "800", color: "#3b82f6" }}>KABAYAN</Text>
      <Text style={{ fontSize: 14, color: "#94a3b8", marginTop: 8 }}>
        Welcome, {profile?.full_name || "Citizen"}
      </Text>
      <Text style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
        {profile?.barangay || "Dasmarinas"}
      </Text>

      <View style={{ marginTop: 40, padding: 20, backgroundColor: "#1e293b", borderRadius: 16, width: "100%", alignItems: "center" }}>
        <Text style={{ color: "#94a3b8", fontSize: 14 }}>Step 1 Complete — Auth Working</Text>
        <Text style={{ color: "#64748b", fontSize: 12, marginTop: 8, textAlign: "center" }}>
          Role: {profile?.role}{"\n"}
          Email: {profile?.email}{"\n"}
          Barangay: {profile?.barangay}
        </Text>
      </View>

      <TouchableOpacity
        onPress={handleSignOut}
        style={{ marginTop: 24, backgroundColor: "#dc2626", padding: 14, borderRadius: 12, width: "100%", alignItems: "center" }}
      >
        <Text style={{ color: "#ffffff", fontSize: 14, fontWeight: "600" }}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}
