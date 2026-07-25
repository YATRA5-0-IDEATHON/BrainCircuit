"use client";

import React, { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import LogoutButton from "@/components/LogoutButton";

export default function HospitalDashboard() {
  const supabase = createClient();
  const [hospital, setHospital] = useState<any>(null);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function fetchHospitalData() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: staffData } = await supabase
      .from("hospital_staff")
      .select("*, hospitals(*)")
      .eq("profile_id", user.id)
      .single();

    if (staffData && staffData.hospitals) {
      setHospital(staffData.hospitals);

      const { data: departmentStaff } = await supabase
        .from("hospital_staff")
        .select("*, profiles(full_name, email, phone)")
        .eq("hospital_id", staffData.hospitals.id);

      if (departmentStaff) setStaffList(departmentStaff);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchHospitalData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleVerification = async (staffId: string, current: boolean) => {
    setUpdatingId(staffId);
    await supabase
      .from("hospital_staff")
      .update({ is_verified: !current })
      .eq("id", staffId);
    await fetchHospitalData();
    setUpdatingId(null);
  };

  if (loading)
    return (
      <div className="flex h-screen items-center justify-center font-medium">
        Loading Hospital Portal...
      </div>
    );
  if (!hospital)
    return (
      <div className="flex h-screen items-center justify-center">
        Hospital administrative profile not found.
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Hospital Info Card */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700">
                Hospital Administration
              </span>
              <LogoutButton />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mt-2">
              {hospital.name}
            </h1>
            <p className="text-sm text-gray-500">
              {hospital.address} • Reg: {hospital.registration_number}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">Emergency Line</p>
            <p className="font-semibold text-gray-800">
              {hospital.contact_number}
            </p>
          </div>
        </div>

        {/* Staff Management Section */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            Registered Hospital Staff & Doctors
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-gray-600">
              <thead className="bg-gray-50 text-xs uppercase text-gray-700">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Designation</th>
                  <th className="p-3">License Number</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-900">
                      {staff.profiles?.full_name}
                    </td>
                    <td className="p-3">{staff.designation || "Staff"}</td>
                    <td className="p-3 font-mono text-xs">
                      {staff.medical_license_number || "N/A"}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${staff.is_verified ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}
                      >
                        {staff.is_verified ? "Verified" : "Pending"}
                      </span>
                    </td>
                    <td className="p-3">
                      <button
                        onClick={() =>
                          toggleVerification(staff.id, staff.is_verified)
                        }
                        disabled={updatingId === staff.id}
                        className={`text-xs font-semibold rounded px-2.5 py-1 transition disabled:opacity-50 ${
                          staff.is_verified
                            ? "bg-gray-100 text-gray-600 hover:bg-gray-200"
                            : "bg-indigo-600 text-white hover:bg-indigo-700"
                        }`}
                      >
                        {updatingId === staff.id
                          ? "..."
                          : staff.is_verified
                            ? "Revoke"
                            : "Verify"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
