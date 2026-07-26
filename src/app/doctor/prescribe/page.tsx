"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import InteractionWarningModal from "@/components/InteractionWarningModal";
import { isPrescriptionExpired } from "@/lib/prescriptionExpiry";

interface DrugInteraction {
  id: string;
  drug_a: string;
  drug_b: string;
  severity: "high" | "moderate" | "low";
  warning_message: string;
}

const severityAlertStyles: Record<string, { container: string; badge: string }> = {
  high: {
    container: "bg-red-50 border-red-200 text-red-900 shadow-sm shadow-red-500/5 animate-pulse",
    badge: "bg-red-600 text-white",
  },
  moderate: {
    container: "bg-amber-50 border-amber-200 text-amber-900 shadow-sm",
    badge: "bg-amber-500 text-white",
  },
  low: {
    container: "bg-blue-50 border-blue-200 text-blue-900",
    badge: "bg-blue-600 text-white",
  },
};

function PrescribeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const patientId = searchParams.get("patient_id");
  const supabase = createClient();

  // Core UI States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isPatientFormOpen, setIsPatientFormOpen] = useState(false);
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

  // Prescription Form Field States
  const [diagnosis, setDiagnosis] = useState("");
  const [drugName, setDrugName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");

  // New Patient Form Field States
  const [newFullName, setNewFullName] = useState("");
  const [newDob, setNewDob] = useState("");
  const [newGender, setNewGender] = useState("Other");
  const [newBloodGroup, setNewBloodGroup] = useState("Unknown");
  const [newQrToken, setNewQrToken] = useState("");
  const [newAllergies, setNewAllergies] = useState("");

  // System Safety States
  const [existingConflicts, setExistingConflicts] = useState<DrugInteraction[]>([]);
  const [conflicts, setConflicts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  // Real-time Live Safety Evaluation Engine (Strict Lowercase Comparison)
  const evaluateExistingMedicationSafety = async (historyLedger: any[]) => {
    const activeMedNamesLower = new Set<string>();
    const querySearchVariants = new Set<string>();

    historyLedger.forEach((p) => {
      const normalizedStatus = (p.status || "").trim().toLowerCase();
      const isExpired = normalizedStatus === "active" && isPrescriptionExpired(p.created_at, p.prescription_items || []);
      const isCurrentlyTaking = normalizedStatus === "active" && !isExpired;

      if (isCurrentlyTaking && p.prescription_items) {
        p.prescription_items.forEach((item: any) => {
          if (item.drug_name) {
            const cleanName = item.drug_name.trim();
            activeMedNamesLower.add(cleanName.toLowerCase());
            querySearchVariants.add(cleanName.toLowerCase());
            querySearchVariants.add(cleanName.toUpperCase());
            querySearchVariants.add(cleanName);
          }
        });
      }
    });

    if (activeMedNamesLower.size < 2) {
      setExistingConflicts([]);
      return;
    }

    const searchVariantsArray = Array.from(querySearchVariants);
    const postgrestInString = `(${searchVariantsArray.map(v => `"${v.replace(/"/g, '\\"')}"`).join(',')})`;

    const { data: rulesData } = await supabase
      .from("drug_interactions")
      .select("*")
      .or(`drug_a.in.${postgrestInString},drug_b.in.${postgrestInString}`);

    if (rulesData) {
      const activeConflicts = (rulesData as DrugInteraction[]).filter((rule) => {
        const targetA = (rule.drug_a || "").trim().toLowerCase();
        const targetB = (rule.drug_b || "").trim().toLowerCase();
        return activeMedNamesLower.has(targetA) && activeMedNamesLower.has(targetB);
      });

      setExistingConflicts(activeConflicts);
    } else {
      setExistingConflicts([]);
    }
  };

  const fetchPrescriptionHistory = async (idList: string[]) => {
    if (!idList || idList.length === 0) return;
    try {
      const { data: history } = await supabase
        .from("prescriptions")
        .select(`
          id, diagnosis, status, prescription_date, doctor_name, hospital_name, created_at,
          prescription_items ( drug_name, dosage, frequency, duration )
        `)
        .in("patient_id", idList)
        .order("created_at", { ascending: false });

      if (history) {
        setPastPrescriptions(history);
        await evaluateExistingMedicationSafety(history);
      }
    } catch (err) {
      console.error("Error updating history ledger:", err);
    }
  };

  useEffect(() => {
    async function loadPatientData() {
      if (!patientId) {
        setDebugError("Missing identification parameters in the active query footprint string.");
        setPatientDetails(null);
        setPastPrescriptions([]);
        setLoadingHistory(false);
        return;
      }
      setLoadingHistory(true);
      setDebugError(null);
      
      try {
        let matchedPatientRow: any = null;
        let matchedName = "Unknown Patient Name";
        let alternativeIdLookup: string | null = null;

        const { data: patientByTableId } = await supabase
          .from("patients")
          .select("dob, blood_group, gender, allergies, profile_id, profiles(full_name)")
          .eq("id", patientId)
          .maybeSingle();

        if (patientByTableId) {
          matchedPatientRow = patientByTableId;
          matchedName = (patientByTableId.profiles as any)?.full_name || "Unknown Patient Name";
          alternativeIdLookup = patientByTableId.profile_id;
        } else {
          const { data: patientByProfileId } = await supabase
            .from("patients")
            .select("dob, blood_group, gender, allergies, profile_id, profiles(full_name)")
            .eq("profile_id", patientId)
            .maybeSingle();

          if (patientByProfileId) {
            matchedPatientRow = patientByProfileId;
            matchedName = (patientByProfileId.profiles as any)?.full_name || "Unknown Patient Name";
            alternativeIdLookup = patientByProfileId.profile_id;
          } else {
            const { data: standaloneProfile } = await supabase
              .from("profiles")
              .select("full_name")
              .eq("id", patientId)
              .maybeSingle();

            if (standaloneProfile) {
              matchedName = standaloneProfile.full_name || "Unknown Patient Name";
            } else {
              setDebugError(`No record exists inside the database matching the ID token: "${patientId}".`);
            }
          }
        }

        if (matchedPatientRow || alternativeIdLookup) {
          setPatientDetails({
            fullName: matchedName,
            dob: matchedPatientRow?.dob || "Not Provided",
            gender: matchedPatientRow?.gender || "Not Provided",
            bloodGroup: matchedPatientRow?.blood_group || "Unknown",
            allergies: matchedPatientRow?.allergies || [],
          });

          const idsToQuery = [patientId];
          if (alternativeIdLookup) idsToQuery.push(alternativeIdLookup);
          if (matchedPatientRow?.id) idsToQuery.push(matchedPatientRow.id);
          
          await fetchPrescriptionHistory(idsToQuery);
        } else {
          setPatientDetails(null);
          setPastPrescriptions([]);
        }
      } catch (err: any) {
        console.error("Unexpected parsing error encountered:", err);
        setDebugError(`Unexpected Error Context: ${err.message}`);
      } finally {
        setLoadingHistory(false);
      }
    }

    loadPatientData();
  }, [patientId, supabase]);

  // Handle Registering a Brand New Patient Node
  const handleCreatePatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName || !newQrToken) return;

    setLoading(true);
    try {
      // 1. Provision foundational user identity entry matrix row
      const { data: profileRow, error: profileErr } = await supabase
        .from("profiles")
        .insert({ full_name: newFullName, role: "patient" })
        .select()
        .single();

      if (profileErr || !profileRow) throw new Error(profileErr?.message || "Profile generation mapping failure.");

      const allergyArray = newAllergies ? newAllergies.split(",").map(item => item.trim()) : [];

      // 2. Link account row into the patient tracking layout structure configuration
      const { data: patientRow, error: patientErr } = await supabase
        .from("patients")
        .insert({
          profile_id: profileRow.id,
          qr_token: newQrToken.trim(),
          dob: newDob || new Date().toISOString().split("T")[0],
          gender: newGender,
          blood_group: newBloodGroup,
          allergies: allergyArray
        })
        .select()
        .single();

      if (patientErr || !patientRow) {
        // Simple manual cleaning rollback step
        await supabase.from("profiles").delete().eq("id", profileRow.id);
        throw new Error(patientErr?.message || "Patient container matrix verification failed.");
      }

      setSuccessMsg(`Patient profile registry created for ${newFullName}!`);
      
      // Clear Form Fields
      setNewFullName("");
      setNewDob("");
      setNewGender("Other");
      setNewBloodGroup("Unknown");
      setNewQrToken("");
      setNewAllergies("");
      setIsPatientFormOpen(false);

      // Instantly load the brand new profile into UI by shifting the current router query view
      router.push(`?patient_id=${patientRow.id}`);
      
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err: any) {
      console.error(err);
      alert(`Provision Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

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
          new_drug_name: drugName.trim().toLowerCase(),
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
        .select("id, hospital_id, profiles(full_name), hospitals(name)")
        .eq("profile_id", user.id)
        .single();

      if (staffErr || !staff) {
        console.error("Failed doctor context verification validation.");
        return;
      }

      const currentDoctorName = (staff.profiles as any)?.full_name || "Unknown Practitioner";
      const currentHospitalName = (staff.hospitals as any)?.name || "Unknown Medical Center";
      
      const fullDiagnosis = overrideNote ? `${diagnosis} [Guardian override: ${overrideNote}]` : diagnosis;

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
        drug_name: drugName.trim(),
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
          drug_name: drugName.trim(),
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

      const dynamicIds = patientId ? [patientId] : [];
      if (dynamicIds.length > 0) await fetchPrescriptionHistory(dynamicIds);
      
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const hasHighRiskExistingConflict = existingConflicts.some(c => (c.severity || "").toLowerCase() === "high");
  const sideFormActive = isFormOpen || isPatientFormOpen;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 max-w-6xl mx-auto space-y-5">
      
      {/* Dynamic Warning Alert Interface */}
      {debugError && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800 font-sans shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <strong className="block text-sm font-bold mb-1">⚠️ System Index Resolution Alert:</strong>
            {debugError}
          </div>
          {!patientDetails && (
            <button
              onClick={() => { setIsPatientFormOpen(true); setIsFormOpen(false); }}
              className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] whitespace-nowrap transition shadow-xs"
            >
              Provision This Record Location Now
            </button>
          )}
        </div>
      )}

      {/* Cross-Reference Conflict HUD */}
      {existingConflicts.length > 0 && (
        <div className={`rounded-2xl border p-5 space-y-3 transition-all ${hasHighRiskExistingConflict ? "bg-red-50 border-red-200 shadow-sm shadow-red-500/5 animate-pulse" : "bg-amber-50 border-amber-200"}`}>
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-white text-xs font-bold">!</span>
            <h2 className="text-sm font-black tracking-tight text-slate-900">
              Active Medical Conflict Alert ({existingConflicts.length} Interaction Rules Triggered)
            </h2>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed font-medium">
            Attention: This patient is currently prescribed conflicting medications within their active files. Review these interactions before making modifications:
          </p>
          <div className="space-y-2 pt-1">
            {existingConflicts.map((conflict) => {
              const normalizedSeverity = (conflict.severity || "").toLowerCase();
              const style = severityAlertStyles[normalizedSeverity] || severityAlertStyles.low;
              return (
                <div key={conflict.id} className="rounded-xl border p-3 text-xs leading-relaxed flex flex-col sm:flex-row sm:items-start gap-2.5 bg-white shadow-xs">
                  <span className={`inline-flex items-center rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider shrink-0 self-start mt-0.5 ${style.badge}`}>
                    {normalizedSeverity} Risk
                  </span>
                  <div>
                    <span className="font-bold text-slate-800 block mb-0.5">
                      {conflict.drug_a} ⟷ {conflict.drug_b} Conflict Definition
                    </span>
                    <p className="text-slate-600 font-medium">{conflict.warning_message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Control Action Toolbar */}
      <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex-1">
          <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full uppercase tracking-wider">
            Active Patient File
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            {patientDetails ? patientDetails.fullName : "Awaiting Registry Context..."}
          </h1>
          
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

        <div className="flex flex-wrap items-center gap-2 self-start md:self-center">
          <button
            onClick={() => router.push("/doctor/scan")}
            className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition shadow-sm whitespace-nowrap"
          >
            ← Scan Another Patient
          </button>
          
          {/* <button
            onClick={() => { setIsPatientFormOpen(!isPatientFormOpen); setIsFormOpen(false); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm whitespace-nowrap ${isPatientFormOpen ? "bg-amber-100 text-amber-800 hover:bg-amber-200" : "bg-amber-600 text-white hover:bg-amber-700"}`}
          >
            {isPatientFormOpen ? "Hide Registry Panel" : "＋ Register New Patient"}
          </button> */}

          {patientDetails && (
            <button
              onClick={() => { setIsFormOpen(!isFormOpen); setIsPatientFormOpen(false); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition shadow-sm whitespace-nowrap ${isFormOpen ? "bg-gray-100 text-gray-700 hover:bg-gray-200" : "bg-blue-600 text-white hover:bg-blue-700"}`}
            >
              {isFormOpen ? "Hide Entry Form" : "＋ Add Prescription"}
            </button>
          )}
        </div>
      </div>

      {successMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm text-emerald-800 shadow-sm font-medium animate-fade-in">
          ✨ {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Prescription History Display Layout Panel */}
        <div className={`bg-white p-6 rounded-2xl border border-gray-100 shadow-sm ${sideFormActive ? "lg:col-span-2" : "lg:col-span-3"}`}>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Prescription History Ledger</h2>
          
          {loadingHistory ? (
            <p className="text-sm text-gray-400">Loading tracking lists...</p>
          ) : pastPrescriptions.length === 0 ? (
            <p className="text-sm text-gray-500 italic py-4">No historical records found for this user context matrix.</p>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-1">
              {pastPrescriptions.map((presc) => {
                const normalizedStatus = (presc.status || "").trim().toLowerCase();
                const liveExpired = normalizedStatus === "active" && isPrescriptionExpired(presc.created_at, presc.prescription_items || []);
                const displayStatus = liveExpired ? "expired" : normalizedStatus;

                return (
                  <div key={presc.id} className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-gray-50 transition space-y-2">
                    <div className="flex justify-between items-start text-xs text-gray-500">
                      <div>
                        <span className="font-semibold text-gray-700">Date:</span> {presc.prescription_date || new Date(presc.created_at).toLocaleDateString()}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full font-bold uppercase text-[9px] border tracking-wider ${
                        displayStatus === "active" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                        displayStatus === "expired" ? "bg-orange-50 text-orange-700 border-orange-200" :
                        "bg-gray-200 text-gray-700 border-gray-300"
                      }`}>
                        {displayStatus}
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
                );
              })}
            </div>
          )}
        </div>

       

        {/* Form Container 2: New Medication Append Form */}
        {isFormOpen && patientDetails && (
          <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm h-fit space-y-4 animate-fade-in">
            <h2 className="text-lg font-bold text-gray-900">New Prescription</h2>
            <form onSubmit={handlePrescribeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700">Diagnosis</label>
                <input
                  type="text" required
                  className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                  value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)}
                  placeholder="e.g., Hypertension"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700">Drug Name</label>
                <input
                  type="text" required
                  className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                  value={drugName} onChange={(e) => setDrugName(e.target.value)}
                  placeholder="e.g., Warfarin"
                />
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700">Dosage</label>
                  <input
                    type="text" required placeholder="500mg"
                    className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                    value={dosage} onChange={(e) => setDosage(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Frequency</label>
                  <input
                    type="text" required placeholder="Twice a day"
                    className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                    value={frequency} onChange={(e) => setFrequency(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">Duration</label>
                  <input
                    type="text" required placeholder="5 days"
                    className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
                    value={duration} onChange={(e) => setDuration(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="submit" disabled={loading}
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
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-50 text-gray-500 text-sm font-medium">Loading clinical module...</div>}>
      <PrescribeContent />
    </Suspense>
  );
}