# apps/api/services/supabase_client.py
from supabase import create_client, Client
from config import get_settings

# Module-level singleton — initialized once, reused everywhere
_supabase: Client | None = None


def init_supabase() -> None:
    """Call once during app lifespan startup."""
    global _supabase
    settings = get_settings()
    
    print("[SUPABASE INIT]", {
    "project_ref": settings.SUPABASE_URL.replace("https://", "").split(".")[0]
    })
    
    _supabase = create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY,  # Admin key — bypasses all RLS
    )


def get_supabase() -> Client:
    """
    FastAPI dependency. Use in route handlers:
        async def my_route(supabase=Depends(get_supabase)):
    """
    if _supabase is None:
        raise RuntimeError("Supabase client not initialized. Call init_supabase() first.")
    return _supabase
