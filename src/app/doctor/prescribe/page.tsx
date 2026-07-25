"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import InteractionWarningModal from "@/components/InteractionWarningModal";

function PrescribeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const patientId = searchParams.get("patient_id");
  const supabase = createClient();

  // Core UI States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pastPrescriptions, setPastPrescriptions] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [debugError, setDebugError] = useState<string | null>(null);

  // Exact Match Patient Info State
  const [patientDetails, setPatientDetails] = useState<{
    fullName: string;
    dob: string;
    gender: string;
    bloodGroup: string;
    allergies: string[];
  } | null>(null);

  // Form Field States
  const [diagnosis, setDiagnosis] = useState("");
  const [drugName, setDrugName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");

  // System States
  const [conflicts, setConflicts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Reusable function to fetch prescription ledger history updates using all possible ID permutations
  const fetchPrescriptionHistory = async (idList: string[]) => {
    if (!idList || idList.length === 0) return;
    try {
      const { data: history } = await supabase
        .from("prescriptions")
        .select(`
          id,
          diagnosis,
          status,
          prescription_date,
          doctor_name,
          hospital_name,
          created_at,
          prescription_items (
            drug_name,
            dosage,
            frequency,
            duration
          )
        `)
        .in("patient_id", idList)
        .order("created_at", { ascending: false });

      if (history) setPastPrescriptions(history);
    } catch (err) {
      console.error("Error updating history ledger:", err);
    }
  };

  // Smart Multi-Lookup Loader Engine
  useEffect(() => {
    async function loadPatientData() {
      if (!patientId) {
        setDebugError("Missing 'patient_id' parameter in the URL query string.");
        setLoadingHistory(false);
        return;
      }
      setLoadingHistory(true);
      setDebugError(null);
      
      try {
        let matchedPatientRow: any = null;
        let matchedName = "Unknown Patient Name";
        let alternativeIdLookup: string | null = null;

        // Step 1: Treat the URL string as the primary key of the 'patients' table
        const { data: patientByTableId } = await supabase
          .from("patients")
          .select(`
            dob, blood_group, gender, allergies, profile_id,
            profiles ( full_name )
          `)
          .eq("id", patientId)
          .maybeSingle(); // Safe extraction method (returns null on 0 rows instead of PGRST116)

        if (patientByTableId) {
          matchedPatientRow = patientByTableId;
          matchedName = (patientByTableId.profiles as any)?.full_name || "Unknown Patient Name";
          alternativeIdLookup = patientByTableId.profile_id;
        } else {
          // Step 2: Fallback - Treat the URL string as the user's account identity ID (profile_id)
          const { data: patientByProfileId } = await supabase
            .from("patients")
            .select(`
              dob, blood_group, gender, allergies, profile_id,
              profiles ( full_name )
            `)
            .eq("profile_id", patientId)
            .maybeSingle();

          if (patientByProfileId) {
            matchedPatientRow = patientByProfileId;
            matchedName = (patientByProfileId.profiles as any)?.full_name || "Unknown Patient Name";
            alternativeIdLookup = patientByProfileId.profile_id;
          } else {
            // Step 3: Absolute Fallback - Check if profile exists but completely lacks medical history table entry
            const { data: standaloneProfile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", patientId)
              .maybeSingle();

            if (standaloneProfile) {
              matchedName = standaloneProfile.full_name || "Unknown Patient Name";
            } else {
              setDebugError(`No record exists inside the database matching the ID token: "${patientId}". Verify that this user is correctly registered.`);
            }
          }
        }

        // Apply fallback string elements if specific profiles are incomplete
        setPatientDetails({
          fullName: matchedName,
          dob: matchedPatientRow?.dob || "Not Provided",
          gender: matchedPatientRow?.gender || "Not Provided",
          bloodGroup: matchedPatientRow?.blood_group || "Unknown",
          allergies: matchedPatientRow?.allergies || [],
        });

        // Query historical entries against both potential identifying UUID tokens
        const idsToQuery = [patientId];
        if (alternativeIdLookup) idsToQuery.push(alternativeIdLookup);
        
        await fetchPrescriptionHistory(idsToQuery);
      } catch (err: any) {
        console.error("Unexpected parsing error encountered:", err);
        setDebugError(`Unexpected Error Context: ${err.message}`);
      } finally {
        setLoadingHistory(false);
      }
    }

    loadPatientData();
  }, [patientId, supabase]);

  const handlePrescribeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !drugName) return;

    setLoading(true);

    try {
      const res = await fetch("/api/check-interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patient_id: patientId,
          new_drug_name: drugName,
        }),
      });
      const data = await res.json();

      if (data.hasConflict && data.conflicts.length > 0) {
        setConflicts(data.conflicts);
        setShowModal(true);
        setLoading(false);
        return;
      }

      await savePrescription();
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const savePrescription = async (overrideNote?: string) => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: staff, error: staffErr } = await supabase
        .from("hospital_staff")
        .select(`
          id,
          hospital_id,
          profiles ( full_name ),
          hospitals ( name )
        `)
        .eq("profile_id", user.id)
        .single();

      if (staffErr || !staff) {
        console.error("Failed doctor context verification validation.");
        return;
      }

      const currentDoctorName = (staff.profiles as any)?.full_name || "Unknown Practitioner";
      const currentHospitalName = (staff.hospitals as any)?.name || "Unknown Medical Center";
      
      const fullDiagnosis = overrideNote
        ? `${diagnosis} [Guardian override: ${overrideNote}]`
        : diagnosis;

      const { data: presc, error: prescErr } = await supabase
        .from("prescriptions")
        .insert({
          patient_id: patientId,
          doctor_id: staff.id,
          hospital_id: staff.hospital_id,
          doctor_name: currentDoctorName,
          hospital_name: currentHospitalName,
          prescription_date: new Date().toISOString().split("T")[0],
          diagnosis: fullDiagnosis,
          status: "active",
        })
        .select()
        .single();

      if (prescErr) throw prescErr;

      await supabase.from("prescription_items").insert({
        prescription_id: presc.id,
        drug_name: drugName,
        dosage,
        frequency,
        duration,
      });

      await supabase.from("audit_logs").insert({
        accessor_id: user.id,
        patient_id: patientId,
        action_type: "PRESCRIPTION_CREATE",
      });

      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "prescription_created",
          patient_id: patientId,
          drug_name: drugName,
        }),
      }).catch(() => {});

      setSuccessMsg("Prescription successfully appended to record log.");
      setDiagnosis("");
      setDrugName("");
      setDosage("");
      setFrequency("");
      setDuration("");
      setIsFormOpen(false);
      setLoading(false);

      // Re-fetch using current parameters to force updates without hard reloads
      const dynamicIds = patientId ? [patientId] : [];
      if (patientDetails?.fullName && patientId) dynamicIds.push(patientId);
      if (dynamicIds.length > 0) await fetchPrescriptionHistory(dynamicIds);
      
      setTimeout(() => setSuccessMsg(""), 4000);

    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      
      {/* Real-time Safe Diagnostic Informational Warning Panel */}
      {debugError && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800 font-sans shadow-sm">
          <strong className="block text-sm font-bold mb-1">⚠️ System Reference Warning:</strong>
          {debugError}
        </div>
      )}
      
      {/* Dynamic Header Metrics Dashboard View */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
            Active Patient File
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            {patientDetails ? patientDetails.fullName : "Loading profile charts..."}
          </h1>
          
          {/* Detailed Schema Information Matrix */}
          {patientDetails && (
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs text-gray-600 bg-gray-50/60 p-3 rounded-xl border border-gray-100">
              <div><span className="text-gray-400 font-medium">Date of Birth:</span> <span className="text-gray-900 font-medium">{patientDetails.dob}</span></div>
              <div><span className="text-gray-400 font-medium">Gender:</span> <span className="text-gray-900 font-medium">{patientDetails.gender}</span></div>
              <div><span className="text-gray-400 font-medium">Blood Group:</span> <strong className="text-red-600 font-semibold">{patientDetails.bloodGroup}</strong></div>
              <div>
                <span className="text-gray-400 font-medium">Allergies:</span>{" "}
                <span className={patientDetails.allergies.length > 0 ? "text-amber-700 font-semibold" : "text-gray-500"}>
                  {patientDetails.allergies.length > 0 ? patientDetails.allergies.join(", ") : "None Logged"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Persistent Route Controls */}
        <div className="flex items-center gap-2 self-start md:self-center">
          <button
            onClick={() => router.push("/doctor/scan")}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition shadow-sm whitespace-nowrap"
          >
            ← Another Patient
          </button>
          
          <button
            onClick={() => setIsFormOpen(!isFormOpen)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm whitespace-nowrap ${
              isFormOpen 
                ? "bg-gray-100 text-gray-700 hover:bg-gray-200" 
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            {isFormOpen ? "Hide Entry Form" : "＋ Add Prescription"}
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 shadow-sm font-medium">
          ✨ {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Past Prescriptions History Panel */}
        <div className={`bg-white p-6 rounded-2xl border border-gray-100 shadow-sm ${isFormOpen ? "lg:col-span-2" : "lg:col-span-3"}`}>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Prescription History Ledger</h2>
          
          {loadingHistory ? (
            <p className="text-sm text-gray-400">Loading tracking lists...</p>
          ) : pastPrescriptions.length === 0 ? (
            <p className="text-sm text-gray-500 italic py-4">No historical records found for this user.</p>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {pastPrescriptions.map((presc) => (
                <div key={presc.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition space-y-2">
                  <div className="flex justify-between items-start text-xs text-gray-500">
                    <div>
                      <span className="font-semibold text-gray-700">Date:</span> {presc.prescription_date || new Date(presc.created_at).toLocaleDateString()}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full font-medium capitalize text-[10px] ${
                      presc.status === "active" ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"
                    }`}>
                      {presc.status}
                    </span>
                  </div>

                  <div className="text-sm">
                    <span className="font-medium text-gray-700">Diagnosis:</span> {presc.diagnosis}
                  </div>

                  {presc.prescription_items && presc.prescription_items.map((item: any, idx: number) => (
                    <div key={idx} className="bg-white p-2.5 rounded-lg border border-gray-200/60 text-xs mt-1 grid grid-cols-2 gap-1 md:grid-cols-4">
                      <div><span className="text-gray-400 font-medium">Drug:</span> <strong className="text-gray-800">{item.drug_name}</strong></div>
                      <div><span className="text-gray-400 font-medium">Dosage:</span> {item.dosage}</div>
                      <div><span className="text-gray-400 font-medium">Freq:</span> {item.frequency}</div>
                      <div><span className="text-gray-400 font-medium">Duration:</span> {item.duration}</div>
                    </div>
                  ))}

                  <div className="pt-1 flex gap-4 text-[11px] text-gray-400 italic border-t border-gray-100 mt-2">
                    <div><span className="font-medium">Physician:</span> {presc.doctor_name || "Not Logged"}</div>
                    <div><span className="font-medium">Facility:</span> {presc.hospital_name || "Not Logged"}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contextual Medical Insertion Form */}
        {isFormOpen && (
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-fit space-y-4">
            <h2 className="text-lg font-bold text-gray-900">New Prescription</h2>
            
            <form onSubmit={handlePrescribeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">Diagnosis</label>
                <input
                  type="text"
                  required
                  className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                  value={diagnosis}
                  onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="e.g., Hypertension"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">Drug Name</label>
                <input
                  type="text"
                  required
                  className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                  value={drugName}
                  onChange={(e) => setDrugName(e.target.value)}
                  placeholder="e.g., Warfarin"
                />
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700">Dosage</label>
                  <input
                    type="text"
                    required
                    placeholder="500mg"
                    className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm"
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Frequency</label>
                  <input
                    type="text"
                    required
                    placeholder="Twice a day"
                    className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm"
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Duration</label>
                  <input
                    type="text"
                    required
                    placeholder="5 days"
                    className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition disabled:opacity-50 shadow-sm"
              >
                {loading ? "Checking Security Parameters..." : "Verify & Save"}
              </button>
            </form>
          </div>
        )}
      </div>

      <InteractionWarningModal
        isOpen={showModal}
        conflicts={conflicts}
        onCancel={() => setShowModal(false)}
        onOverride={async (justification: string) => {
          setShowModal(false);
          await savePrescription(justification);
        }}
      />
    </div>
  );
}

export default function DoctorPrescribePage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center">Loading module...</div>}>
      <PrescribeContent />
    </Suspense>
  );
}