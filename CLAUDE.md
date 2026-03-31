# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this system is

KABAYAN is a disaster response platform for Dasmariñas City, Cavite. It has three main apps:
- **`apps/web`** — Next.js 16 LGU admin dashboard (map, analytics, incident management)
- **`apps/api`** — FastAPI Python backend (SOS dispatch, ML analytics, routing, inference)
- **`apps/mobile-responder`** — Expo/React Native app for field responders (location tracking, push notifications)

## Monorepo commands (run from root)

```bash
npm run dev          # Start all apps in parallel via Turborepo
npm run build        # Build all apps
npm run lint         # Lint all apps
npm run format       # Prettier format all .ts/.tsx/.md
npm run check-types  # Type-check all apps
```

To run a single app:
```bash
npm run dev --workspace=apps/web
npx turbo dev --filter=web
npx turbo dev --filter=api   # (not currently a turbo task — run directly)
```

## Running the Python API

```bash
cd apps/api
python -m venv venv
source venv/Scripts/activate   # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs auto-available at `http://localhost:8000/docs`.

## Architecture

### Data flow

```
Mobile Citizen App → POST /api/sos/create → FastAPI
  → auto_assign_responder() (PostGIS: find_nearest_responder RPC)
  → notify_responder_assignment() (Expo push)
  → (if image) YOLOv8n inference via HF_INFERENCE_URL

Mobile Responder App → Supabase REST (every 15s) → updates responders.current_location

Web Dashboard → Supabase Realtime subscriptions → live map updates
             → FastAPI /api/analytics for ML-derived insights
```

### Supabase is the core database

All persistent state lives in Supabase (Postgres + PostGIS). Key tables: `sos_incidents`, `responders`. The `find_nearest_responder` PostGIS RPC is called by the API for auto-assignment.

Two Supabase clients exist in the web app:
- `apps/web/lib/supabase/server.ts` — server components / middleware (SSR, cookie-based sessions)
- `packages/database/realtime.ts` — browser client with Realtime enabled (throttled to 10 events/sec)

### Web app auth

`apps/web/middleware.ts` refreshes the Supabase session on every request (required — without `getUser()` sessions expire silently). Route protection is in the middleware: `/dashboard/*` requires auth, `/login` redirects authenticated users away.

### FastAPI services

- `services/assignment.py` — PostGIS nearest-responder lookup + Expo push to assigned responder
- `services/notifications.py` — Expo push notifications (uses `EXPO_ACCESS_TOKEN`)
- `services/cache.py` — caching layer
- `routers/inference.py` — proxies image to HF_INFERENCE_URL (YOLOv8n severity classification)
- `routers/routing.py` — calls OSRM for turn-by-turn routing
- `routers/weather.py` — calls Open-Meteo (no API key needed)
- `ml/` — DBSCAN clustering, ARIMA forecasting, Apriori for incident analytics

### Packages

- `packages/database/` — shared Supabase Realtime client + generated `Database` types (`supabase-types`)
- `packages/shared-types/map-config.ts` — Leaflet map config (center: Dasmariñas, tile provider: Stadia Maps)
- `packages/ui/` — shared React component library
- `packages/shared-types/` — cross-app TypeScript types

### Web dashboard map

Uses React Leaflet with `leaflet.heat` and `leaflet.markercluster`. Map is restricted to Dasmariñas bounding box. Tile source is Stadia Maps (200K tiles/month free tier) with OSM fallback.

## Environment variables

Copy `.env.example` to `.env.local` (web) and `.env` (api). Required vars:

| Variable | Used by |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | web, mobile |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web, mobile |
| `SUPABASE_SERVICE_ROLE_KEY` | api only (never client-side) |
| `OSRM_BASE_URL` | api routing |
| `HF_INFERENCE_URL` | api inference (YOLOv8n) |
| `EXPO_ACCESS_TOKEN` | api notifications |

## Next.js deprecation warning

`apps/web/middleware.ts` uses the deprecated `middleware` convention. Next.js 16 expects it renamed to `proxy`. It still works but will need migration eventually.
