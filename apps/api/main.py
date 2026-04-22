# apps/api/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from config import get_settings
from services.supabase_client import init_supabase
from services.dev_logs import add_dev_log
from routers import sos, responders, analytics, routing, weather, trips, dev


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_supabase()
    add_dev_log(
        source="SYSTEM",
        level="INFO",
        event="startup",
        message="Supabase client initialized",
    )
    add_dev_log(
        source="SYSTEM",
        level="INFO",
        event="startup",
        message="KABAYAN API v2 — PWCD Assignment Engine active",
    )
    yield
    add_dev_log(
        source="SYSTEM",
        level="INFO",
        event="shutdown",
        message="KABAYAN API shutting down",
    )


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

# Main routers
app.include_router(sos.router, prefix="/api/sos", tags=["SOS"])
app.include_router(responders.router, prefix="/api/responders", tags=["Responders"])
app.include_router(trips.router, prefix="/api/trips", tags=["Trips"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(routing.router, prefix="/api/routing", tags=["Routing"])
app.include_router(weather.router, prefix="/api/weather", tags=["Weather"])

# Dev router
app.include_router(dev.router, prefix="/api/dev", tags=["Dev"])


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "operational", "service": "KABAYAN API v2.1 — PWCD Engine"}