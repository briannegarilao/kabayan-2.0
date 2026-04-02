# apps/api/services/notifications.py
import httpx
from services.supabase_client import get_supabase

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"


async def send_push(expo_token: str, title: str, body: str, data: dict | None = None) -> bool:
    """Send a single Expo push notification. Returns True on success."""
    if not expo_token or not expo_token.startswith("ExponentPushToken"):
        return False

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                EXPO_PUSH_URL,
                json={
                    "to": expo_token,
                    "title": title,
                    "body": body,
                    "data": data or {},
                    "sound": "default",
                    "priority": "high",
                },
            )
            return resp.status_code == 200
    except httpx.HTTPError:
        # Push failures are non-critical — log but don't crash
        return False


async def notify_responder_assignment(responder_id: str, incident_id: str) -> None:
    """Push notification to the assigned responder."""
    supabase = get_supabase()
    result = (
        supabase.table("users")
        .select("expo_push_token, full_name")
        .eq("id", responder_id)
        .maybe_single()
        .execute()
    )

    if result.data and result.data.get("expo_push_token"):
        await send_push(
            expo_token=result.data["expo_push_token"],
            title="🚨 New SOS Assignment",
            body="You have been assigned to an emergency incident. Open KABAYAN to respond.",
            data={"incident_id": incident_id, "screen": "IncidentDetail"},
        )


async def notify_citizen_status_change(incident_id: str, new_status: str) -> None:
    """Push notification to the citizen who filed the SOS."""
    supabase = get_supabase()

    # Get the reporter's push token
    incident = (
        supabase.table("sos_incidents")
        .select("reporter_id")
        .eq("id", incident_id)
        .maybe_single()
        .execute()
    )

    if not incident.data:
        return

    user = (
        supabase.table("users")
        .select("expo_push_token")
        .eq("id", incident.data["reporter_id"])
        .maybe_single()
        .execute()
    )

    if not user.data or not user.data.get("expo_push_token"):
        return

    messages = {
        "assigned": ("Responder Assigned", "A rescue team has been assigned to your SOS. Help is on the way."),
        "in_progress": ("Responder En Route", "A rescue team is heading to your location. Stay visible and safe."),
        "resolved": ("Incident Resolved", "Your SOS has been resolved. Stay safe."),
    }

    title, body = messages.get(new_status, ("Status Update", f"Your SOS status is now: {new_status}"))

    await send_push(
        expo_token=user.data["expo_push_token"],
        title=title,
        body=body,
        data={"incident_id": incident_id, "status": new_status},
    )


async def notify_lgu_new_sos(incident_id: str, barangay: str) -> None:
    """
    Placeholder — in production this would notify all LGU admins.
    For now, Supabase Realtime handles dashboard updates automatically.
    """
    pass
