"use client";

import React, { useState, useEffect } from "react";

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

const severityStyles: Record<string, { badge: string; ring: string; label: string; iconBg: string }> = {
  high: {
    badge: "bg-red-100 text-red-700 border-red-200",
    ring: "border-red-200 bg-red-50/60",
    label: "High Risk",
    iconBg: "bg-red-600",
  },
  moderate: {
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    ring: "border-amber-200 bg-amber-50/60",
    label: "Moderate Risk",
    iconBg: "bg-amber-500",
  },
  low: {
    badge: "bg-yellow-100 text-yellow-700 border-yellow-200",
    ring: "border-yellow-200 bg-yellow-50/60",
    label: "Low Risk",
    iconBg: "bg-yellow-500",
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

  // Bind Escape Key for Accessibility
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleCancel();
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  if (!isOpen) return null;

  const hasHighSeverity = conflicts.some((c) => c.severity === "high");
  const trimmedLength = justification.trim().length;
  const isLengthValid = trimmedLength >= 10;
  const canOverride = confirmChecked && isLengthValid;

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
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 transition-all"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border border-gray-100 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-150">
        
        {/* Dynamic Warning Header Banner */}
        <div className={`p-5 border-b ${hasHighSeverity ? "bg-red-50/80 border-red-100" : "bg-amber-50/80 border-amber-100"}`}>
          <div className="flex items-start gap-3.5">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm ${hasHighSeverity ? "bg-red-600" : "bg-amber-500"}`}>
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900 tracking-tight">
                Smart Clinical Guardian Alert
              </h2>
              <p className="text-xs text-gray-500 mt-0.5 leading-normal">
                {conflicts.length} potential contraindication{conflicts.length > 1 ? "s" : ""} detected against this patient&apos;s active medication profile.
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Conflict Cards Container */}
        <div className="max-h-64 overflow-y-auto p-5 space-y-3 bg-gray-50/30">
          {conflicts.map((c) => {
            const style = severityStyles[c.severity] || severityStyles.low;
            return (
              <div key={c.id} className={`rounded-xl border p-3.5 shadow-xs transition-colors bg-white ${style.ring}`}>
                <div className="flex items-center justify-between gap-4 mb-2">
                  <span className="text-sm font-bold text-gray-800 tracking-tight">
                    {c.drug_a} <span className="text-gray-400 font-medium">↔</span> {c.drug_b}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${style.badge}`}>
                    {style.label}
                  </span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed font-medium">
                  {c.warning_message}
                </p>
              </div>
            );
          })}
        </div>

        {/* Authorization Form & Action Button Deck */}
        <div className="p-5 border-t border-gray-100 bg-white space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-bold text-gray-700">
                Clinical Override Justification <span className="text-red-500">*</span>
              </label>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isLengthValid ? "bg-green-50 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                {trimmedLength} / 10 min chars
              </span>
            </div>
            <textarea
              className="w-full rounded-xl border border-gray-200 bg-gray-50/50 p-3 text-sm text-gray-900 transition focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-4 focus:ring-blue-500/10 placeholder:text-gray-400"
              rows={2}
              placeholder="Provide objective medical rationale (e.g., benefits outweigh risk, safety biomarkers monitored)..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
            />
          </div>

          <label className="flex items-start gap-2.5 text-xs text-gray-600 leading-relaxed select-none cursor-pointer group">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded-sm border-gray-300 text-red-600 focus:ring-red-500 cursor-pointer"
              checked={confirmChecked}
              onChange={(e) => setConfirmChecked(e.target.checked)}
            />
            <span className="group-hover:text-gray-900 transition-colors font-medium">
              I have thoroughly reviewed the active drug interactions and assume formal legal and clinical responsibility for issuing this prescription.
            </span>
          </label>

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={handleCancel}
              className="flex-1 rounded-xl border border-gray-200 bg-white py-2.5 text-xs font-bold text-gray-700 shadow-xs hover:bg-gray-50 active:scale-[0.98] transition-all"
            >
              Cancel Prescription
            </button>
            <button
              type="button"
              disabled={!canOverride}
              onClick={handleOverride}
              className="flex-1 rounded-xl bg-slate-900 py-2.5 text-xs font-bold tracking-wide text-white shadow-sm shadow-slate-900/10 hover:bg-red-600 hover:shadow-red-600/10 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-30 transition-all"
            >
              Override & Authorize
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}