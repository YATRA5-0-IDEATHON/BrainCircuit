import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const apiKey = request.headers.get("x-api-key");
    if (apiKey !== process.env.EXTERNAL_API_KEY) {
      return NextResponse.json({ error: "Unauthorized access token." }, { status: 401 });
    }

    const body = await request.json();
    const { 
      patient_code, 
      allergies, 
      full_name, 
      dob, 
      gender, 
      blood_group, 
      hospital_code, 
      visit, 
      prescriptions 
    } = body;

    if (!patient_code) {
      return NextResponse.json({ error: "Missing identifying patient operational code." }, { status: 400 });
    }

    let targetPatientId = null;

    // 1. Check if patient record profile footprint exists inside database
    const { data: existingPatient } = await supabase
      .from("patients")
      .select("id")
      .eq("qr_token", patient_code)
      .maybeSingle();

    if (existingPatient) {
      targetPatientId = existingPatient.id;

      // Update existing allergies parameter if payload explicitly passes it
      if (allergies) {
        // Formatted into an array matrix to align clean with Supabase _text typing
        const allergyArray = typeof allergies === "string" ? allergies.split(",").map(s => s.trim()) : allergies;
        await supabase.from("patients").update({ allergies: allergyArray }).eq("id", targetPatientId);
      }
    } else {
      // 2. Provision Brand New Patient (Triggered by Priya's pipeline simulation payload)
      if (!full_name) {
        return NextResponse.json({ error: "New registration detected but profile full name parameter is missing." }, { status: 400 });
      }

      // Insert baseline user profile structure matrix row
      const { data: newProfile, error: profErr } = await supabase
        .from("profiles")
        .insert({ full_name: full_name, role: "patient" })
        .select()
        .single();

      if (profErr || !newProfile) return NextResponse.json({ error: "Profile generation exception.", details: profErr }, { status: 500 });

      const allergyArray = allergies ? allergies.split(",").map((s: string) => s.trim()) : [];

      // Create main patient container row linked to token mapping configuration structure
      const { data: newPatient, error: patErr } = await supabase
        .from("patients")
        .insert({
          profile_id: newProfile.id,
          qr_token: patient_code,
          dob: dob || new Date().toISOString().split('T')[0],
          gender: gender || "Other",
          blood_group: blood_group,
          allergies: allergyArray
        })
        .select()
        .single();

      if (patErr || !newPatient) {
        await supabase.from("profiles").delete().eq("id", newProfile.id); // Rollback step
        return NextResponse.json({ error: "Patient table generation exception.", details: patErr }, { status: 500 });
      }

      targetPatientId = newPatient.id;
    }

    // 3. Insert Prescription Structural Ledger Header Record
    if (visit || prescriptions) {
      const prescribedBy = prescriptions?.[0]?.prescribed_by || "External Network Provider";
      
      const { data: newPresc, error: prescErr } = await supabase
        .from("prescriptions")
        .insert({
          patient_id: targetPatientId,
          diagnosis: visit?.diagnosis || "System Check Review Profile",
          hospital_name: hospital_code || "External Node Network",
          doctor_name: prescribedBy,
          prescription_date: new Date().toISOString().split('T')[0],
          status: "active"
        })
        .select()
        .single();

      if (prescErr || !newPresc) return NextResponse.json({ error: "Failed to generate ledger header row.", details: prescErr }, { status: 500 });

      // 4. Map and mass insert child medication items array block loops into the sub-ledger
      if (prescriptions && Array.isArray(prescriptions)) {
        const itemsToInsert = prescriptions.map((p: any) => ({
          prescription_id: newPresc.id,
          drug_name: p.drug_name,
          dosage: p.dosage || "As Directed",
          frequency: p.frequency || "1x Daily",
          duration: "14 Days" // Fallback data layout assertion parameter for schema safety 
        }));

        const { error: itemsErr } = await supabase.from("prescription_items").insert(itemsToInsert);
        if (itemsErr) return NextResponse.json({ error: "Medication item data map failure.", details: itemsErr }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: existingPatient ? "Patient ledger record successfully updated." : "Brand new patient ledger account created.",
      patient_id: targetPatientId
    }, { status: 201 });

  } catch (err: any) {
    return NextResponse.json({ error: "Critical transaction loop engine processing failure.", details: err.message }, { status: 500 });
  }
}   