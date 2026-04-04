// app/sos-form.tsx — REPLACES the placeholder from Step 2
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { router } from "expo-router";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "../contexts/AuthContext";
import { submitSOS, SOSPayload } from "../services/sosService";

const VULNERABILITY_OPTIONS = [
  { key: "children", label: "Children" },
  { key: "elderly", label: "Elderly" },
  { key: "disabled", label: "Disabled" },
  { key: "medical", label: "Medical Condition" },
];

export default function SOSFormScreen() {
  const { user, profile } = useAuth();

  // Form state
  const [peopleCount, setPeopleCount] = useState(1);
  const [message, setMessage] = useState("");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [vulnFlags, setVulnFlags] = useState<string[]>([]);

  // GPS state
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get GPS on screen open — one single request, not continuous
  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setLocationError("Location permission denied. SOS needs your location.");
          setLocationLoading(false);
          return;
        }

        // Race: GPS vs 10-second timeout
        // Better to submit with slightly stale coords than hang forever
        const loc = (await Promise.race([
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("GPS timeout")), 10000)),
        ])) as Location.LocationObject;

        setLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      } catch (e: any) {
        // Try last known position as fallback
        try {
          const last = await Location.getLastKnownPositionAsync();
          if (last) {
            setLocation({ lat: last.coords.latitude, lng: last.coords.longitude });
          } else {
            setLocationError("Could not get your location. Please enable GPS.");
          }
        } catch {
          setLocationError("GPS unavailable. Please enable location services.");
        }
      } finally {
        setLocationLoading(false);
      }
    })();
  }, []);

  // Pick photo from camera or gallery
  async function pickImage(useCamera: boolean) {
    try {
      const method = useCamera
        ? ImagePicker.launchCameraAsync
        : ImagePicker.launchImageLibraryAsync;

      const result = await method({
        mediaTypes: ["images"],
        quality: 0.7, // 70% quality — saves bandwidth
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        setImageUri(result.assets[0].uri);
      }
    } catch (e) {
      console.warn("Image picker error:", e);
    }
  }

  // Toggle vulnerability flag
  function toggleFlag(key: string) {
    setVulnFlags((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  }

  // Submit the SOS
  async function handleSubmit() {
    if (!location) {
      Alert.alert("Error", "Cannot send SOS without your location. Please enable GPS.");
      return;
    }
    if (!user || !profile) {
      Alert.alert("Error", "You must be logged in to send an SOS.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: SOSPayload = {
        reporter_id: user.id,
        latitude: location.lat,
        longitude: location.lng,
        barangay: profile.barangay || "Unknown",
        message: message.trim() || null,
        image_url: null, // Image upload to Supabase Storage comes in Phase 6
        people_count: peopleCount,
        vulnerability_flags: vulnFlags,
      };

      const result = await submitSOS(payload);

      if (result.queued) {
        Alert.alert(
          "SOS Queued",
          "No internet connection. Your SOS has been saved and will be sent automatically when connected.",
          [{ text: "OK", onPress: () => router.back() }]
        );
      } else if (result.incident_id) {
        // Navigate to confirmation screen with the incident ID
        router.replace({
          pathname: "/sos-confirm",
          params: { incidentId: result.incident_id },
        });
      }
    } catch (e: any) {
      Alert.alert("Error", "Failed to send SOS. Please try again.");
      console.error("SOS submit error:", e);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={{ flex: 1, backgroundColor: "#0f172a" }}
    >
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 50, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <View>
            <Text style={{ fontSize: 22, fontWeight: "800", color: "#dc2626" }}>
              Emergency SOS
            </Text>
            <Text style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
              Fill in details to help responders find you
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={{ color: "#64748b", fontSize: 14 }}>Cancel</Text>
          </TouchableOpacity>
        </View>

        {/* GPS Status */}
        <View
          style={{
            backgroundColor: location ? "#22c55e15" : locationError ? "#dc262615" : "#3b82f615",
            borderRadius: 12,
            padding: 14,
            marginBottom: 20,
            flexDirection: "row",
            alignItems: "center",
            gap: 10,
          }}
        >
          {locationLoading ? (
            <>
              <ActivityIndicator size="small" color="#3b82f6" />
              <Text style={{ color: "#94a3b8", fontSize: 13 }}>Acquiring GPS location...</Text>
            </>
          ) : location ? (
            <>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e" }} />
              <Text style={{ color: "#22c55e", fontSize: 13 }}>
                GPS locked: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
              </Text>
            </>
          ) : (
            <>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#dc2626" }} />
              <Text style={{ color: "#dc2626", fontSize: 13 }}>{locationError}</Text>
            </>
          )}
        </View>

        {/* People Count */}
        <Text style={{ color: "#e2e8f0", fontSize: 14, fontWeight: "600", marginBottom: 8 }}>
          People needing rescue
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {[1, 2, 3, 4, 5, 10, 15, 20].map((n) => (
            <TouchableOpacity
              key={n}
              onPress={() => setPeopleCount(n)}
              style={{
                backgroundColor: peopleCount === n ? "#3b82f6" : "#1e293b",
                borderWidth: 1,
                borderColor: peopleCount === n ? "#3b82f6" : "#334155",
                borderRadius: 10,
                paddingHorizontal: 16,
                paddingVertical: 10,
              }}
            >
              <Text style={{ color: peopleCount === n ? "#ffffff" : "#94a3b8", fontSize: 14, fontWeight: "600" }}>
                {n}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Vulnerability Flags */}
        <Text style={{ color: "#e2e8f0", fontSize: 14, fontWeight: "600", marginBottom: 8 }}>
          Vulnerable persons (optional)
        </Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {VULNERABILITY_OPTIONS.map((opt) => {
            const active = vulnFlags.includes(opt.key);
            return (
              <TouchableOpacity
                key={opt.key}
                onPress={() => toggleFlag(opt.key)}
                style={{
                  backgroundColor: active ? "#f59e0b20" : "#1e293b",
                  borderWidth: 1,
                  borderColor: active ? "#f59e0b" : "#334155",
                  borderRadius: 10,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                }}
              >
                <Text style={{ color: active ? "#f59e0b" : "#94a3b8", fontSize: 13 }}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Message */}
        <Text style={{ color: "#e2e8f0", fontSize: 14, fontWeight: "600", marginBottom: 8 }}>
          Describe your situation (optional)
        </Text>
        <TextInput
          placeholder="e.g. Water rising fast, trapped on second floor"
          placeholderTextColor="#64748b"
          value={message}
          onChangeText={setMessage}
          multiline
          numberOfLines={3}
          style={{
            backgroundColor: "#1e293b",
            borderWidth: 1,
            borderColor: "#334155",
            borderRadius: 12,
            padding: 14,
            fontSize: 14,
            color: "#e2e8f0",
            textAlignVertical: "top",
            minHeight: 80,
            marginBottom: 20,
          }}
        />

        {/* Photo */}
        <Text style={{ color: "#e2e8f0", fontSize: 14, fontWeight: "600", marginBottom: 8 }}>
          Attach photo (optional)
        </Text>
        <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
          <TouchableOpacity
            onPress={() => pickImage(true)}
            style={{ flex: 1, backgroundColor: "#1e293b", borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#334155" }}
          >
            <Text style={{ color: "#94a3b8", fontSize: 13 }}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => pickImage(false)}
            style={{ flex: 1, backgroundColor: "#1e293b", borderRadius: 12, padding: 14, alignItems: "center", borderWidth: 1, borderColor: "#334155" }}
          >
            <Text style={{ color: "#94a3b8", fontSize: 13 }}>From Gallery</Text>
          </TouchableOpacity>
        </View>
        {imageUri && (
          <View style={{ marginBottom: 20 }}>
            <Image
              source={{ uri: imageUri }}
              style={{ width: "100%", height: 200, borderRadius: 12 }}
              resizeMode="cover"
            />
            <TouchableOpacity onPress={() => setImageUri(null)} style={{ marginTop: 6 }}>
              <Text style={{ color: "#dc2626", fontSize: 12 }}>Remove photo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting || !location}
          style={{
            backgroundColor: isSubmitting || !location ? "#991b1b" : "#dc2626",
            padding: 18,
            borderRadius: 14,
            alignItems: "center",
            marginTop: 8,
          }}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={{ color: "#ffffff", fontSize: 18, fontWeight: "800" }}>
              SEND SOS
            </Text>
          )}
        </TouchableOpacity>

        <Text style={{ color: "#64748b", fontSize: 11, textAlign: "center", marginTop: 12 }}>
          Your location and details will be shared with authorized rescue teams only.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
