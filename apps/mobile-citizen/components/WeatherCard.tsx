// components/WeatherCard.tsx
import React from "react";
import { View, Text } from "react-native";

// WMO weather codes to readable descriptions
// Only the most common codes — keeps bundle small
const WEATHER_DESCRIPTIONS: Record<number, string> = {
  0: "Clear sky",
  1: "Mainly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Foggy",
  48: "Depositing rime fog",
  51: "Light drizzle",
  53: "Moderate drizzle",
  55: "Dense drizzle",
  61: "Slight rain",
  63: "Moderate rain",
  65: "Heavy rain",
  71: "Slight snow",
  73: "Moderate snow",
  75: "Heavy snow",
  80: "Slight rain showers",
  81: "Moderate rain showers",
  82: "Violent rain showers",
  95: "Thunderstorm",
  96: "Thunderstorm with slight hail",
  99: "Thunderstorm with heavy hail",
};

interface WeatherCardProps {
  weather: any;
}

export default function WeatherCard({ weather }: WeatherCardProps) {
  const current = weather?.current;
  if (!current) return null;

  const temp = current.temperature_2m;
  const humidity = current.relative_humidity_2m;
  const precipitation = current.precipitation;
  const windSpeed = current.wind_speed_10m;
  const weatherCode = current.weather_code;
  const description = WEATHER_DESCRIPTIONS[weatherCode] || "Unknown";

  // Check if there's rain in the next 6 hours (flood warning relevance)
  const hourlyPrecip = weather?.hourly?.precipitation || [];
  const next6Hours = hourlyPrecip.slice(0, 6);
  const totalRainNext6h = next6Hours.reduce((sum: number, val: number) => sum + val, 0);
  const isRainExpected = totalRainNext6h > 0;

  return (
    <View
      style={{
        backgroundColor: "#1e293b",
        borderRadius: 16,
        padding: 20,
        marginBottom: 24,
        borderLeftWidth: 4,
        borderLeftColor: isRainExpected ? "#f59e0b" : "#22c55e",
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <View>
          <Text style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", letterSpacing: 1 }}>
            Dasmarinas Weather
          </Text>
          <Text style={{ fontSize: 32, fontWeight: "800", color: "#e2e8f0", marginTop: 4 }}>
            {Math.round(temp)}°C
          </Text>
          <Text style={{ fontSize: 14, color: "#94a3b8", marginTop: 2 }}>{description}</Text>
        </View>

        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontSize: 12, color: "#94a3b8" }}>Humidity: {humidity}%</Text>
          <Text style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>Wind: {windSpeed} km/h</Text>
          <Text style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
            Rain: {precipitation} mm
          </Text>
        </View>
      </View>

      {/* Rain forecast alert */}
      {isRainExpected && (
        <View
          style={{
            backgroundColor: "#f59e0b15",
            borderRadius: 8,
            padding: 10,
            marginTop: 12,
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <Text style={{ fontSize: 12, color: "#f59e0b", fontWeight: "600" }}>
            Rain expected in the next 6 hours ({totalRainNext6h.toFixed(1)} mm total)
          </Text>
        </View>
      )}
    </View>
  );
}
