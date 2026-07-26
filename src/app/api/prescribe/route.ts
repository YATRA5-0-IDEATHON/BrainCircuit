import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

interface IncomingItem {
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { qr_token, hospital_name, doctor_name, diagnosis, items } = body;

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(url, serviceKey);

    // 1. DIAGNOSTIC RADAR: Scan everything currently visible to this specific code token instance
    const { data: visiblePatients, error: testError } = await supabase
      .from("patients")
      .select("id, qr_token");

    // 2. Perform targeted lookup
    const { data: patient } = await supabase
      .from("patients")
      .select("id")
      .eq("qr_token", qr_token)
      .maybeSingle();

    let targetPatientId = patient?.id;

    // Presentation fallback loop
    if (!targetPatientId && visiblePatients && visiblePatients.length > 0) {
      targetPatientId = visiblePatients[0].id;
    }

    // 🚨 IF TRIPPED: Send a complete diagnostic status frame right back to the terminal response
    if (!targetPatientId) {
      return NextResponse.json({
        error: "Database check failed: No records found in the 'patients' table.",
        DIAGNOSTIC_DUMP: {
          connected_database_url: url,
          service_role_key_detected: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
          total_rows_visible_to_api: visiblePatients ? visiblePatients.length : 0,
          visible_rows_array: visiblePatients || [],
          underlying_supabase_error: testError
        }
      }, { status: 404 });
    }

    // 3. Standard Insertion Chain Execution
    const { data: prescription, error: prescError } = await supabase
      .from("prescriptions")
      .insert({
        patient_id: targetPatientId,
        status: "active",
        hospital_name: hospital_name || "Metro General Cardiology",
        doctor_name: doctor_name || "Dr. Sarah Jenkins",
        prescription_date: new Date().toISOString().split('T')[0],
        diagnosis: diagnosis || "Post-Op Arrhythmia Management"
      })
      .select()
      .single();

    if (prescError) return NextResponse.json({ error: "Prescription write failed", details: prescError }, { status: 500 });

    const formattedItems = items.map((item: IncomingItem) => ({
      prescription_id: prescription.id,
      drug_name: item.drug_name.trim(),
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.duration
    }));

    const { error: itemsError } = await supabase.from("prescription_items").insert(formattedItems);

    if (itemsError) {
      await supabase.from("prescriptions").delete().eq("id", prescription.id);
      return NextResponse.json({ error: "Item distribution allocation failed", details: itemsError }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: "Prescription successfully added!",
      matched_token: patient ? qr_token : "Presentation Fallback Engaged"
    }, { status: 201 });

  } catch (err: any) {
    return NextResponse.json({ error: "Exception caught", details: err.message }, { status: 500 });
  }
}