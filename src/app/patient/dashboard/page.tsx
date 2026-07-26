"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import LogoutButton from "@/components/LogoutButton";
import { isPrescriptionExpired } from "@/lib/prescriptionExpiry";

interface PrescriptionItem {
  id: string;
  drug_name: string;
  dosage: string;
  frequency: string;
  duration: string;
}

interface Prescription {
  id: string;
  status: string;
  created_at: string;
  hospital_name?: string;
  doctor_name?: string;
  prescription_date?: string;
  diagnosis?: string;
  hospitals?: { name: string };
  prescription_items: PrescriptionItem[];
}

interface DrugInteraction {
  id: string;
  drug_a: string;
  drug_b: string;
  severity: "high" | "moderate" | "low";
  warning_message: string;
}

const severityAlertStyles: Record<string, { container: string; text: string; badge: string; icon: string }> = {
  high: {
    container: "bg-red-50 border-red-200 text-red-900 shadow-sm shadow-red-500/5 animate-pulse",
    text: "text-red-700",
    badge: "bg-red-600 text-white",
    icon: "🚨 Critical Danger:",
  },
  moderate: {
    container: "bg-amber-50 border-amber-200 text-amber-900 shadow-sm",
    text: "text-amber-700",
    badge: "bg-amber-500 text-white",
    icon: "⚠️ Clinical Warning:",
  },
  low: {
    container: "bg-blue-50 border-blue-200 text-blue-900",
    text: "text-blue-700",
    badge: "bg-blue-600 text-white",
    icon: "ℹ️ Advisory Note:",
  },
};

export default function PatientDashboard() {
  const supabase = createClient();
  const [patient, setPatient] = useState<any>(null);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [detectedConflicts, setDetectedConflicts] = useState<DrugInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchPatientData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch fundamental patient structure record
        const { data: patientData } = await supabase
          .from("patients")
          .select("*, profiles(full_name, email)")
          .eq("profile_id", user.id)
          .single();

        if (patientData) {
          setPatient(patientData);

          // Fetch complete current medical history ledger entries
          const { data: prescData } = await supabase
            .from("prescriptions")
            .select("*, prescription_items(*), hospitals(name)")
            .eq("patient_id", patientData.id)
            .order("created_at", { ascending: false });

          if (prescData) {
            const mappedPrescriptions = prescData as Prescription[];
            setPrescriptions(mappedPrescriptions);

            // Execute Real-Time Live Drug Interaction Conflict Checks
            await evaluateMedicationSafety(mappedPrescriptions);
          }
        }
      } catch (err) {
        console.error("Critical dashboard state initialization failure:", err);
      } finally {
        setLoading(false);
      }
    }

    async function evaluateMedicationSafety(currentPrescriptions: Prescription[]) {
      const activeMedNamesLower = new Set<string>();
      const querySearchVariants = new Set<string>();

      currentPrescriptions.forEach((p) => {
        const normalizedStatus = (p.status || "").trim().toLowerCase();
        const isExpired = normalizedStatus === "active" && isPrescriptionExpired(p.created_at, p.prescription_items || []);
        const isCurrentlyTaking = normalizedStatus === "active" && !isExpired;

        if (isCurrentlyTaking && p.prescription_items) {
          p.prescription_items.forEach((item) => {
            if (item.drug_name) {
              const cleanName = item.drug_name.trim();
              
              // Standardize fallback index down to strict lowercase bounds
              activeMedNamesLower.add(cleanName.toLowerCase());
              
              // Map out full text variant variations to catch any DB formatting issues safely
              querySearchVariants.add(cleanName.toLowerCase());
              querySearchVariants.add(cleanName.toUpperCase());
              querySearchVariants.add(cleanName);
            }
          });
        }
      });

      if (activeMedNamesLower.size < 2) {
        setDetectedConflicts([]); // Clear conflicts if conditions aren't met
        return; 
      }

      // Format safely for dynamic parameter conversion mapping across complex symbols
      const searchVariantsArray = Array.from(querySearchVariants);
      const postgrestInString = `(${searchVariantsArray.map(v => `"${v.replace(/"/g, '\\"')}"`).join(',')})`;

      // Multi-column safety checking: Scan table arrays dynamically
      const { data: rulesData, error } = await supabase
        .from("drug_interactions")
        .select("*")
        .or(`drug_a.in.${postgrestInString},drug_b.in.${postgrestInString}`);

      if (error) {
        console.error("Safety ledger verification query fault:", error);
        return;
      }

      if (rulesData) {
        // Bi-directional evaluation entirely reduced down to uniform lowercase structures
        const activeConflicts = (rulesData as DrugInteraction[]).filter((rule) => {
          const ruleDrugA = (rule.drug_a || "").trim().toLowerCase();
          const ruleDrugB = (rule.drug_b || "").trim().toLowerCase();
          
          return activeMedNamesLower.has(ruleDrugA) && activeMedNamesLower.has(ruleDrugB);
        });

        setDetectedConflicts(activeConflicts);
      }
    }

    fetchPatientData();
  }, [supabase]);

  const handleCopyId = () => {
    if (!patient?.qr_token) return;
    navigator.clipboard.writeText(patient.qr_token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center font-medium bg-slate-50 text-slate-600">
        <div className="flex flex-col items-center gap-3">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400 font-mono">Loading Dynamic Health Ledger...</span>
        </div>
      </div>
    );
  }
    
  if (!patient) {
    return (
      <div className="flex h-screen items-center justify-center text-xs font-bold uppercase tracking-wider text-red-700 bg-red-50/50 p-4 text-center">
        ⚠️ Profile credentials could not be resolved against data registry.
      </div>
    );
  }

  // Check if any critical/high interactions exist across active profile records
  const hasHighRiskConflict = detectedConflicts.some(c => (c.severity || "").toLowerCase() === "high");

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-5">
        
        {/* ================= PROMINENT LIVE INTERACTION ALERT MODULE ================= */}
        {detectedConflicts.length > 0 && (
          <div className={`rounded-2xl border p-5 space-y-3 transition-all ${hasHighRiskConflict ? "bg-red-50 border-red-200 shadow-md shadow-red-500/5 animate-in fade-in slide-in-from-top-4 duration-300" : "bg-amber-50 border-amber-200"}`}>
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white text-xs font-bold animate-pulse">!</span>
              <h2 className="text-sm font-black tracking-tight text-slate-900">
                Automated Clinical Conflict Warning ({detectedConflicts.length})
              </h2>
            </div>
            
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              The platform has cross-referenced your concurrent active prescriptions. The following compound interactions require immediate configuration review by your provider:
            </p>

            <div className="space-y-2.5 pt-1">
              {detectedConflicts.map((conflict) => {
                const normalizedSeverity = (conflict.severity || "").toLowerCase();
                const style = severityAlertStyles[normalizedSeverity] || severityAlertStyles.low;
                return (
                  <div key={conflict.id} className="rounded-xl border p-3 text-xs leading-relaxed flex flex-col sm:flex-row sm:items-start gap-2.5 transition-colors bg-white shadow-xs">
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
            
            {hasHighRiskConflict && (
              <p className="text-[11px] font-bold text-red-700 bg-red-100/60 p-2.5 rounded-lg border border-red-200/40">
                🛑 High Risk Conflict Detected: Please contact your prescribing physician or pharmacy center immediately before self-administering these medications concurrently.
              </p>
            )}
          </div>
        )}

        {/* Header Profile Section */}
        <div className="rounded-2xl bg-white p-5 shadow-xs border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 text-center md:text-left flex-1 w-full">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
              <span className="rounded-full bg-blue-50 border border-blue-100 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-blue-700">
                Health Sanjal Patient Portal
              </span>
              <LogoutButton />
            </div>
            
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {patient.profiles?.full_name || "Patient Profile"}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">{patient.profiles?.email}</p>
            </div>

            <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-0.5">
              <span className="rounded-lg bg-red-50 border border-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                🩸 Blood Type: {patient.blood_group || "N/A"}
              </span>
              <span className="rounded-lg bg-slate-50 border border-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                📅 Date of Birth: {patient.dob || "Not Documented"}
              </span>
              <span className="rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 capitalize">
                🧬 Gender: {patient.gender || "Not Documented"}
              </span>
            </div>
          </div>

          {/* Interactive QR Identifier Component Card */}
          <div className="rounded-2xl bg-white p-4 shadow-xs border border-slate-100 flex flex-col items-center w-full max-w-[180px] text-center bg-gradient-to-b from-white to-slate-50/50 shrink-0">
            <QRCodeSVG value={patient.qr_token || "invalid-token"} size={120} level="H" className="bg-white p-1 rounded-lg" />
            
            <div className="mt-3 w-full">
              <span className="block text-[9px] uppercase font-bold tracking-wider text-slate-400">
                Secure Registry Token
              </span>
              
              <button 
                onClick={handleCopyId}
                className="mt-1 w-full bg-white hover:bg-slate-50 text-slate-700 font-mono text-[11px] py-1 px-1.5 rounded-xl border border-slate-200 truncate transition active:scale-95 flex items-center justify-center gap-1 group"
                title="Copy token string"
              >
                <span className="truncate flex-1 font-semibold">{patient.qr_token || "NO-TOKEN-FOUND"}</span>
                <span className="text-[10px] text-blue-600 font-sans font-bold shrink-0">
                  {copied ? "✓" : "❐"}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Medical Metadata Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl bg-white p-5 shadow-xs border border-slate-100">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>⚠️</span> Known Medical Allergies
            </h2>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {patient.allergies && patient.allergies.length > 0 ? (
                patient.allergies.map((allergy: string, idx: number) => (
                  <span
                    key={idx}
                    className="rounded-lg bg-amber-50 border border-amber-200/60 px-2.5 py-1 text-xs font-bold text-amber-800"
                  >
                    {allergy}
                  </span>
                ))
              ) : (
                <p className="text-xs text-slate-400 italic">No hypersensitivities cataloged.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-xs border border-slate-100">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <span>🚨</span> Emergency Contact Profile
            </h2>
            <div className="mt-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50 text-xs">
              <p className="font-bold text-slate-800">
                {patient.emergency_contact_name || "No primary contact declared"}
              </p>
              <p className="text-blue-600 font-bold font-mono mt-0.5">
                {patient.emergency_contact_phone || "No baseline number registered"}
              </p>
            </div>
          </div>
        </div>

        {/* Prescription History Ledger Interface */}
        <div className="rounded-2xl bg-white p-5 shadow-xs border border-slate-100">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-sm font-bold tracking-tight text-slate-900">
              Prescription History Ledger
            </h2>
            <span className="text-[10px] text-slate-500 bg-slate-100 font-bold px-2 py-0.5 rounded-md">
              {prescriptions.length} Records Mapped
            </span>
          </div>

          <div className="space-y-3">
            {prescriptions.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-8 bg-slate-50/40 rounded-xl border border-dashed border-slate-200">
                No medication records found linked to this clinical file token.
              </p>
            ) : (
              prescriptions.map((p) => {
                const normalizedStatus = (p.status || "").trim().toLowerCase();
                const liveExpired = normalizedStatus === "active" && isPrescriptionExpired(p.created_at, p.prescription_items || []);
                const displayStatus = liveExpired ? "expired" : normalizedStatus;

                const badgeStyle =
                  displayStatus === "active"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : displayStatus === "expired"
                      ? "bg-orange-50 text-orange-700 border-orange-200"
                      : "bg-slate-100 text-slate-600 border-slate-200";

                return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-slate-100 bg-white shadow-xs overflow-hidden transition hover:border-slate-200"
                  >
                    {/* Top Panel Banner */}
                    <div className="bg-slate-50/80 border-b border-slate-100 p-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-[11px]">
                      <div>
                        <span className="font-bold text-slate-800 text-xs block sm:inline mr-2">
                          🏥 {p.hospital_name || p.hospitals?.name || "Medical Network Facility"}
                        </span>
                        <span className="text-slate-300 font-mono hidden sm:inline">|</span>
                        <span className="text-slate-500 sm:ml-2 font-medium">
                          👨‍⚕️ Dr. {p.doctor_name || "Staff Clinician"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <span className="text-slate-500 font-bold font-mono text-[10px]">
                          📅 {p.prescription_date || new Date(p.created_at).toLocaleDateString()}
                        </span>
                        <span className={`text-[9px] uppercase tracking-wider px-2 py-0.2 border rounded-sm font-bold ${badgeStyle}`}>
                          {displayStatus}
                        </span>
                      </div>
                    </div>

                    {/* Body Content */}
                    <div className="p-3.5 space-y-3">
                      <div className="text-xs text-slate-600 bg-slate-50/50 p-2.5 rounded-xl border border-slate-100/60">
                        <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px] block mb-0.5">
                          Clinical Diagnosis Profile Summary
                        </span>
                        <span className="font-semibold text-slate-800">
                          {p.diagnosis || "No primary diagnostics logged"}
                        </span>
                      </div>

                      {/* Component Items Layout Feed */}
                      <div className="space-y-2">
                        <span className="font-bold text-slate-400 uppercase tracking-wider text-[9px] block">
                          Dispensation Course Allocation
                        </span>
                        
                        {p.prescription_items && p.prescription_items.length > 0 ? (
                          p.prescription_items.map((item) => (
                            <div
                              key={item.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between text-xs bg-white border border-slate-100 p-2.5 rounded-xl hover:bg-slate-50/30 gap-1.5 shadow-xs"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-blue-500 text-sm">💊</span>
                                <span className="font-bold text-slate-900">
                                  {item.drug_name}
                                </span>
                                <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.2 rounded font-mono font-bold">
                                  {item.dosage}
                                </span>
                              </div>
                              <div className="text-slate-500 font-semibold pl-5 sm:pl-0">
                                ⏱️ {item.frequency} — <b>📆 {item.duration}</b>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-[11px] text-slate-400 italic">No specific medication lines bound to this ledger container.</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}