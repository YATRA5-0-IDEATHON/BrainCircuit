"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignUpPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<
    "patient" | "doctor" | "hospital_admin" | "system_admin"
  >("patient");

  // Patient-specific fields
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("Male");
  const [bloodGroup, setBloodGroup] = useState("O+");
  const [allergies, setAllergies] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  // Hospital-staff/admin-specific fields
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState("");
  const [designation, setDesignation] = useState("");
  const [medicalLicense, setMedicalLicense] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function fetchHospitals() {
      const { data } = await supabase.from("hospitals").select("*");
      if (data) setHospitals(data);
    }
    fetchHospitals();
  }, [supabase]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // 1. Sign up user with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError || !authData.user) {
        throw new Error(authError?.message || "Failed to create user account.");
      }

      const userId = authData.user.id;

      // 2. Insert into profiles table
      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        email,
        full_name: fullName,
        phone,
        role,
      });

      if (profileError) throw profileError;

      // 3. Conditional role-specific table entries
      if (role === "patient") {
        const { error: patientError } = await supabase.from("patients").insert({
          profile_id: userId,
          dob,
          gender,
          blood_group: bloodGroup,
          allergies: allergies ? allergies.split(",").map((s) => s.trim()) : [],
          emergency_contact_name: emergencyName,
          emergency_contact_phone: emergencyPhone,
        });
        if (patientError) throw patientError;
      } else if (role === "doctor" || role === "hospital_admin") {
        const { error: staffError } = await supabase
          .from("hospital_staff")
          .insert({
            hospital_id: selectedHospitalId || null,
            profile_id: userId,
            designation:
              designation ||
              (role === "doctor"
                ? "Medical Practitioner"
                : "Hospital Administrator"),
            medical_license_number: role === "doctor" ? medicalLicense : null,
            is_verified: false, // Requires system or admin approval
          });
        if (staffError) throw staffError;
      }

      // 4. Redirect based on role
      const roleRoutes: Record<string, string> = {
        patient: "/patient/dashboard",
        doctor: "/doctor/scan",
        hospital_admin: "/hospital/dashboard",
        system_admin: "/admin/dashboard",
      };

      router.push(roleRoutes[role] || "/patient/dashboard");
    } catch (err: any) {
      setError(err.message || "An error occurred during registration.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 py-12">
      <div className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-sm border border-gray-100">
        <div className="text-center mb-6">
          <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
            Health Sanjal
          </span>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            Create New Account
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Register as a patient, doctor, or hospital administrator.
          </p>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSignUp} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">
                Full Name
              </label>
              <input
                type="text"
                required
                className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Dr. Ram Sharma / Jane Doe"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">
                Email Address
              </label>
              <input
                type="email"
                required
                className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                required
                className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">
                Phone Number
              </label>
              <input
                type="text"
                required
                className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+977 98XXXXXXXX"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700">
              Select Role
            </label>
            <select
              className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none bg-white"
              value={role}
              onChange={(e) => setRole(e.target.value as any)}
            >
              <option value="patient">Patient (Health Sanjal User)</option>
              <option value="doctor">Doctor / Medical Practitioner</option>
              <option value="hospital_admin">Hospital Administrator</option>
              {/* <option value="system_admin">System Administrator</option> */}
            </select>
          </div>

          {/* Patient Specific Fields */}
          {role === "patient" && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-blue-800">
                Patient Health Metadata
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    required
                    className="mt-1 w-full rounded border border-gray-300 p-2 text-xs bg-white"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    Gender
                  </label>
                  <select
                    className="mt-1 w-full rounded border border-gray-300 p-2 text-xs bg-white"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    Blood Group
                  </label>
                  <select
                    className="mt-1 w-full rounded border border-gray-300 p-2 text-xs bg-white"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                  >
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(
                      (bg) => (
                        <option key={bg} value={bg}>
                          {bg}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Allergies (comma separated)
                </label>
                <input
                  type="text"
                  placeholder="Penicillin, Aspirin, Peanuts"
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-xs bg-white"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    Emergency Contact Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Name"
                    className="mt-1 w-full rounded border border-gray-300 p-2 text-xs bg-white"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    Emergency Contact Phone
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Phone"
                    className="mt-1 w-full rounded border border-gray-300 p-2 text-xs bg-white"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Doctor or Hospital Admin Specific Fields */}
          {(role === "doctor" || role === "hospital_admin") && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-800">
                Hospital Affiliation
              </h3>
              <div>
                <label className="block text-xs font-medium text-gray-700">
                  Associated Hospital
                </label>
                <select
                  required
                  className="mt-1 w-full rounded border border-gray-300 p-2 text-xs bg-white"
                  value={selectedHospitalId}
                  onChange={(e) => setSelectedHospitalId(e.target.value)}
                >
                  <option value="">-- Select Hospital --</option>
                  {hospitals.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} ({h.address})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-gray-700">
                    Designation
                  </label>
                  <input
                    type="text"
                    placeholder="Cardiologist / Admin"
                    className="mt-1 w-full rounded border border-gray-300 p-2 text-xs bg-white"
                    value={designation}
                    onChange={(e) => setDesignation(e.target.value)}
                  />
                </div>
                {role === "doctor" && (
                  <div>
                    <label className="block text-xs font-medium text-gray-700">
                      Medical License No.
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="NMC-XXXXX"
                      className="mt-1 w-full rounded border border-gray-300 p-2 text-xs bg-white"
                      value={medicalLicense}
                      onChange={(e) => setMedicalLicense(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
          >
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-gray-500">
          Already have an account?{" "}
          <a
            href="/auth/login"
            className="text-blue-600 font-semibold hover:underline"
          >
            Sign In here
          </a>
        </div>
      </div>
    </div>
  );
}
