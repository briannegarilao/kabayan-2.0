// utils/config.ts
import Constants from "expo-constants";

function normalizeBaseUrl(url: string | null | undefined) {
  return url?.trim().replace(/\/$/, "") || null;
}

function getExpoHostIp() {
  const candidates = [
    Constants.expoConfig?.hostUri,
    (Constants as any).manifest2?.extra?.expoGo?.debuggerHost,
    (Constants as any).manifest?.debuggerHost,
  ];

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "string") continue;
    const host = candidate.split(",")[0]?.split(":")[0]?.trim();
    if (host) return host;
  }

  return null;
}

function resolveApiBaseUrl() {
  const explicit = normalizeBaseUrl(process.env.EXPO_PUBLIC_API_BASE_URL);
  if (explicit) return explicit;

  const expoHostIp = getExpoHostIp();
  if (expoHostIp) return `http://${expoHostIp}:8000`;

  return "http://127.0.0.1:8000";
}

const Config = {
  API_BASE_URL: resolveApiBaseUrl(),
  DASMA_LAT: 14.3294,
  DASMA_LNG: 120.9367,
} as const;

export default Config;
