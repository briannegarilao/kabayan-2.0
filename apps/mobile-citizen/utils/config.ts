// utils/config.ts
// Your PC's local IP so the phone can reach FastAPI over WiFi.
// Change to your Render URL in production.
const Config = {
  API_BASE_URL: "http://192.168.1.7:8000",
  DASMA_LAT: 14.3294,
  DASMA_LNG: 120.9367,
} as const;

export default Config;
