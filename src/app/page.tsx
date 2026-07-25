import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center p-6 text-center">
      <div className="max-w-2xl space-y-6">
        <span className="rounded-full bg-blue-100 px-3.5 py-1.5 text-xs font-semibold text-blue-700">
          National Health Infrastructure & Guardian System
        </span>

        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
          Health Wallet + Smart Prescription Guardian
        </h1>

        <p className="text-lg text-gray-600">
          Unifying fragmented medical records into a single secure QR wallet
          while protecting patients in real time with automated cross-doctor
          drug interaction alerts.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
          <Link
            href="/auth/login"
            className="rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 transition"
          >
            Sign In to Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
