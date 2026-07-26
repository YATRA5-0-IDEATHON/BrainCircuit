import Link from "next/link";

export default function Home() {
  return (
    <div className="relative isolate flex min-h-[85vh] flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-blue-50/40 via-white to-white p-6 text-center">
      {/* Subtle modern background blur */}
      <div 
        className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80" 
        aria-hidden="true"
      >
        <div 
          className="relative left-[calc(50%-11rem)] aspect-[1155/678] w-[36.125rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-blue-200 to-indigo-300 opacity-40 sm:left-[calc(50%-30rem)] sm:w-[72.1875rem]" 
          style={{ 
            clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)' 
          }} 
        />
      </div>

      <div className="max-w-2xl space-y-8">
        {/* Modern pill badge with a live pulse indicator */}
        <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-inset ring-blue-600/10 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse" />
          National Health Storage System
        </span>

        {/* Premium text gradient for the name */}
        <h1 className="text-5xl font-black tracking-tight bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 bg-clip-text text-transparent sm:text-6xl">
          Health Sanjal
        </h1>

        {/* Improved paragraph leading and max-width for better readability */}
        <p className="text-lg leading-8 text-slate-600 max-w-xl mx-auto font-normal">
          Unifying fragmented medical records into a single secure QR Code, enabling doctors to access complete patient histories in seconds,
          while protecting patients in real time with automated cross-doctor
          drug interaction alerts.
        </p>

        {/* Responsive dual-CTA actions with tactile scaling effects */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 pt-4">
          <Link
            href="/auth/login"
            className="w-full sm:w-auto rounded-xl bg-blue-600 px-8 py-3.5 text-sm font-semibold text-white shadow-md shadow-blue-600/10 hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-600/20 active:scale-[0.98] transition-all duration-200"
          >
            Sign In to Portal
          </Link>
          
          <Link
            href="/about"
            className="w-full sm:w-auto rounded-xl bg-white px-8 py-3.5 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 active:scale-[0.98] transition-all duration-200"
          >
            Learn More
          </Link>
        </div>
      </div>
    </div>
  );
}