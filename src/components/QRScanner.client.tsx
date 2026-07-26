"use client";

import React, { useEffect, useRef, useState } from "react";

interface QRScannerProps {
  onScan: (value: string) => void;
}

interface BarcodeDetectorResult {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<BarcodeDetectorResult[]>;
}

declare global {
  interface Window {
    BarcodeDetector?: new (options: { formats: string[] }) => BarcodeDetectorLike;
  }
}

export default function QRScanner({ onScan }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isScanningRef = useRef<boolean>(false);

  const [supported, setSupported] = useState(true);
  const [active, setActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && !window.BarcodeDetector) {
      setSupported(false);
    }
    return () => {
      // Explicit cleanup guarantee on component destruction
      isScanningRef.current = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const start = async () => {
    setError("");
    setIsInitializing(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
      });
      
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      
      setActive(true);
      setIsInitializing(false);
      scanLoop();
    } catch (err) {
      console.error("Camera access failure:", err);
      setError("Camera hardware access denied. Please verify application permissions or use manual ledger input.");
      setIsInitializing(false);
      setActive(false);
    }
  };

  const stop = () => {
    isScanningRef.current = false;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setActive(false);
    setIsInitializing(false);
  };

  const scanLoop = () => {
    if (!window.BarcodeDetector) return;
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    isScanningRef.current = true;

    const tick = async () => {
      // Safety short-circuit check against dead references
      if (!isScanningRef.current || !streamRef.current || !videoRef.current) return;
      
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes.length > 0 && isScanningRef.current) {
          onScan(codes[0].rawValue);
          stop();
          return;
        }
      } catch {
        // Suppress transient frame extraction errors safely
      }

      if (isScanningRef.current) {
        requestAnimationFrame(tick);
      }
    };
    
    requestAnimationFrame(tick);
  };

  // Upgraded Fallback Module Layout
  if (!supported) {
    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-4 text-center">
        <p className="text-xs font-medium text-gray-500 leading-relaxed">
          🔒 Live scanner capture is unsupported by this browser client configuration (e.g. legacy Desktop Safari/Firefox). Please input the patient tracking registry key manually.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 w-full max-w-md mx-auto">
      
      {/* Alert Component Error Banner */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-xs font-semibold text-red-700 text-center animate-in fade-in duration-200">
          ⚠️ {error}
        </div>
      )}

      {/* Main Viewfinder Sandbox Viewport */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 aspect-video shadow-inner border border-slate-800 group">
        
        <video
          ref={videoRef}
          className={`h-full w-full object-cover transition-opacity duration-300 ${active ? "opacity-100" : "opacity-0"}`}
          muted
          playsInline
        />

        {/* Dynamic Viewfinder Reticle Overlay Frame */}
        {active && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none p-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="relative w-40 h-40 border border-white/10 rounded-xl">
              {/* Corner Targeting Brackets */}
              <div className="absolute -top-1 -left-1 w-5 h-5 border-t-4 border-l-4 border-emerald-400 rounded-tl-md" />
              <div className="absolute -top-1 -right-1 w-5 h-5 border-t-4 border-r-4 border-emerald-400 rounded-tr-md" />
              <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-4 border-l-4 border-emerald-400 rounded-bl-md" />
              <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-4 border-r-4 border-emerald-400 rounded-br-md" />
              
              {/* Animated Bouncing Laser Sweep Line */}
              <div className="absolute left-1 right-1 h-[2px] bg-emerald-400 shadow-[0_0_10px_#34d399] opacity-80 animate-pulse top-1/2" />
            </div>
          </div>
        )}

        {/* Camera Off / Boot State Layer */}
        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-slate-950/40 backdrop-blur-xs transition-all">
            {isInitializing ? (
              <div className="text-center space-y-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto" />
                <p className="text-[11px] font-bold tracking-wider text-slate-300 uppercase">Waking Camera Sensor...</p>
              </div>
            ) : (
              <button
                type="button"
                onClick={start}
                className="group/btn flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-slate-900 shadow-md transition-all hover:bg-slate-50 active:scale-95"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor" className="w-4 h-4 text-slate-500 transition-transform group-hover/btn:scale-110">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                </svg>
                <span>Initialize Target Scanner</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Persistent Shutdown Control Trigger */}
      {active && (
        <button
          type="button"
          onClick={stop}
          className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white py-2 text-xs font-bold text-gray-600 shadow-xs hover:border-red-200 hover:bg-red-50 hover:text-red-600 active:scale-95 transition-all"
        >
          <span>Deactivate Video Feed</span>
        </button>
      )}
    </div>
  );
}