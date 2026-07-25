"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import QRScanner from "@/components/QRScanner.client";

export default function DoctorScanPage() {
  const [qrToken, setQrToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const processToken = async (token: string) => {
    if (!token.trim()) return;

    setLoading(true);
    setError("");

    try {
      // 1. Find patient by QR Token
      const { data: patient, error: patientErr } = await supabase
        .from("patients")
        .select("id, profile_id")
        .eq("qr_token", token.trim())
        .single();

      if (patientErr || !patient) {
        setError("Invalid QR token or patient not found.");
        setLoading(false);
        return;
      }

      // 2. Log access in audit logs
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("audit_logs").insert({
          accessor_id: user.id,
          patient_id: patient.id,
          action_type: "QR_SCAN",
        });
      }

      // 3. Redirect to prescribing/viewing interface
      router.push(`/doctor/prescribe?patient_id=${patient.id}`);
    } catch (err: any) {
      setError(err.message || "An error occurred during scan verification.");
      setLoading(false);
    }
  };

  const handleManualScan = async (e: React.FormEvent) => {
    e.preventDefault();
    await processToken(qrToken);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
        <div className="text-center mb-6">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            Doctor Portal
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            Scan Patient Health Wallet
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Scan the patient's QR code, or enter their secure token manually
            to access medical records and safety guardian.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <div className="mb-6">
          <QRScanner onScan={(value) => processToken(value)} />
        </div>

        <div className="relative mb-4 text-center">
          <span className="bg-white px-2 text-[10px] uppercase tracking-wider text-gray-400 relative z-10">
            or enter manually
          </span>
          <div className="absolute left-0 right-0 top-1/2 h-px bg-gray-200" />
        </div>

        <form onSubmit={handleManualScan} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700">
              Patient QR Token Hash
            </label>
            <input
              type="text"
              required
              placeholder="Paste token string or scan..."
              className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none font-mono"
              value={qrToken}
              onChange={(e) => setQrToken(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
          >
            {loading ? "Verifying Records..." : "Access Patient Profile"}
          </button>
        </form>
      </div>
    </div>
  );
}
