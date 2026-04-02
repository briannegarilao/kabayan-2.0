# apps/api/main.py
# REPLACES existing main.py — adds trips router for Phase 2
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from config import get_settings
from services.supabase_client import init_supabase
from routers import sos, responders, analytics, routing, weather, trips


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_supabase()
    print("[STARTUP] Supabase client initialized")
    print("[STARTUP] KABAYAN API v2 — PWCD Assignment Engine active")
    yield
    print("[SHUTDOWN] KABAYAN API shutting down")


app = FastAPI(
    title="KABAYAN API",
    description="Flood Emergency Response Backend — Dasmariñas, Cavite. PWCD Assignment Engine.",
    version="2.1.0",
    lifespan=lifespan,
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────
app.include_router(sos.router, prefix="/api/sos", tags=["SOS"])
app.include_router(responders.router, prefix="/api/responders", tags=["Responders"])
app.include_router(trips.router, prefix="/api/trips", tags=["Trips"])  # NEW in Phase 2
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(routing.router, prefix="/api/routing", tags=["Routing"])
app.include_router(weather.router, prefix="/api/weather", tags=["Weather"])


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "operational", "service": "KABAYAN API v2.1 — PWCD Engine"}
