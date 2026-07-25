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

  const [diagnosis, setDiagnosis] = useState("");
  const [drugName, setDrugName] = useState("");
  const [dosage, setDosage] = useState("");
  const [frequency, setFrequency] = useState("");
  const [duration, setDuration] = useState("");

  const [conflicts, setConflicts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const handlePrescribeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !drugName) return;

    setLoading(true);

    try {
      // 1. Run Guardian Check API
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

      // If no conflict, write directly to database
      await savePrescription();
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  const savePrescription = async (overrideNote?: string) => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get staff record for doctor
      const { data: staff } = await supabase
        .from("hospital_staff")
        .select("id, hospital_id")
        .eq("profile_id", user.id)
        .single();

      if (!staff) return;

      const fullDiagnosis = overrideNote
        ? `${diagnosis} [Guardian override: ${overrideNote}]`
        : diagnosis;

      // Insert prescription
      const { data: presc, error: prescErr } = await supabase
        .from("prescriptions")
        .insert({
          patient_id: patientId,
          doctor_id: staff.id,
          hospital_id: staff.hospital_id,
          diagnosis: fullDiagnosis,
          status: "active",
        })
        .select()
        .single();

      if (prescErr) throw prescErr;

      // Insert prescription item
      await supabase.from("prescription_items").insert({
        prescription_id: presc.id,
        drug_name: drugName,
        dosage,
        frequency,
        duration,
      });

      // Log the prescription creation for compliance
      await supabase.from("audit_logs").insert({
        accessor_id: user.id,
        patient_id: patientId,
        action_type: "PRESCRIPTION_CREATE",
      });

      // Fire a push notification to the patient (best-effort, non-blocking)
      fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "prescription_created",
          patient_id: patientId,
          drug_name: drugName,
        }),
      }).catch(() => {});

      setSuccessMsg("Prescription saved successfully. Redirecting...");
      setTimeout(() => router.push("/doctor/scan"), 1200);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
        <h1 className="text-xl font-bold text-gray-900 mb-4">
          Write New Prescription
        </h1>

        <form onSubmit={handlePrescribeSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700">
              Diagnosis
            </label>
            <input
              type="text"
              required
              className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="e.g., Hypertension / Type 2 Diabetes"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">
              Drug Name (Generic / Brand)
            </label>
            <input
              type="text"
              required
              className="mt-1 w-full rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none"
              value={drugName}
              onChange={(e) => setDrugName(e.target.value)}
              placeholder="e.g., Aspirin, Warfarin, Metformin"
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs font-medium text-gray-700">
                Dosage
              </label>
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
              <label className="block text-xs font-medium text-gray-700">
                Frequency
              </label>
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
              <label className="block text-xs font-medium text-gray-700">
                Duration
              </label>
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
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 transition"
          >
            {loading
              ? "Running Guardian Safety Check..."
              : "Save Prescription & Verify"}
          </button>
        </form>

        {successMsg && (
          <div className="mt-4 rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-700">
            {successMsg}
          </div>
        )}

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
    </div>
  );
}

export default function DoctorPrescribePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          Loading module...
        </div>
      }
    >
      <PrescribeContent />
    </Suspense>
  );
}
