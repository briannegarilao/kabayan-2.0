# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from routers import sos, responders, analytics, routing, weather, inference
from services.supabase_client import init_supabase

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Supabase client once at startup
    init_supabase()
    yield
    # Cleanup on shutdown if needed

app = FastAPI(
    title="KABAYAN API",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://kabayan.vercel.app",  # Production web dashboard
        "http://localhost:3000"         # Development
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(sos.router, prefix="/api/sos", tags=["SOS"])
app.include_router(responders.router, prefix="/api/responders", tags=["Responders"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(routing.router, prefix="/api/routing", tags=["Routing"])
app.include_router(weather.router, prefix="/api/weather", tags=["Weather"])
app.include_router(inference.router, prefix="/api/inference", tags=["Inference"])

@app.get("/health")
async def health_check():
    return {"status": "operational", "service": "KABAYAN API v2"}