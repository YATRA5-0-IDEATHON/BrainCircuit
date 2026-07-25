"use client";

import { useEffect } from "react";
import OneSignal from "react-onesignal";
import { createClient } from "@/lib/supabase/client";

export default function OneSignalInit() {
  useEffect(() => {
    async function initOneSignal() {
      try {
        if (!process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID) return;

        await OneSignal.init({
          appId: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
          allowLocalhostAsSecureOrigin: true,
        });

        // Alias this device to the signed-in Supabase user so the backend
        // can target pushes via external_id without storing player IDs.
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          await OneSignal.login(user.id);
        }

        supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === "SIGNED_IN" && session?.user) {
            await OneSignal.login(session.user.id);
          }
          if (event === "SIGNED_OUT") {
            await OneSignal.logout();
          }
        });
      } catch (error) {
        // Suppress web push initialization errors gracefully during development
        console.warn(
          "OneSignal Web Push not fully configured in dashboard:",
          error,
        );
      }
    }
    initOneSignal();
  }, []);

  return null;
}
