"use client";

import React, { useState } from "react";

export interface DrugConflict {
  id: string;
  drug_a: string;
  drug_b: string;
  severity: "high" | "moderate" | "low";
  warning_message: string;
}

interface InteractionWarningModalProps {
  isOpen: boolean;
  conflicts: DrugConflict[];
  onCancel: () => void;
  onOverride: (justification: string) => void;
}

const severityStyles: Record<string, { badge: string; ring: string; label: string }> = {
  high: {
    badge: "bg-red-100 text-red-700 border-red-200",
    ring: "border-red-300 bg-red-50",
    label: "High Risk",
  },
  moderate: {
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    ring: "border-amber-300 bg-amber-50",
    label: "Moderate Risk",
  },
  low: {
    badge: "bg-yellow-100 text-yellow-700 border-yellow-200",
    ring: "border-yellow-300 bg-yellow-50",
    label: "Low Risk",
  },
};

export default function InteractionWarningModal({
  isOpen,
  conflicts,
  onCancel,
  onOverride,
}: InteractionWarningModalProps) {
  const [justification, setJustification] = useState("");
  const [confirmChecked, setConfirmChecked] = useState(false);

  if (!isOpen) return null;

  const hasHighSeverity = conflicts.some((c) => c.severity === "high");
  const canOverride = confirmChecked && justification.trim().length >= 10;

  const handleOverride = () => {
    if (!canOverride) return;
    onOverride(justification.trim());
    setJustification("");
    setConfirmChecked(false);
  };

  const handleCancel = () => {
    setJustification("");
    setConfirmChecked(false);
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden">
        <div
          className={`p-5 border-b ${hasHighSeverity ? "bg-red-50 border-red-100" : "bg-amber-50 border-amber-100"}`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold ${hasHighSeverity ? "bg-red-600 text-white" : "bg-amber-500 text-white"}`}
            >
              !
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                Smart Prescription Guardian Alert
              </h2>
              <p className="text-xs text-gray-500">
                {conflicts.length} potential drug interaction
                {conflicts.length > 1 ? "s" : ""} detected against this
                patient&apos;s active medications.
              </p>
            </div>
          </div>
        </div>

        <div className="max-h-72 overflow-y-auto p-5 space-y-3">
          {conflicts.map((c) => {
            const style = severityStyles[c.severity] || severityStyles.low;
            return (
              <div key={c.id} className={`rounded-xl border p-3 ${style.ring}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold text-gray-900">
                    {c.drug_a} + {c.drug_b}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.badge}`}
                  >
                    {style.label}
                  </span>
                </div>
                <p className="text-xs text-gray-700 leading-relaxed">
                  {c.warning_message}
                </p>
              </div>
            );
          })}
        </div>

        <div className="p-5 border-t border-gray-100 bg-gray-50 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Clinical justification to override (required, min. 10 characters)
            </label>
            <textarea
              className="w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
              rows={2}
              placeholder="e.g. Benefit outweighs risk given patient's INR is being monitored weekly..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
          </div>

          <label className="flex items-start gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={confirmChecked}
              onChange={(e) => setConfirmChecked(e.target.checked)}
            />
            I have reviewed the interaction warning(s) above and take clinical
            responsibility for prescribing despite the flagged risk.
          </label>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 rounded-lg border border-gray-300 bg-white py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition"
            >
              Cancel Prescription
            </button>
            <button
              type="button"
              disabled={!canOverride}
              onClick={handleOverride}
              className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-medium text-white hover:bg-red-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Override & Prescribe
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
