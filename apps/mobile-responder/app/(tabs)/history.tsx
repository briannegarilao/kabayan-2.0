// app/(tabs)/history.tsx
import React from "react";
import { View, Text } from "react-native";

export default function HistoryScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: "#0f172a", justifyContent: "center", alignItems: "center", padding: 24 }}>
      <Text style={{ color: "#e2e8f0", fontSize: 18, fontWeight: "700" }}>Trip History</Text>
      <Text style={{ color: "#64748b", fontSize: 13, marginTop: 8, textAlign: "center" }}>
        Your completed rescue trips will appear here.
      </Text>
      <Text style={{ color: "#475569", fontSize: 11, marginTop: 16 }}>Coming in Step 5</Text>
    </View>
  );
}
