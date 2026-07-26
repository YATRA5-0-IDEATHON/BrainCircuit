"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/dist/client/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError || !authData.user) {
      setError(authError?.message || "Invalid login credentials.");
      setLoading(false);
      return;
    }

    // Fetch user role to route correctly
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", authData.user.id)
      .single();

    if (!profile) {
      setError("User profile record not found.");
      setLoading(false);
      return;
    }

    // Role-based dashboard redirection
    const roleRoutes: Record<string, string> = {
      patient: "/patient/dashboard",
      doctor: "/doctor/scan",
      hospital_admin: "/hospital/dashboard",
      system_admin: "/admin/dashboard",
    };

    router.push(roleRoutes[profile.role] || "/patient/dashboard");
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
        <div className="text-center mb-6">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            Health Sanjal
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            Sign In to Portal
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Access patients, hospital records, and safety intelligence.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700">
              Email Address
            </label>
            <input
              type="email"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              required
              className="mt-1 w-full rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
          >
            {loading ? "Authenticating..." : "Sign In"}
          </button>
          <Link href="/auth/signup" className="block text-center text-sm text-blue-600 hover:underline mt-2">
            Don't have an account? Register
          </Link>
        </form>
      </div>
    </div>
  );
}
