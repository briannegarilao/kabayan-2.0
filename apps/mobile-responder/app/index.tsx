// app/index.tsx
import { Redirect } from "expo-router";
import { View, ActivityIndicator } from "react-native";
import { useAuth } from "../contexts/AuthContext";

export default function Index() {
  const { isLoading, isAuthenticated, profile } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0f172a" }}>
        <ActivityIndicator size="large" color="#f59e0b" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/login" />;
  }

  // Only responders can use this app
  if (profile && profile.role !== "responder") {
    return <Redirect href="/login" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
