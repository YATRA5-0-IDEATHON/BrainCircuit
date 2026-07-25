-- =====================================================================
-- Health Wallet + Smart Prescription Guardian
-- Full Supabase (PostgreSQL) schema
-- Run this once in the Supabase SQL Editor on a fresh project.
-- Safe to re-run: every statement uses IF NOT EXISTS / DROP ... CASCADE
-- guards where practical.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Enumerated types
-- ---------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('patient', 'doctor', 'hospital_admin', 'system_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type blood_group as enum ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');
exception when duplicate_object then null; end $$;

do $$ begin
  create type interaction_severity as enum ('high', 'moderate', 'low');
exception when duplicate_object then null; end $$;

do $$ begin
  create type prescription_status as enum ('active', 'completed', 'cancelled');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- 2. Core tables
-- ---------------------------------------------------------------------
create table if not exists profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    email text unique not null,
    full_name text not null,
    phone text,
    role user_role not null,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists hospitals (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    address text not null,
    contact_number text not null,
    registration_number text unique not null,
    created_at timestamptz default now()
);

create table if not exists hospital_staff (
    id uuid primary key default gen_random_uuid(),
    hospital_id uuid references hospitals(id) on delete cascade,
    profile_id uuid references profiles(id) on delete cascade,
    designation text,
    medical_license_number text unique,
    is_verified boolean default false,
    created_at timestamptz default now(),
    unique(hospital_id, profile_id)
);

create table if not exists patients (
    id uuid primary key default gen_random_uuid(),
    profile_id uuid references profiles(id) on delete cascade,
    dob date not null,
    gender text not null,
    blood_group blood_group not null,
    allergies text[] default '{}',
    chronic_conditions text[] default '{}',
    emergency_contact_name text not null,
    emergency_contact_phone text not null,
    qr_token text unique default encode(gen_random_bytes(32), 'hex'),
    created_at timestamptz default now()
);

create table if not exists prescriptions (
    id uuid primary key default gen_random_uuid(),
    patient_id uuid references patients(id) on delete cascade,
    doctor_id uuid references hospital_staff(id) on delete cascade,
    hospital_id uuid references hospitals(id) on delete cascade,
    diagnosis text not null,
    status prescription_status default 'active',
    created_at timestamptz default now()
);

create table if not exists prescription_items (
    id uuid primary key default gen_random_uuid(),
    prescription_id uuid references prescriptions(id) on delete cascade,
    drug_name text not null,
    dosage text not null,
    frequency text not null,
    duration text not null,
    instructions text
);

create table if not exists drug_interactions (
    id uuid primary key default gen_random_uuid(),
    drug_a text not null,
    drug_b text not null,
    severity interaction_severity not null,
    warning_message text not null,
    created_at timestamptz default now()
);

create table if not exists audit_logs (
    id uuid primary key default gen_random_uuid(),
    accessor_id uuid references profiles(id),
    patient_id uuid references patients(id),
    action_type text not null,
    ip_address text,
    created_at timestamptz default now()
);

-- ---------------------------------------------------------------------
-- 3. Indexes
-- ---------------------------------------------------------------------
create index if not exists idx_hospital_staff_profile on hospital_staff(profile_id);
create index if not exists idx_hospital_staff_hospital on hospital_staff(hospital_id);
create index if not exists idx_patients_profile on patients(profile_id);
create index if not exists idx_patients_qr_token on patients(qr_token);
create index if not exists idx_prescriptions_patient on prescriptions(patient_id);
create index if not exists idx_prescriptions_doctor on prescriptions(doctor_id);
create index if not exists idx_prescriptions_status on prescriptions(status);
create index if not exists idx_prescription_items_prescription on prescription_items(prescription_id);
create index if not exists idx_drug_interactions_drug_a on drug_interactions(lower(drug_a));
create index if not exists idx_drug_interactions_drug_b on drug_interactions(lower(drug_b));
create index if not exists idx_audit_logs_patient on audit_logs(patient_id);

-- ---------------------------------------------------------------------
-- 4. updated_at trigger for profiles
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at
  before update on profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 5. Helper functions (SECURITY DEFINER to avoid RLS recursion)
-- ---------------------------------------------------------------------
create or replace function public.current_user_role()
returns user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function public.current_staff_hospital_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select hospital_id from hospital_staff where profile_id = auth.uid() limit 1;
$$;

create or replace function public.current_patient_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from patients where profile_id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 6. Row Level Security
-- ---------------------------------------------------------------------
alter table profiles enable row level security;
alter table hospitals enable row level security;
alter table hospital_staff enable row level security;
alter table patients enable row level security;
alter table prescriptions enable row level security;
alter table prescription_items enable row level security;
alter table drug_interactions enable row level security;
alter table audit_logs enable row level security;

-- profiles ---------------------------------------------------------------
drop policy if exists "profiles_select_authenticated" on profiles;
create policy "profiles_select_authenticated" on profiles
  for select to authenticated
  using (true); -- names/emails need to be joinable across roles (staff lists, prescriptions, etc.)

drop policy if exists "profiles_insert_self" on profiles;
create policy "profiles_insert_self" on profiles
  for insert to authenticated
  with check (id = auth.uid());

drop policy if exists "profiles_update_self" on profiles;
create policy "profiles_update_self" on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- hospitals ----------------------------------------------------------------
drop policy if exists "hospitals_select_public" on hospitals;
create policy "hospitals_select_public" on hospitals
  for select to anon, authenticated
  using (true); -- public directory, needed on the sign-up form

drop policy if exists "hospitals_write_admin" on hospitals;
create policy "hospitals_write_admin" on hospitals
  for all to authenticated
  using (public.current_user_role() = 'system_admin')
  with check (public.current_user_role() = 'system_admin');

-- hospital_staff -------------------------------------------------------------
drop policy if exists "hospital_staff_select" on hospital_staff;
create policy "hospital_staff_select" on hospital_staff
  for select to authenticated
  using (
    profile_id = auth.uid()
    or hospital_id = public.current_staff_hospital_id()
    or public.current_user_role() = 'system_admin'
  );

drop policy if exists "hospital_staff_insert_self" on hospital_staff;
create policy "hospital_staff_insert_self" on hospital_staff
  for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "hospital_staff_update" on hospital_staff;
create policy "hospital_staff_update" on hospital_staff
  for update to authenticated
  using (
    hospital_id = public.current_staff_hospital_id()
    or public.current_user_role() = 'system_admin'
  )
  with check (
    hospital_id = public.current_staff_hospital_id()
    or public.current_user_role() = 'system_admin'
  );

-- patients ------------------------------------------------------------------
drop policy if exists "patients_select" on patients;
create policy "patients_select" on patients
  for select to authenticated
  using (
    profile_id = auth.uid()
    or public.current_user_role() in ('doctor', 'hospital_admin', 'system_admin')
  );

drop policy if exists "patients_insert_self" on patients;
create policy "patients_insert_self" on patients
  for insert to authenticated
  with check (profile_id = auth.uid());

drop policy if exists "patients_update_self" on patients;
create policy "patients_update_self" on patients
  for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

-- prescriptions ---------------------------------------------------------------
drop policy if exists "prescriptions_select" on prescriptions;
create policy "prescriptions_select" on prescriptions
  for select to authenticated
  using (
    patient_id = public.current_patient_id()
    or hospital_id = public.current_staff_hospital_id()
    or public.current_user_role() = 'system_admin'
  );

drop policy if exists "prescriptions_insert_doctor" on prescriptions;
create policy "prescriptions_insert_doctor" on prescriptions
  for insert to authenticated
  with check (
    public.current_user_role() = 'doctor'
    and hospital_id = public.current_staff_hospital_id()
  );

drop policy if exists "prescriptions_update" on prescriptions;
create policy "prescriptions_update" on prescriptions
  for update to authenticated
  using (
    hospital_id = public.current_staff_hospital_id()
    or public.current_user_role() = 'system_admin'
  )
  with check (
    hospital_id = public.current_staff_hospital_id()
    or public.current_user_role() = 'system_admin'
  );

-- prescription_items -------------------------------------------------------------
drop policy if exists "prescription_items_select" on prescription_items;
create policy "prescription_items_select" on prescription_items
  for select to authenticated
  using (
    exists (
      select 1 from prescriptions p
      where p.id = prescription_items.prescription_id
        and (
          p.patient_id = public.current_patient_id()
          or p.hospital_id = public.current_staff_hospital_id()
          or public.current_user_role() = 'system_admin'
        )
    )
  );

drop policy if exists "prescription_items_insert" on prescription_items;
create policy "prescription_items_insert" on prescription_items
  for insert to authenticated
  with check (
    exists (
      select 1 from prescriptions p
      where p.id = prescription_items.prescription_id
        and p.hospital_id = public.current_staff_hospital_id()
        and public.current_user_role() = 'doctor'
    )
  );

-- drug_interactions -----------------------------------------------------------
drop policy if exists "drug_interactions_select" on drug_interactions;
create policy "drug_interactions_select" on drug_interactions
  for select to authenticated
  using (true);

drop policy if exists "drug_interactions_write_admin" on drug_interactions;
create policy "drug_interactions_write_admin" on drug_interactions
  for all to authenticated
  using (public.current_user_role() = 'system_admin')
  with check (public.current_user_role() = 'system_admin');

-- audit_logs --------------------------------------------------------------------
drop policy if exists "audit_logs_select" on audit_logs;
create policy "audit_logs_select" on audit_logs
  for select to authenticated
  using (
    patient_id = public.current_patient_id()
    or accessor_id = auth.uid()
    or public.current_user_role() = 'system_admin'
  );

drop policy if exists "audit_logs_insert" on audit_logs;
create policy "audit_logs_insert" on audit_logs
  for insert to authenticated
  with check (accessor_id = auth.uid());

-- ---------------------------------------------------------------------
-- 7. Seed data
-- ---------------------------------------------------------------------
insert into drug_interactions (drug_a, drug_b, severity, warning_message) values
('Aspirin', 'Warfarin', 'high', 'Concurrent use significantly increases the risk of severe bleeding events.'),
('Ibuprofen', 'Lisinopril', 'moderate', 'NSAIDs may decrease the antihypertensive efficacy of ACE inhibitors and increase renal impairment risk.'),
('Metformin', 'Contrast Dye', 'high', 'Risk of lactic acidosis. Metformin should be temporarily discontinued during procedures using iodinated contrast.')
on conflict do nothing;

-- A starter hospital so the sign-up dropdown isn't empty on a fresh
-- project. Feel free to edit/delete this from the System Admin dashboard
-- once you've signed up.
insert into hospitals (name, address, contact_number, registration_number)
select 'Kathmandu General Hospital', 'Baneshwor, Kathmandu, Nepal', '+977-1-4567890', 'REG-DEMO-0001'
where not exists (select 1 from hospitals);

-- =====================================================================
-- Done. Next steps:
--  1. In Supabase Auth settings, you may want to disable "Confirm email"
--     while developing so signUp() returns an active session immediately.
--  2. Copy your Project URL + anon key into .env (see .env.example).
--  3. Create your first account at /auth/signup. Choose "System
--     Administrator" for your own account so you can onboard hospitals
--     and manage the Guardian drug-interaction ruleset.
-- =====================================================================
