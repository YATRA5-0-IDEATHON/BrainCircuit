import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const apiKey = request.headers.get("x-api-key");

    // 1. API Key Authentication Check
    if (apiKey !== process.env.EXTERNAL_API_KEY) {
      return NextResponse.json({ error: "Unauthorized access token." }, { status: 401 });
    }

    const patientCode = params.code;

    // 2. Fetch patient joined with their foundational core profile
    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select(`
        id,
        dob,
        gender,
        blood_group,
        allergies,
        chronic_conditions,
        qr_token,
        profiles (
          full_name,
          phone
        )
      `)
      .eq("qr_token", patientCode)
      .maybeSingle();

    if (patientError || !patient) {
      return NextResponse.json({ error: "Patient record registry footprint not found." }, { status: 404 });
    }

    // 3. Extract all historical prescriptions linked to this profile matrix
    const { data: prescriptions } = await supabase
      .from("prescriptions")
      .select(`
        id,
        diagnosis,
        hospital_name,
        doctor_name,
        prescription_date,
        prescription_items (
          drug_name,
          dosage,
          frequency,
          duration
        )
      `)
      .eq("patient_id", patient.id);

    // 4. Transform structural schema payload matching external diagnostic standards
    return NextResponse.json({
      success: true,
      patient_data: {
        patient_code: patient.qr_token,
        full_name: (patient.profiles as any)?.full_name || "Unknown Patient",
        dob: patient.dob,
        gender: patient.gender,
        blood_group: patient.blood_group,
        allergies: patient.allergies,
        chronic_conditions: patient.chronic_conditions,
        medical_history: prescriptions || []
      }
    }, { status: 200 });

  } catch (err: any) {
    return NextResponse.json({ error: "External fetch route processing failure.", details: err.message }, { status: 500 });
  }
}