# services/notifications.py
import httpx
from services.supabase_client import get_supabase_admin

EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

async def send_push_notification(expo_token: str, title: str, body: str, data: dict = {}):
    if not expo_token or not expo_token.startswith("ExponentPushToken"):
        return  # Skip invalid tokens silently

    async with httpx.AsyncClient() as client:
        await client.post(EXPO_PUSH_URL, json={
            "to": expo_token,
            "title": title,
            "body": body,
            "data": data,
            "sound": "default",
            "priority": "high"
        })

async def notify_responder_assignment(responder_id: str, incident_id: str):
    supabase = get_supabase_admin()
    user = supabase.table("users")\
        .select("expo_push_token, full_name")\
        .eq("id", responder_id)\
        .single()\
        .execute()

    if user.data and user.data.get("expo_push_token"):
        await send_push_notification(
            user.data["expo_push_token"],
            title="🚨 New SOS Assignment",
            body="You have been assigned to an emergency incident. Open KABAYAN to respond.",
            data={"incident_id": incident_id, "screen": "IncidentDetail"}
        )