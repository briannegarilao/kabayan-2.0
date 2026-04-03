// app/login.tsx
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import { useAuth } from "../contexts/AuthContext";

const BARANGAYS = [
  "Burol I", "Burol II", "Burol III",
  "Datu Esmael", "Emmanuel Bergado I", "Emmanuel Bergado II",
  "Langkaan I", "Langkaan II",
  "Luzviminda I", "Luzviminda II",
  "Paliparan I", "Paliparan II", "Paliparan III",
  "Sabang", "Salawag",
  "Salitran I", "Salitran II", "Salitran III", "Salitran IV",
  "Sampaloc I", "Sampaloc II", "Sampaloc III", "Sampaloc IV", "Sampaloc V",
  "San Agustin I", "San Agustin II", "San Agustin III",
  "San Jose", "San Miguel",
  "Santa Fe", "Santo Cristo", "Santo Nino I", "Santo Nino II",
  "Victoria Reyes", "Zone I", "Zone II", "Zone III", "Zone IV",
];

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [barangay, setBarangay] = useState(BARANGAYS[0]);
  const [showPicker, setShowPicker] = useState(false);

  async function handleSubmit() {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Email and password are required.");
      return;
    }
    if (isRegister && !fullName.trim()) {
      Alert.alert("Error", "Full name is required.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters.");
      return;
    }

    setIsLoading(true);
    try {
      if (isRegister) {
        const { error } = await signUp(email.trim(), password, fullName.trim(), barangay, phone.trim());
        if (error) {
          Alert.alert("Registration Failed", error);
          return;
        }
      } else {
        const { error } = await signIn(email.trim(), password);
        if (error) {
          Alert.alert("Login Failed", error);
          return;
        }
      }
      router.replace("/home");
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
          <Text style={{ fontSize: 40, fontWeight: "800", color: "#3b82f6" }}>KABAYAN</Text>
          <Text style={{ fontSize: 14, color: "#94a3b8", marginTop: 4 }}>Citizen Emergency App</Text>
          <Text style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Dasmarinas City, Cavite</Text>
        </View>

        <View style={{ gap: 12 }}>
          {isRegister && (
            <>
              <TextInput
                placeholder="Full Name"
                placeholderTextColor="#64748b"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                style={inputStyle}
              />
              <TextInput
                placeholder="Phone Number (optional)"
                placeholderTextColor="#64748b"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
                style={inputStyle}
              />
              <TouchableOpacity
                onPress={() => setShowPicker(!showPicker)}
                style={{ ...inputStyle, justifyContent: "center" }}
              >
                <Text style={{ color: "#e2e8f0", fontSize: 16 }}>{barangay}</Text>
                <Text style={{ color: "#64748b", fontSize: 10, marginTop: 2 }}>Tap to change barangay</Text>
              </TouchableOpacity>

              {showPicker && (
                <ScrollView
                  style={{ maxHeight: 200, backgroundColor: "#1e293b", borderRadius: 12, borderWidth: 1, borderColor: "#334155" }}
                  nestedScrollEnabled
                >
                  {BARANGAYS.map((b) => (
                    <TouchableOpacity
                      key={b}
                      onPress={() => { setBarangay(b); setShowPicker(false); }}
                      style={{
                        padding: 12,
                        borderBottomWidth: 1,
                        borderBottomColor: "#334155",
                        backgroundColor: b === barangay ? "#334155" : "transparent",
                      }}
                    >
                      <Text style={{ color: b === barangay ? "#3b82f6" : "#e2e8f0", fontSize: 14 }}>{b}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </>
          )}

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
            onPress={handleSubmit}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? "#1e40af" : "#3b82f6",
              padding: 16,
              borderRadius: 12,
              alignItems: "center",
              marginTop: 8,
            }}
          >
            {isLoading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={{ color: "#ffffff", fontSize: 16, fontWeight: "700" }}>
                {isRegister ? "Create Account" : "Sign In"}
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { setIsRegister(!isRegister); setShowPicker(false); }}
            style={{ alignItems: "center", marginTop: 16 }}
          >
            <Text style={{ color: "#3b82f6", fontSize: 14 }}>
              {isRegister ? "Already have an account? Sign In" : "Don't have an account? Register"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={{ textAlign: "center", color: "#475569", fontSize: 11, marginTop: 40 }}>
          KABAYAN — Barangay Emergency Response System
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
