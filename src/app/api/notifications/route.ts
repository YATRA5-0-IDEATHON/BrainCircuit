import { NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { sendPushNotification } from "@/lib/onesignal";

/**
 * POST /api/notifications
 * Body: { type: "prescription_created", patient_id, drug_name }
 * Fired by the doctor's prescribe screen immediately after a prescription
 * is saved. Sends an instant push notification to the patient's device(s).
 * Requires an authenticated doctor/hospital session (checked via cookies).
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["doctor", "hospital_admin", "system_admin"].includes(profile.role)) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await request.json();
    const { type, patient_id } = body;

    if (!type || !patient_id) {
      return NextResponse.json(
        { error: "Missing type or patient_id" },
        { status: 400 },
      );
    }

    const supabaseAdmin = createAdminClient();

    const { data: patient, error: patientErr } = await supabaseAdmin
      .from("patients")
      .select("profile_id")
      .eq("id", patient_id)
      .single();

    if (patientErr || !patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    if (type === "prescription_created") {
      const { drug_name } = body;
      const result = await sendPushNotification({
        externalUserIds: [patient.profile_id],
        heading: "New Prescription Issued",
        message: drug_name
          ? `Your doctor has prescribed ${drug_name}. Open the app to review your updated medication list.`
          : "Your doctor has issued a new prescription. Open the app to review it.",
        url: "/patient/dashboard",
      });
      return NextResponse.json({ ok: true, result });
    }

    return NextResponse.json({ error: "Unknown notification type" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * GET /api/notifications
 * Intended to be hit by a scheduled job (e.g. Supabase Cron / Vercel Cron)
 * once a day. Scans active prescription_items whose free-text `duration`
 * field ("5 days", "2 weeks", etc.) indicates the course ends within the
 * next 24 hours, and sends a refill reminder push to each patient.
 */
export async function GET(request: Request) {
  try {
    // Optional: protect the cron endpoint with a shared secret.
    // Set CRON_SECRET in your env and pass it as ?secret=... or
    // an `Authorization: Bearer <secret>` header when scheduling this job.
    const configuredSecret = process.env.CRON_SECRET;
    if (configuredSecret) {
      const url = new URL(request.url);
      const provided =
        request.headers.get("authorization")?.replace("Bearer ", "") ||
        url.searchParams.get("secret");
      if (provided !== configuredSecret) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const supabaseAdmin = createAdminClient();

    const { data: items, error } = await supabaseAdmin
      .from("prescription_items")
      .select(
        `id, drug_name, duration, prescriptions!inner(id, status, created_at, patients!inner(profile_id))`,
      )
      .eq("prescriptions.status", "active");

    if (error) throw error;

    const now = Date.now();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const reminders: { externalId: string; drugName: string }[] = [];

    for (const item of items || []) {
      const days = parseDurationToDays(item.duration);
      if (days === null) continue;

      const createdAt = new Date(item.prescriptions.created_at).getTime();
      const endsAt = createdAt + days * oneDayMs;
      const remaining = endsAt - now;

      if (remaining > 0 && remaining <= oneDayMs) {
        reminders.push({
          externalId: item.prescriptions.patients.profile_id,
          drugName: item.drug_name,
        });
      }
    }

    const results = await Promise.all(
      reminders.map((r) =>
        sendPushNotification({
          externalUserIds: [r.externalId],
          heading: "Refill Reminder",
          message: `Your course of ${r.drugName} is ending soon. Contact your doctor if you need a refill.`,
          url: "/patient/dashboard",
        }),
      ),
    );

    return NextResponse.json({ ok: true, sent: reminders.length, results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

function parseDurationToDays(duration: string): number | null {
  if (!duration) return null;
  const match = duration.match(/(\d+)\s*(day|days|week|weeks|month|months)/i);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  if (unit.startsWith("day")) return value;
  if (unit.startsWith("week")) return value * 7;
  if (unit.startsWith("month")) return value * 30;
  return null;
}
