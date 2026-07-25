"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LogoutButton from "@/components/LogoutButton";

export default function SystemAdminDashboard() {
  const supabase = createClient();
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [interactions, setInteractions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // New Interaction Form States
  const [drugA, setDrugA] = useState("");
  const [drugB, setDrugB] = useState("");
  const [severity, setSeverity] = useState("high");
  const [warningMsg, setWarningMsg] = useState("");

  // New Hospital Form States
  const [hospName, setHospName] = useState("");
  const [hospAddress, setHospAddress] = useState("");
  const [hospContact, setHospContact] = useState("");
  const [hospRegNumber, setHospRegNumber] = useState("");

  useEffect(() => {
    async function fetchSystemData() {
      const { data: hospData } = await supabase.from("hospitals").select("*");
      if (hospData) setHospitals(hospData);

      const { data: intData } = await supabase
        .from("drug_interactions")
        .select("*");
      if (intData) setInteractions(intData);

      setLoading(false);
    }
    fetchSystemData();
  }, [supabase]);

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drugA || !drugB || !warningMsg) return;

    const { error } = await supabase.from("drug_interactions").insert({
      drug_a: drugA,
      drug_b: drugB,
      severity,
      warning_message: warningMsg,
    });

    if (!error) {
      window.location.reload();
    }
  };

  const handleAddHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospName || !hospAddress || !hospContact || !hospRegNumber) return;

    const { error } = await supabase.from("hospitals").insert({
      name: hospName,
      address: hospAddress,
      contact_number: hospContact,
      registration_number: hospRegNumber,
    });

    if (!error) {
      window.location.reload();
    }
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center font-medium">
        Loading System Admin Panel...
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex justify-between items-center">
          <div>
            <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
              System Owner Control
            </span>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">
              National Health Infrastructure Admin
            </h1>
          </div>
          <LogoutButton />
        </div>

        {/* Grid layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Hospitals list */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Onboarded Hospitals ({hospitals.length})
            </h2>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {hospitals.map((h) => (
                <div
                  key={h.id}
                  className="p-3 border rounded-xl bg-gray-50 flex justify-between items-center"
                >
                  <div>
                    <p className="font-semibold text-gray-800">{h.name}</p>
                    <p className="text-xs text-gray-500">{h.address}</p>
                  </div>
                  <span className="text-xs font-mono bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    {h.registration_number}
                  </span>
                </div>
              ))}
            </div>

            <form
              onSubmit={handleAddHospital}
              className="mt-4 border-t border-gray-100 pt-4 space-y-2"
            >
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Onboard New Hospital
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Hospital name"
                  required
                  className="border rounded p-2 text-sm"
                  value={hospName}
                  onChange={(e) => setHospName(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Registration number"
                  required
                  className="border rounded p-2 text-sm"
                  value={hospRegNumber}
                  onChange={(e) => setHospRegNumber(e.target.value)}
                />
              </div>
              <input
                type="text"
                placeholder="Address"
                required
                className="w-full border rounded p-2 text-sm"
                value={hospAddress}
                onChange={(e) => setHospAddress(e.target.value)}
              />
              <input
                type="text"
                placeholder="Contact number"
                required
                className="w-full border rounded p-2 text-sm"
                value={hospContact}
                onChange={(e) => setHospContact(e.target.value)}
              />
              <button
                type="submit"
                className="w-full bg-blue-600 text-white rounded py-2 text-sm font-medium hover:bg-blue-700 transition"
              >
                Add Hospital
              </button>
            </form>
          </div>

          {/* Add Drug Interaction Rule */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Add Safety Guardian Rule
            </h2>
            <form onSubmit={handleAddInteraction} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Drug A (e.g., Aspirin)"
                  required
                  className="border rounded p-2 text-sm"
                  value={drugA}
                  onChange={(e) => setDrugA(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Drug B (e.g., Warfarin)"
                  required
                  className="border rounded p-2 text-sm"
                  value={drugB}
                  onChange={(e) => setDrugB(e.target.value)}
                />
              </div>
              <select
                className="w-full border rounded p-2 text-sm"
                value={severity}
                onChange={(e) => setSeverity(e.target.value)}
              >
                <option value="high">High Risk</option>
                <option value="moderate">Moderate Risk</option>
                <option value="low">Low Risk</option>
              </select>
              <textarea
                placeholder="Clinical warning message..."
                required
                className="w-full border rounded p-2 text-sm"
                value={warningMsg}
                onChange={(e) => setWarningMsg(e.target.value)}
              />
              <button
                type="submit"
                className="w-full bg-red-600 text-white rounded py-2 text-sm font-medium hover:bg-red-700 transition"
              >
                Save Guardian Rule
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
