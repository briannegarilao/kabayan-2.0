# KABAYAN Disaster Response System

KABAYAN is a multi-platform disaster response platform built for emergency coordination in Dasmarinas City, Cavite. It brings together a command dashboard for LGU operators, a citizen-facing SOS mobile app, a responder mobile app, and a FastAPI backend that handles dispatch, routing, weather, and operational workflows.

This repository is organized as a monorepo so the web app, mobile apps, API, and shared packages can evolve together with a consistent data model and shared tooling.

## Table of Contents

- [Overview](#overview)
- [Core Capabilities](#core-capabilities)
- [System Architecture](#system-architecture)
- [Repository Structure](#repository-structure)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Available Commands](#available-commands)
- [Backend API Surface](#backend-api-surface)
- [Development Workflow](#development-workflow)
- [Deployment Notes](#deployment-notes)
- [Roadmap](#roadmap)
- [Team](#team)
- [License](#license)

## Overview

KABAYAN is designed to support the full disaster-response loop:

- Citizens can submit SOS requests from mobile.
- Responders can receive assignments and report field activity.
- LGU operators can monitor incidents, responders, routes, and evacuation data from a central dashboard.
- The backend coordinates operational services such as routing, assignment support, weather access, and analytics endpoints.

The project uses Supabase as the primary data layer and real-time backbone, with a modern TypeScript monorepo for the frontend surfaces and a Python backend for service orchestration.

## Core Capabilities

- Real-time LGU dashboard for incident monitoring and responder visibility
- Citizen mobile experience for SOS submission and confirmation flows
- Responder mobile workflow for assignment handling and field coordination
- Backend service layer for SOS handling, responder operations, trips, analytics, routing, and weather
- Shared packages for UI, types, linting, TypeScript config, and Supabase-related database utilities
- Monorepo workflow with Turborepo for coordinated builds, linting, and type-checking

## System Architecture

```text
Citizen Mobile App
  -> submits SOS and incident details
  -> stores and reads operational data via Supabase

Responder Mobile App
  -> receives assignments
  -> updates operational activity and field state
  -> reads and writes responder-related data via Supabase

LGU Web Dashboard
  -> monitors incidents, responders, and map activity
  -> consumes Supabase data and realtime updates
  -> coordinates admin-side workflows

FastAPI Backend
  -> /api/sos
  -> /api/responders
  -> /api/trips
  -> /api/analytics
  -> /api/routing
  -> /api/weather
  -> integrates with Supabase, OSRM, and Expo push services

Infrastructure
  -> Supabase (database, auth, realtime)
  -> OSRM for routing
  -> Expo push notification service
```

## Repository Structure

```text
kabayan-system/
├── apps/
│   ├── api/                # FastAPI backend
│   ├── docs/               # Next.js documentation app
│   ├── mobile-citizen/     # Expo citizen mobile app
│   ├── mobile-responder/   # Expo responder mobile app
│   └── web/                # Next.js LGU dashboard
├── packages/
│   ├── database/           # Shared Supabase/database utilities
│   ├── eslint-config/      # Shared ESLint configuration
│   ├── shared-types/       # Shared TypeScript types
│   ├── typescript-config/  # Shared TS config
│   └── ui/                 # Shared UI components
├── contexts/
├── utils/
├── turbo.json
└── package.json
```

## Technology Stack

### Frontend

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- React Query
- Leaflet / React Leaflet

### Mobile

- Expo
- React Native
- Expo Router
- TypeScript
- Supabase JavaScript client

### Backend

- FastAPI
- Uvicorn
- Pydantic Settings
- HTTPX
- Supabase Python client

### Tooling and Infrastructure

- Turborepo
- npm workspaces
- ESLint
- Prettier
- Supabase
- OSRM
- Expo Push Notifications

## Getting Started

### Prerequisites

Install the following before running the project:

- Node.js 18 or newer
- npm 10 or newer
- Python 3.10 or newer
- Git
- Expo Go or an emulator/device if you want to run the mobile apps

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd kabayan-system
```

### 2. Install JavaScript dependencies

```bash
npm install
```

### 3. Set up the backend virtual environment

From the repository root:

```bash
cd apps/api
python -m venv venv
```

Activate the environment:

```bash
# Windows PowerShell
.\venv\Scripts\Activate.ps1
```

```bash
# macOS / Linux
source venv/bin/activate
```

Install Python dependencies:

```bash
pip install -r requirements.txt
```

### 4. Create local environment files

This repository does not currently include checked-in `.env.example` files, so create the needed local env files manually.

Recommended local files:

- `apps/web/.env.local`
- `apps/api/.env`
- Expo env configuration for each mobile app as needed

### 5. Run the applications

Run the monorepo dev workflow from the repository root:

```bash
npm run dev
```

This starts the workspace development tasks configured through Turborepo.

### Running individual apps

Web dashboard:

```bash
npx turbo dev --filter=web
```

Docs app:

```bash
npx turbo dev --filter=docs
```

Citizen mobile app:

```bash
cd apps/mobile-citizen
npx expo start
```

Responder mobile app:

```bash
cd apps/mobile-responder
npx expo start
```

FastAPI backend:

```bash
cd apps/api
uvicorn main:app --reload --port 8000
```

### Default local URLs

- Web dashboard: `http://localhost:3000`
- Docs app: `http://localhost:3001`
- API docs: `http://localhost:8000/docs`
- API health check: `http://localhost:8000/health`

## Environment Variables

### Web app

Create `apps/web/.env.local` with:

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anonymous key for web client access |

### Citizen mobile app

Configure the citizen app with:

| Variable | Required | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anonymous key for mobile client access |

### Responder mobile app

Configure the responder app with:

| Variable | Required | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Yes | Public anonymous key for mobile client access |

### API

Create `apps/api/.env` with:

| Variable | Required | Purpose |
| --- | --- | --- |
| `SUPABASE_URL` | Yes | Supabase project URL for backend access |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service-role key for privileged backend operations |
| `OSRM_BASE_URL` | No | Routing service base URL. Defaults to the public OSRM server |
| `HF_INFERENCE_URL` | No | Hugging Face inference endpoint |
| `EXPO_ACCESS_TOKEN` | No | Expo access token for push notification workflows |
| `CORS_ORIGINS` | No | Allowed frontend origins for API access |
| `DASMA_LAT` | No | Default Dasmarinas latitude |
| `DASMA_LNG` | No | Default Dasmarinas longitude |
| `WEATHER_CACHE_MINUTES` | No | Weather caching duration |
| `ROUTE_CACHE_HOURS` | No | Routing cache duration |

### Security notes

- Never commit `.env` or `.env.local` files.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to any client-side app.
- Treat push notification tokens and third-party service endpoints as sensitive operational configuration.

## Available Commands

From the repository root:

| Command | Description |
| --- | --- |
| `npm run dev` | Starts workspace development tasks |
| `npm run build` | Builds all configured workspaces |
| `npm run lint` | Runs linting across workspaces |
| `npm run format` | Formats TypeScript, TSX, and Markdown files |
| `npm run check-types` | Runs workspace type-checking |

App-specific commands:

| Location | Command | Description |
| --- | --- | --- |
| `apps/web` | `npm run dev` | Starts the web dashboard on port 3000 |
| `apps/docs` | `npm run dev` | Starts the docs app on port 3001 |
| `apps/mobile-citizen` | `npm run start` | Starts Expo for the citizen app |
| `apps/mobile-responder` | `npm run start` | Starts Expo for the responder app |
| `apps/api` | `uvicorn main:app --reload --port 8000` | Starts the FastAPI backend |

## Backend API Surface

The FastAPI application currently mounts the following router groups:

| Route Prefix | Responsibility |
| --- | --- |
| `/api/sos` | SOS-related workflows |
| `/api/responders` | Responder operations |
| `/api/trips` | Trip and assignment movement workflows |
| `/api/analytics` | Analytics endpoints |
| `/api/routing` | Routing and travel-related operations |
| `/api/weather` | Weather-related services |
| `/health` | Service health check |

Interactive API documentation is available at `/docs` when the backend is running locally.

## Development Workflow

Professional repositories are easier to maintain when they make expectations explicit. For this project, the recommended workflow is:

1. Create a feature branch for each change.
2. Keep environment-specific secrets in local env files only.
3. Run linting and type-checking before opening a pull request.
4. Prefer focused commits with descriptive messages.
5. Document meaningful architectural or workflow changes in the README or app-level docs.

Suggested pull request checklist:

- Scope is clear and limited
- Local setup still works
- New configuration is documented
- UI/API behavior changes are described
- No secrets were committed

## Deployment Notes

This repository is structured to support separated deployment targets:

- `apps/web` can be deployed as a Next.js application
- `apps/docs` can be deployed independently as a Next.js site
- `apps/api` can be deployed as a Python ASGI service
- `apps/mobile-citizen` and `apps/mobile-responder` can be distributed through Expo/EAS workflows

Before deployment:

- Verify all environment variables per target
- Confirm Supabase project configuration and access policies
- Confirm allowed CORS origins for the API
- Validate routing and push-notification credentials if those flows are in use

## Roadmap

Potential next improvements for the repository:

- Add root-level `.env.example` files for every app
- Replace starter READMEs inside app folders with project-specific documentation
- Add architecture diagrams and screenshots
- Add automated test coverage and CI checks
- Add contribution guidelines and issue templates
- Add release/versioning documentation

## Team

KABAYAN was developed through a collaborative effort focused on building a practical, field-oriented disaster response platform for local government operations and emergency coordination.

Core developers:

- COS
- ALEJANDRO
- GARILAO

The team contributed to the planning, implementation, and integration of the platform's web, mobile, and backend systems. As the project documentation matures, this section can be extended further with full names, formal roles, GitHub profiles, institutional affiliation, and contact links.

## License

This project is licensed under the terms of the [MIT License](LICENSE).
