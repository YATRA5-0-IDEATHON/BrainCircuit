"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LogoutButton from "@/components/LogoutButton";

interface Hospital {
  id: string;
  name: string;
  address: string;
  contact_number: string;
  registration_number: string;
}

interface DrugInteraction {
  id: string;
  drug_a: string;
  drug_b: string;
  severity: "high" | "moderate" | "low";
  warning_message: string;
}

const severityBadges: Record<string, string> = {
  high: "bg-red-50 text-red-700 border-red-100",
  moderate: "bg-amber-50 text-amber-700 border-amber-100",
  low: "bg-yellow-50 text-yellow-700 border-yellow-100",
};

export default function SystemAdminDashboard() {
  const supabase = createClient();
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [interactions, setInteractions] = useState<DrugInteraction[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Async Form Submission Blockers
  const [isSubmittingHosp, setIsSubmittingHosp] = useState(false);
  const [isSubmittingInt, setIsSubmittingInt] = useState(false);

  // New Interaction Form States
  const [drugA, setDrugA] = useState("");
  const [drugB, setDrugB] = useState("");
  const [severity, setSeverity] = useState<"high" | "moderate" | "low">("high");
  const [warningMsg, setWarningMsg] = useState("");

  // New Hospital Form States
  const [hospName, setHospName] = useState("");
  const [hospAddress, setHospAddress] = useState("");
  const [hospContact, setHospContact] = useState("");
  const [hospRegNumber, setHospRegNumber] = useState("");

  useEffect(() => {
    async function fetchSystemData() {
      try {
        const [hospResponse, intResponse] = await Promise.all([
          supabase.from("hospitals").select("*").order("name", { ascending: true }),
          supabase.from("drug_interactions").select("*").order("created_at", { ascending: false })
        ]);

        if (hospResponse.data) setHospitals(hospResponse.data);
        if (intResponse.data) setInteractions(intResponse.data);
      } catch (err) {
        console.error("Data pipeline fetch collision:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchSystemData();
  }, [supabase]);

  const handleAddHospital = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hospName || !hospAddress || !hospContact || !hospRegNumber || isSubmittingHosp) return;

    setIsSubmittingHosp(true);
    const newHosp = {
      name: hospName.trim(),
      address: hospAddress.trim(),
      contact_number: hospContact.trim(),
      registration_number: hospRegNumber.trim().toUpperCase(),
    };

    const { data, error } = await supabase.from("hospitals").insert(newHosp).select();

    if (!error && data) {
      // Clean reactive injection state patch (No page reloads needed)
      setHospitals((prev) => [...prev, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
      setHospName("");
      setHospAddress("");
      setHospContact("");
      setHospRegNumber("");
    } else {
      console.error("Failed to append hospital entry framework:", error);
    }
    setIsSubmittingHosp(false);
  };

  const handleAddInteraction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!drugA || !drugB || !warningMsg || isSubmittingInt) return;

    setIsSubmittingInt(true);
    const newInteraction = {
      drug_a: drugA.trim(),
      drug_b: drugB.trim(),
      severity,
      warning_message: warningMsg.trim(),
    };

    const { data, error } = await supabase.from("drug_interactions").insert(newInteraction).select();

    if (!error && data) {
      // Clean dynamic array injection
      setInteractions((prev) => [data[0], ...prev]);
      setDrugA("");
      setDrugB("");
      setSeverity("high");
      setWarningMsg("");
    } else {
      console.error("Failed to append guardian threshold rule:", error);
    }
    setIsSubmittingInt(false);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 bg-slate-50">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Syncing Admin Framework Hub...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 px-4 py-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        
        {/* Header Platform Control Deck */}
        <div className="rounded-2xl bg-white p-6 shadow-xs border border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-[10px] font-bold tracking-wide text-red-700 border border-red-100">
              <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              Root System Master Command
            </div>
            <h1 className="text-xl font-black tracking-tight text-slate-900 mt-2">
              National Health Infrastructure Registry
            </h1>
          </div>
          <div className="shrink-0 self-start sm:self-auto">
            <LogoutButton />
          </div>
        </div>

        {/* Dynamic Multi-Column Administrative Workspace Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* ================= COLUMN 1: HOSPITAL REGISTRY PORTAL ================= */}
          <div className="rounded-2xl bg-white p-5 shadow-xs border border-slate-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold tracking-tight text-slate-900">
                  Onboarded Hospital Networks
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md">
                  {hospitals.length} active nodes
                </span>
              </div>
              
              {/* Scrollable Node Window */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {hospitals.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No network nodes mapped to infrastructure.</p>
                ) : (
                  hospitals.map((h) => (
                    <div key={h.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 flex justify-between items-center transition-all hover:bg-slate-50">
                      <div>
                        <p className="text-xs font-bold text-slate-800">{h.name}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">{h.address}</p>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-blue-50 text-blue-600 px-2 py-0.5 border border-blue-100 rounded-md">
                        {h.registration_number}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Insertion Node Form Anchor */}
            <form onSubmit={handleAddHospital} className="mt-5 border-t border-slate-100 pt-4 space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Deploy New Regional Node
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Facility Target Name"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-gray-900 transition focus:border-blue-500 focus:bg-white focus:outline-hidden"
                  value={hospName}
                  onChange={(e) => setHospName(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Gov Registration Key"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-gray-900 transition focus:border-blue-500 focus:bg-white focus:outline-hidden"
                  value={hospRegNumber}
                  onChange={(e) => setHospRegNumber(e.target.value)}
                />
              </div>
              <input
                type="text"
                placeholder="Physical Street Operational Address"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-gray-900 transition focus:border-blue-500 focus:bg-white focus:outline-hidden"
                value={hospAddress}
                onChange={(e) => setHospAddress(e.target.value)}
              />
              <input
                type="text"
                placeholder="Central Emergency Contact Line"
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-gray-900 transition focus:border-blue-500 focus:bg-white focus:outline-hidden"
                value={hospContact}
                onChange={(e) => setHospContact(e.target.value)}
              />
              <button
                type="submit"
                disabled={isSubmittingHosp}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-slate-800 active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none"
              >
                {isSubmittingHosp ? "Provisioning..." : "Onboard Facility Framework"}
              </button>
            </form>
          </div>

          {/* ================= COLUMN 2: CLINICAL GUARDIAN RULES PORTAL ================= */}
          <div className="rounded-2xl bg-white p-5 shadow-xs border border-slate-100 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold tracking-tight text-slate-900">
                  Active Drug Interaction Guard Filters
                </h2>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-red-50 text-red-700 border border-red-100 rounded-md">
                  {interactions.length} rules active
                </span>
              </div>
              
              {/* Scrollable Rules Filter List (Previously missing!) */}
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {interactions.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">No cross-interaction constraints populated.</p>
                ) : (
                  interactions.map((i) => (
                    <div key={i.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 flex flex-col gap-1 transition-all hover:bg-slate-50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-slate-800">
                          {i.drug_a} <span className="text-slate-400 font-medium">↔</span> {i.drug_b}
                        </span>
                        <span className={`rounded-sm border px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${severityBadges[i.severity] || "bg-slate-100"}`}>
                          {i.severity} Risk
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 leading-normal line-clamp-2">{i.warning_message}</p>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Creation Rule Engine Form Anchor */}
            <form onSubmit={handleAddInteraction} className="mt-5 border-t border-slate-100 pt-4 space-y-3">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Author New Safety Constraint Filter
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Primary Agent (e.g., Aspirin)"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-gray-900 transition focus:border-blue-500 focus:bg-white focus:outline-hidden"
                  value={drugA}
                  onChange={(e) => setDrugA(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Conflicting Agent (e.g., Warfarin)"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-gray-900 transition focus:border-blue-500 focus:bg-white focus:outline-hidden"
                  value={drugB}
                  onChange={(e) => setDrugB(e.target.value)}
                />
              </div>
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-gray-900 transition focus:border-blue-500 focus:bg-white focus:outline-hidden cursor-pointer"
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
              >
                <option value="high">🔴 High Severity Contraindication Threshold</option>
                <option value="moderate">🟡 Moderate Clinical Monitoring Risk</option>
                <option value="low">⚪ Low General Conflict Cautionary Note</option>
              </select>
              <textarea
                placeholder="Input definitive clinical instructions / warnings to show prescribing clinicians..."
                required
                rows={2}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-gray-900 transition focus:border-blue-500 focus:bg-white focus:outline-hidden resize-none"
                value={warningMsg}
                onChange={(e) => setWarningMsg(e.target.value)}
              />
              <button
                type="submit"
                disabled={isSubmittingInt}
                className="w-full rounded-xl bg-red-600 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-red-700 active:scale-[0.99] disabled:opacity-40 disabled:pointer-events-none"
              >
                {isSubmittingInt ? "Injecting Rule..." : "Commit Guardian Safety Constraint"}
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}