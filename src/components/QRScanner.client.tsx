"use client";

import { useEffect, useRef, useState } from "react";

interface QRScannerProps {
  onScan: (value: string) => void;
}

// Minimal typing for the browser's native Barcode Detection API, which
// isn't yet in the default TS DOM lib.
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

/**
 * Camera-based QR scanner using the native BarcodeDetector API where
 * available (Chrome/Edge/Android). Falls back gracefully — the parent
 * page (doctor/scan) always keeps the manual token-entry field as a
 * reliable alternative for browsers without support (e.g. Safari, Firefox).
 */
export default function QRScanner({ onScan }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [supported, setSupported] = useState(true);
  const [active, setActive] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined" && !window.BarcodeDetector) {
      setSupported(false);
    }
    return () => stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      scanLoop();
    } catch (err) {
      setError(
        "Camera access denied or unavailable. Use manual token entry below instead.",
      );
    }
  };

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setActive(false);
  };

  const scanLoop = async () => {
    if (!window.BarcodeDetector) return;
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });

    const tick = async () => {
      if (!streamRef.current || !videoRef.current) return;
      try {
        const codes = await detector.detect(videoRef.current);
        if (codes.length > 0) {
          onScan(codes[0].rawValue);
          stop();
          return;
        }
      } catch {
        // ignore transient detection errors
      }
      if (streamRef.current) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  if (!supported) {
    return (
      <p className="text-xs text-gray-400 text-center">
        Live camera scanning isn&apos;t supported in this browser. Please use
        manual token entry below.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <p className="text-xs text-red-600 text-center">{error}</p>
      )}
      <div className="relative overflow-hidden rounded-xl bg-black aspect-video">
        <video
          ref={videoRef}
          className={`h-full w-full object-cover ${active ? "" : "opacity-0"}`}
          muted
          playsInline
        />
        {!active && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              type="button"
              onClick={start}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
            >
              Enable Camera Scan
            </button>
          </div>
        )}
      </div>
      {active && (
        <button
          type="button"
          onClick={stop}
          className="w-full rounded-lg border border-gray-300 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition"
        >
          Stop Camera
        </button>
      )}
    </div>
  );
}
