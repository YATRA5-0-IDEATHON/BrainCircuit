/**
 * Server-side helper for dispatching OneSignal push notifications.
 * Uses OneSignal's External ID targeting so we never have to store raw
 * device/player IDs ourselves: the client (OneSignalInit.tsx) calls
 * OneSignal.login(supabaseUserId) once signed in, aliasing the device
 * to that user's profile id. We can then target by external_id here.
 */

interface SendPushOptions {
  externalUserIds: string[];
  heading: string;
  message: string;
  url?: string;
}

export async function sendPushNotification({
  externalUserIds,
  heading,
  message,
  url,
}: SendPushOptions) {
  if (!process.env.ONESIGNAL_REST_API_KEY || !process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID) {
    console.warn("OneSignal is not configured; skipping push notification.");
    return null;
  }

  if (externalUserIds.length === 0) return null;

  const options = {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      Authorization: `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
    },
    body: JSON.stringify({
      app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
      include_aliases: { external_id: externalUserIds },
      target_channel: "push",
      headings: { en: heading },
      contents: { en: message },
      ...(url ? { url } : {}),
    }),
  };

  try {
    const response = await fetch(
      "https://onesignal.com/api/v1/notifications",
      options,
    );
    const data = await response.json();
    if (!response.ok) {
      console.error("OneSignal API error:", data);
    }
    return data;
  } catch (error) {
    console.error("Error sending OneSignal notification:", error);
    return null;
  }
}
