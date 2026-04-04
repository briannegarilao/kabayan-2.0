// services/pushNotifications.ts
// Push notifications require a development build (not Expo Go).
// For now, this is a no-op. Will be enabled in Phase 8 production deploy.

export async function registerPushToken(
  userId: string,
): Promise<string | null> {
  // Skip in Expo Go — push notifications removed from Expo Go in SDK 53+
  console.log("Push notifications skipped (requires development build).");
  return null;
}
