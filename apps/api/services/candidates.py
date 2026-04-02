# apps/api/services/candidates.py
"""
Rule 3 — Candidate Responder Selection
Finds all available responders within range, with capacity and geo-exclusion filtering.
"""
import math
from datetime import datetime, timezone
from services.supabase_client import get_supabase

# In-memory geo-exclusion store: {responder_id: {barangay: expiry_datetime}}
# This is intentionally in-memory — exclusions are short-lived (30 min)
# and don't need to survive server restarts.
_geo_exclusions: dict[str, dict[str, datetime]] = {}


def add_geo_exclusion(responder_id: str, barangay: str, minutes: int = 30) -> None:
    """Mark a responder as excluded from a barangay for N minutes."""
    expiry = datetime.now(timezone.utc).replace(microsecond=0)
    expiry = expiry.replace(
        minute=expiry.minute + minutes if expiry.minute + minutes < 60 else 0,
        hour=expiry.hour + ((expiry.minute + minutes) // 60),
    )
    # Simpler: just add seconds
    from datetime import timedelta
    expiry = datetime.now(timezone.utc) + timedelta(minutes=minutes)

    if responder_id not in _geo_exclusions:
        _geo_exclusions[responder_id] = {}
    _geo_exclusions[responder_id][barangay] = expiry


def is_geo_excluded(responder_id: str, barangay: str) -> bool:
    """Check if a responder is currently excluded from a barangay."""
    exclusions = _geo_exclusions.get(responder_id)
    if not exclusions:
        return False

    expiry = exclusions.get(barangay)
    if not expiry:
        return False

    if datetime.now(timezone.utc) > expiry:
        # Expired — clean up
        del exclusions[barangay]
        return False

    return True


def find_candidates(
    incident_lat: float,
    incident_lng: float,
    incident_barangay: str,
    people_needed: int,
    max_distance_m: float = 10000,
) -> list[dict]:
    """
    Find all available responders within range that can serve this incident.
    Returns list of candidate dicts with distance and capacity info.
    """
    supabase = get_supabase()

    # Fetch all available responders with GPS signal
    result = (
        supabase.table("responders")
        .select(
            "id, is_available, current_location, vehicle_type, team_name, "
            "max_capacity, current_load, last_location_update"
        )
        .eq("is_available", True)
        .not_.is_("current_location", "null")
        .execute()
    )

    if not result.data:
        return []

    candidates = []
    for r in result.data:
        # Skip geo-excluded responders
        if is_geo_excluded(r["id"], incident_barangay):
            continue

        # Skip responders without enough remaining capacity
        remaining = (r.get("max_capacity") or 10) - (r.get("current_load") or 0)
        if remaining < people_needed:
            continue

        # Parse responder location from WKB hex or WKT
        resp_coords = _parse_location(r.get("current_location"))
        if not resp_coords:
            continue

        resp_lat, resp_lng = resp_coords

        # Haversine straight-line distance (fast filter before OSRM)
        distance_m = _haversine(incident_lat, incident_lng, resp_lat, resp_lng)
        if distance_m > max_distance_m:
            continue

        candidates.append({
            "responder_id": r["id"],
            "team_name": r.get("team_name") or "Responder",
            "vehicle_type": r.get("vehicle_type") or "Unknown",
            "max_capacity": r.get("max_capacity") or 10,
            "current_load": r.get("current_load") or 0,
            "remaining_capacity": remaining,
            "lat": resp_lat,
            "lng": resp_lng,
            "straight_line_distance_m": round(distance_m, 0),
        })

    # Sort by straight-line distance (OSRM will refine this later)
    candidates.sort(key=lambda c: c["straight_line_distance_m"])
    return candidates


def _parse_location(loc: str | None) -> tuple[float, float] | None:
    """Parse PostGIS geography to (lat, lng). Handles WKT and WKB hex."""
    if not loc:
        return None

    # WKT format: POINT(lng lat)
    import re
    match = re.match(r"POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)", str(loc), re.IGNORECASE)
    if match:
        lng = float(match.group(1))
        lat = float(match.group(2))
        return (lat, lng)

    # WKB hex format (from Supabase PostGIS) — decode the coordinates
    if len(str(loc)) > 40 and all(c in "0123456789abcdefABCDEF" for c in str(loc)):
        try:
            import struct
            hex_str = str(loc)
            # Standard WKB Point: byte_order(1) + type(4) + x(8) + y(8) = 21 bytes = 42 hex chars
            # With SRID: byte_order(1) + type(4) + srid(4) + x(8) + y(8) = 25 bytes = 50 hex chars
            # EWKB (PostGIS default): starts with 0101000020E6100000 for POINT SRID=4326 little-endian
            if hex_str.upper().startswith("0101000020E6100000"):
                # EWKB little-endian, SRID present
                x_hex = hex_str[18:34]  # longitude
                y_hex = hex_str[34:50]  # latitude
                lng = struct.unpack("<d", bytes.fromhex(x_hex))[0]
                lat = struct.unpack("<d", bytes.fromhex(y_hex))[0]
                return (lat, lng)
        except (struct.error, ValueError):
            pass

    return None


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in meters between two points."""
    R = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
