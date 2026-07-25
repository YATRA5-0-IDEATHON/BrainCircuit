"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { QRCodeSVG } from "qrcode.react";
import LogoutButton from "@/components/LogoutButton";

export default function PatientDashboard() {
  const supabase = createClient();
  const [patient, setPatient] = useState<any>(null);
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center font-medium">
        Loading Health Wallet...
      </div>
    );
  if (!patient)
    return (
      <div className="flex h-screen items-center justify-center">
        Patient profile not found.
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header Profile Section */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-3">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                Digital Health Wallet
              </span>
              <LogoutButton />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              {patient.profiles?.full_name || "Patient"}
            </h1>
            <div className="flex flex-wrap justify-center md:justify-start gap-2 pt-1">
              <span className="rounded bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700">
                Blood: {patient.blood_group}
              </span>
              <span className="rounded bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                DOB: {patient.dob}
              </span>
            </div>
          </div>

          <div className="rounded-xl bg-white p-3 shadow border border-gray-200">
            <QRCodeSVG value={patient.qr_token} size={140} />
            <p className="mt-2 text-center text-xs text-gray-500 font-mono">
              Scan for Doctor Access
            </p>
          </div>
        </div>

        {/* Medical Metadata Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Known Allergies
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {patient.allergies?.length > 0 ? (
                patient.allergies.map((allergy: string, idx: number) => (
                  <span
                    key={idx}
                    className="rounded-lg bg-red-50 border border-red-200 px-3 py-1 text-xs font-medium text-red-700"
                  >
                    {allergy}
                  </span>
                ))
              ) : (
                <p className="text-sm text-gray-500">No allergies recorded.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Emergency Contacts
            </h2>
            <div className="mt-3 text-sm">
              <p className="font-bold text-gray-800">
                {patient.emergency_contact_name}
              </p>
              <p className="text-blue-600 font-medium">
                {patient.emergency_contact_phone}
              </p>
            </div>
          </div>
        </div>

        {/* Prescription History Feed */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Prescription History
          </h2>
          <div className="space-y-4">
            {prescriptions.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-gray-200 p-4 transition hover:shadow-md"
              >
                <div className="flex justify-between items-center mb-2">
                  <span className="font-semibold text-gray-800">
                    {p.hospitals?.name || "Hospital Visit"}
                  </span>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${p.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}
                  >
                    {p.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  Diagnosis:{" "}
                  <span className="font-medium text-gray-700">
                    {p.diagnosis}
                  </span>
                </p>
                <div className="space-y-2 border-t pt-3">
                  {p.prescription_items?.map((item: any) => (
                    <div
                      key={item.id}
                      className="flex justify-between text-sm bg-gray-50 p-2 rounded"
                    >
                      <span className="font-medium text-gray-900">
                        {item.drug_name} ({item.dosage})
                      </span>
                      <span className="text-gray-600 text-xs">
                        {item.frequency} - {item.duration}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
