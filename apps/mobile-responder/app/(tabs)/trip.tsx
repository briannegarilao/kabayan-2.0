// app/(tabs)/trip.tsx
import React from "react";
import { View, Text } from "react-native";

export default function TripScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: "#0f172a", justifyContent: "center", alignItems: "center", padding: 24 }}>
      <Text style={{ color: "#f59e0b", fontSize: 18, fontWeight: "700" }}>Active Trip</Text>
      <Text style={{ color: "#64748b", fontSize: 13, marginTop: 8, textAlign: "center" }}>
        No active trip. Accept an assignment from the Dashboard tab to start.
      </Text>
      <Text style={{ color: "#475569", fontSize: 11, marginTop: 16 }}>Coming in Step 4</Text>
    </View>
  );
}
