# apps/api/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from config import get_settings
from services.supabase_client import init_supabase
from routers import sos, responders, analytics, routing, weather


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Runs once at startup. Initializes the Supabase client singleton.
    Everything that needs to happen exactly once goes here.
    """
    init_supabase()
    print("[STARTUP] Supabase client initialized")
    print("[STARTUP] KABAYAN API v2 ready")
    yield
    print("[SHUTDOWN] KABAYAN API shutting down")


app = FastAPI(
    title="KABAYAN API",
    description="Flood Emergency Response Backend — Dasmariñas, Cavite",
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────
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
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(routing.router, prefix="/api/routing", tags=["Routing"])
app.include_router(weather.router, prefix="/api/weather", tags=["Weather"])


# ── Health Check ──────────────────────────────────────────────────────
@app.get("/health", tags=["Health"])
async def health_check():
    """UptimeRobot pings this every 14 minutes to prevent Render sleep."""
    return {"status": "operational", "service": "KABAYAN API v2"}
