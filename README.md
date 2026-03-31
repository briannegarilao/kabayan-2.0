# KABAYAN — Disaster Response System

A real-time disaster response platform for Dasmariñas City, Cavite. Built as a Turborepo monorepo with a Next.js LGU dashboard, FastAPI backend, and Expo mobile app for field responders.

## Apps

| App | Description |
|---|---|
| `apps/web` | Next.js 16 LGU admin dashboard — live incident map, analytics, responder tracking |
| `apps/api` | FastAPI Python backend — SOS dispatch, auto-assignment, ML analytics, routing |
| `apps/mobile-responder` | Expo React Native app for field responders — receives assignments, streams location |

## Packages

| Package | Description |
|---|---|
| `packages/database` | Shared Supabase Realtime client + generated DB types |
| `packages/shared-types` | Cross-app TypeScript types and map config |
| `packages/ui` | Shared React component library |

## Getting Started

### Prerequisites

- Node.js >= 18
- Python >= 3.10 (for `apps/api`)
- npm 10

### Setup

```sh
git clone https://github.com/briannegarilao/kabayan-2.0.git
cd kabayan-2.0
npm install
```

Copy environment variables:

```sh
cp .env.example apps/web/.env.local
cp .env.example apps/api/.env
```

Fill in the required values (see [Environment Variables](#environment-variables)).

### Run all apps

```sh
npm run dev
```

### Run a single app

```sh
npx turbo dev --filter=web
```

### Run the Python API

```sh
cd apps/api
python -m venv venv
source venv/Scripts/activate  # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs: `http://localhost:8000/docs`

## Commands

```sh
npm run dev          # Start all apps
npm run build        # Build all apps
npm run lint         # Lint all apps
npm run format       # Prettier format
npm run check-types  # TypeScript type-check all apps
```

## Architecture

```
Mobile Citizen App
  └── POST /api/sos/create
        └── FastAPI
              ├── PostGIS: find_nearest_responder()
              ├── Expo push → Mobile Responder App
              └── YOLOv8n image severity inference (Hugging Face)

Mobile Responder App
  └── REST update every 15s → Supabase (responders.current_location)

Web Dashboard
  ├── Supabase Realtime → live incident/responder map
  └── FastAPI /api/analytics → ML insights (DBSCAN, ARIMA, Apriori)
```

All persistent state is in **Supabase (Postgres + PostGIS)**. The `find_nearest_responder` PostGIS RPC handles auto-dispatch.

## Environment Variables

| Variable | Used by | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | web, mobile | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | web, mobile | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | api only | Service role key — never expose to client |
| `OSRM_BASE_URL` | api | OSRM routing server URL |
| `HF_INFERENCE_URL` | api | Hugging Face YOLOv8n inference endpoint |
| `EXPO_ACCESS_TOKEN` | api | Expo push notification token |

## Stack

- **Web**: Next.js 16, React 19, Tailwind CSS, React Leaflet, TanStack Query, Supabase SSR
- **API**: FastAPI, Supabase Python, PostGIS, OSRM, Open-Meteo, scikit-learn
- **Mobile**: Expo, React Native, Expo Location, Supabase JS
- **Infra**: Supabase (Postgres + PostGIS + Realtime), Turborepo, TypeScript
