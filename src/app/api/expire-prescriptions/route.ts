import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { isPrescriptionExpired } from "@/lib/prescriptionExpiry";

export async function GET(request: Request) {
  try {
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

    const { data: activePrescriptions, error } = await supabaseAdmin
      .from("prescriptions")
      .select("id, created_at, prescription_items(duration)")
      .eq("status", "active");

    if (error) throw error;

    const expiredIds = (activePrescriptions || [])
      .filter((p: any) =>
        isPrescriptionExpired(p.created_at, p.prescription_items || []),
      )
      .map((p: any) => p.id);

    if (expiredIds.length > 0) {
      const { error: updateErr } = await supabaseAdmin
        .from("prescriptions")
        .update({ status: "expired" })
        .in("id", expiredIds);

      if (updateErr) throw updateErr;
    }

    return NextResponse.json({
      ok: true,
      scanned: activePrescriptions?.length || 0,
      expired: expiredIds.length,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}