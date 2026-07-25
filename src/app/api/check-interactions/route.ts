import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(request: Request) {
  try {
    const { patient_id, new_drug_name } = await request.json();

    if (!patient_id || !new_drug_name) {
      return NextResponse.json(
        { error: "Missing patient_id or new_drug_name" },
        { status: 400 },
      );
    }

    // 1. Fetch all active prescription items for the patient
    const { data: activePrescriptions, error: prescError } = await supabaseAdmin
      .from("prescriptions")
      .select(
        `
        id,
        prescription_items (
          drug_name
        )
      `,
      )
      .eq("patient_id", patient_id)
      .eq("status", "active");

    if (prescError) throw prescError;

    // Flatten active drugs into a single array
    const activeDrugs: string[] = [];
    activePrescriptions?.forEach((p: any) => {
      p.prescription_items?.forEach((item: any) => {
        if (item.drug_name) activeDrugs.push(item.drug_name);
      });
    });

    if (activeDrugs.length === 0) {
      return NextResponse.json({ hasConflict: false, conflicts: [] });
    }

    // 2. Check drug interactions against database
    const conflicts = [];
    for (const activeDrug of activeDrugs) {
      const { data: interactionData, error: intError } = await supabaseAdmin
        .from("drug_interactions")
        .select("*")
        .or(
          `and(drug_a.ilike.${new_drug_name},drug_b.ilike.${activeDrug}),and(drug_a.ilike.${activeDrug},drug_b.ilike.${new_drug_name})`,
        );

      if (!intError && interactionData && interactionData.length > 0) {
        conflicts.push(...interactionData);
      }
    }

    const hasConflict = conflicts.length > 0;
    return NextResponse.json({
      hasConflict,
      conflicts,
      activeDrugsChecked: activeDrugs,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
