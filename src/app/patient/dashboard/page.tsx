"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import LogoutButton from "@/components/LogoutButton";
import { isPrescriptionExpired } from "@/lib/prescriptionExpiry";

export default function PatientDashboard() {
  const supabase = createClient();
  const [patient, setPatient] = useState<any>(null);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function fetchPatientData() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: patientData } = await supabase
        .from("patients")
        .select("*, profiles(full_name, email)")
        .eq("profile_id", user.id)
        .single();

      if (patientData) {
        setPatient(patientData);

        // Fetch expanded metrics including doctor and date text columns
        const { data: prescData } = await supabase
          .from("prescriptions")
          .select("*, prescription_items(*), hospitals(name)")
          .eq("patient_id", patientData.id)
          .order("created_at", { ascending: false });

        if (prescData) setPrescriptions(prescData);
      }
      setLoading(false);
    }
    fetchPatientData();
  }, [supabase]);

  const handleCopyId = () => {
    if (!patient?.qr_token) return;
    navigator.clipboard.writeText(patient.qr_token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center font-medium bg-gray-50 text-gray-600">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <span className="text-xl font-bold tracking-wide">Syncing Wallet...</span>
          <span className="text-xs text-gray-400 font-mono">Loading data ledger securely</span>
        </div>
      </div>
    );
    
  if (!patient)
    return (
      <div className="flex h-screen items-center justify-center text-sm font-medium text-red-800 bg-red-50/50">
        ⚠️ Profile records could not be resolved for this account.
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        
        {/* Header Profile Section */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-3 text-center md:text-left flex-1 w-full">
            <div className="flex items-center justify-center md:justify-start gap-3">
              <span className="rounded-full bg-blue-50 border border-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                Digital Health Wallet
              </span>
              <LogoutButton />
            </div>
            
            <div>
              <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight">
                {patient.profiles?.full_name || "Patient Profile"}
              </h1>
              <p className="text-xs text-gray-400 mt-0.5">{patient.profiles?.email}</p>
            </div>

            <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-1">
              <span className="rounded-lg bg-red-50 border border-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                🩸 Blood Group: {patient.blood_group || "N/A"}
              </span>
              <span className="rounded-lg bg-gray-50 border border-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                📅 DOB: {patient.dob || "Not Set"}
              </span>
              <span className="rounded-lg bg-blue-50 border border-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 capitalize">
                🧬 Gender: {patient.gender || "Not Set"}
              </span>
            </div>
          </div>

          {/* Interactive QR Identifier Component Card */}
          <div className="rounded-xl bg-white p-4 shadow-sm border border-gray-200 flex flex-col items-center w-full max-w-[200px] text-center bg-gradient-to-b from-white to-gray-50">
            <QRCodeSVG value={patient.qr_token || "invalid-token"} size={130} level="H" />
            
            <div className="mt-3 w-full">
              <span className="block text-[10px] uppercase font-bold tracking-wider text-gray-400">
                Unique Health ID
              </span>
              
              <button 
                onClick={handleCopyId}
                className="mt-1 w-full bg-white hover:bg-gray-100 text-gray-700 font-mono text-xs py-1 px-1.5 rounded border border-gray-200 truncate transition active:scale-95 flex items-center justify-center gap-1 group"
                title="Click to copy identifier"
              >
                <span className="truncate flex-1">{patient.qr_token || "NO-TOKEN-FOUND"}</span>
                <span className="text-[10px] text-blue-500 font-sans font-semibold shrink-0">
                  {copied ? "✓" : "❐"}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Medical Metadata Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <span>⚠️</span> Known Allergies
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {patient.allergies && patient.allergies.length > 0 ? (
                patient.allergies.map((allergy: string, idx: number) => (
                  <span
                    key={idx}
                    className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-medium text-amber-800 shadow-sm"
                  >
                    {allergy}
                  </span>
                ))
              ) : (
                <p className="text-sm text-gray-400 italic">No medical hypersensitivities recorded.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
              <span>🚨</span> Emergency Contacts
            </h2>
            <div className="mt-3 p-3 rounded-lg border border-gray-50 bg-gray-50/50 text-sm">
              <p className="font-bold text-gray-800">
                {patient.emergency_contact_name || "No name declared"}
              </p>
              <p className="text-blue-600 font-semibold font-mono mt-0.5">
                {patient.emergency_contact_phone || "No primary network number"}
              </p>
            </div>
          </div>
        </div>

        {/* Premium Structured Prescription History Ledger Interface */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
          <div className="flex justify-between items-center mb-5">
            <h2 className="text-lg font-bold text-gray-900">
              Prescription History Ledger
            </h2>
            <span className="text-xs text-gray-400 bg-gray-50 border px-2.5 py-1 rounded-full font-medium">
              Total Records: {prescriptions.length}
            </span>
          </div>

          <div className="space-y-4">
            {prescriptions.length === 0 ? (
              <p className="text-sm text-gray-400 italic text-center py-8 bg-gray-50/50 rounded-xl border border-dashed border-gray-200">
                No medication records found linked to this clinical file token.
              </p>
            ) : (
              prescriptions.map((p) => {
                const liveExpired =
                  p.status === "active" &&
                  isPrescriptionExpired(p.created_at, p.prescription_items || []);
                const displayStatus = liveExpired ? "expired" : p.status;

                const badgeStyle =
                  displayStatus === "active"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : displayStatus === "expired"
                      ? "bg-orange-50 text-orange-700 border border-orange-200"
                      : "bg-gray-100 text-gray-600 border border-gray-200";

                return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-gray-200/80 bg-white shadow-sm overflow-hidden transition hover:shadow-md"
                  >
                    {/* Top Panel Banner */}
                    <div className="bg-gray-50 border-b border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
                      <div>
                        <span className="font-bold text-gray-800 text-sm block sm:inline mr-2">
                          🏥 {p.hospital_name || p.hospitals?.name || "Medical Center"}
                        </span>
                        <span className="text-gray-400 font-mono hidden sm:inline">|</span>
                        <span className="text-gray-500 sm:ml-2 font-medium">
                          👨‍⚕️ Dr. {p.doctor_name || "Staff Practitioner"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <span className="text-gray-500 font-medium font-mono">
                          📅 {p.prescription_date || new Date(p.created_at).toLocaleDateString()}
                        </span>
                        <span
                          className={`text-[10px] uppercase tracking-wide px-2.5 py-0.5 rounded-full font-bold ${badgeStyle}`}
                        >
                          {displayStatus}
                        </span>
                      </div>
                    </div>

                    {/* Body Content */}
                    <div className="p-4 space-y-3">
                      <div className="text-xs text-gray-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                        <span className="font-bold text-slate-400 uppercase tracking-wide text-[10px] block mb-0.5">
                          Clinical Diagnosis Summary
                        </span>
                        <span className="font-medium text-gray-800 text-sm">
                          {p.diagnosis || "No diagnosis cataloged"}
                        </span>
                      </div>

                      {/* Component Items Layout Feed */}
                      <div className="space-y-2 pt-1">
                        <span className="font-bold text-gray-400 uppercase tracking-wide text-[10px] block">
                          Prescribed Medication
                        </span>
                        
                        {p.prescription_items && p.prescription_items.length > 0 ? (
                          p.prescription_items.map((item: any) => (
                            <div
                              key={item.id}
                              className="flex flex-col sm:flex-row sm:items-center justify-between text-sm bg-white border border-gray-100 p-3 rounded-lg hover:bg-gray-50/40 gap-1 shadow-sm"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-blue-500 text-md">💊</span>
                                <span className="font-semibold text-gray-900">
                                  {item.drug_name}
                                </span>
                                <span className="text-xs bg-blue-50 text-blue-700 border border-blue-100 px-2 py-0.5 rounded font-medium font-mono">
                                  {item.dosage}
                                </span>
                              </div>
                              <div className="text-gray-500 text-xs sm:text-right font-medium pl-6 sm:pl-0">
                                ⏱️ {item.frequency} — 📆 {item.duration}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-gray-400 italic">No operational line entries found mapping to this item.</p>
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