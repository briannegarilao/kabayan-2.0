// app/login.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { supabase } from "../utils/supabase";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Email and password are required.");
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signIn(email.trim(), password);
      if (error) {
        Alert.alert("Login Failed", error);
        return;
      }

      // Verify this is a responder account
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("users")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile || profile.role !== "responder") {
          await supabase.auth.signOut();
          Alert.alert("Access Denied", "This app is for authorized responders only.");
          return;
        }

        // Check responders table entry exists
        const { data: resp } = await supabase
          .from("responders")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();

        if (!resp) {
          await supabase.auth.signOut();
          Alert.alert("Access Denied", "No responder profile found. Contact your LGU administrator.");
          return;
        }
      }

      router.replace("/(tabs)/home");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#0f172a" }}
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ alignItems: "center", marginBottom: 40 }}>
          <Text style={{ fontSize: 36, fontWeight: "800", color: "#f59e0b" }}>KABAYAN</Text>
          <Text style={{ fontSize: 15, color: "#94a3b8", marginTop: 4, fontWeight: "600" }}>
            Responder App
          </Text>
          <Text style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
            Dasmarinas City, Cavite
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <TextInput
            placeholder="Email Address"
            placeholderTextColor="#64748b"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            style={inputStyle}
          />
          <TextInput
            placeholder="Password"
            placeholderTextColor="#64748b"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            style={inputStyle}
          />

          <TouchableOpacity
            onPress={handleLogin}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? "#92400e" : "#f59e0b",
              padding: 16,
              borderRadius: 12,
              alignItems: "center",
              marginTop: 8,
            }}
          >
            {isLoading ? (
              <ActivityIndicator color="#0f172a" />
            ) : (
              <Text style={{ color: "#0f172a", fontSize: 16, fontWeight: "700" }}>
                Sign In
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={{ textAlign: "center", color: "#475569", fontSize: 11, marginTop: 40 }}>
          Authorized rescue personnel only.{"\n"}Contact your barangay LGU for access.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const inputStyle = {
  backgroundColor: "#1e293b",
  borderWidth: 1,
  borderColor: "#334155",
  borderRadius: 12,
  padding: 14,
  fontSize: 16,
  color: "#e2e8f0",
} as const;
