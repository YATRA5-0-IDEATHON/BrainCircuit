# Health Wallet + Smart Prescription Guardian

A unified QR-based digital health record system with a real-time,
cross-hospital drug-interaction safety engine ("the Guardian"), built with
Next.js (App Router) + Supabase (Postgres/Auth) + OneSignal push
notifications.

## Features

- **Unified auth** — one `profiles` table, four roles: `patient`, `doctor`,
  `hospital_admin`, `system_admin`, with role-based route protection in
  `middleware.ts`.
- **Patient Health Wallet** — QR code (encoding a secret token) plus blood
  group, allergies, emergency contacts, and full prescription history.
- **Doctor Scan + Prescribe** — camera-based QR scanning (native
  `BarcodeDetector` API, with manual token entry as a fallback for
  unsupported browsers), patient lookup, and a prescription builder.
- **Smart Prescription Guardian** — every new drug is checked server-side
  against the patient's *active* prescriptions and a `drug_interactions`
  rules table before it can be saved. Conflicts block submission and force
  the doctor to enter a clinical justification to override.
- **Hospital Admin** — staff roster with a Verify/Revoke action for doctor
  credentials.
- **System Admin** — onboard hospitals, manage the Guardian's drug-interaction
  rule set.
- **Push notifications (OneSignal)** — instant "new prescription" alert to
  the patient, plus an optional daily refill-reminder job.
- **Audit log** — every QR scan and prescription creation is recorded.
- **Row Level Security** — every table is locked down in Postgres, not just
  in application code (see `supabase/schema.sql`).

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com) (or use an
   existing one).
2. Open **SQL Editor** and run the entire contents of
   [`supabase/schema.sql`](./supabase/schema.sql). This creates every enum,
   table, index, RLS policy, and seeds the three demo drug-interaction rules
   plus one starter hospital ("Kathmandu General Hospital") so the sign-up
   form's hospital dropdown isn't empty.
3. Go to **Authentication → Providers** and make sure **Email** is enabled.
   While developing, you'll probably want to turn **Confirm email** off
   (Authentication → Settings) so `supabase.auth.signUp()` returns an active
   session immediately — otherwise the follow-up `profiles`/`patients`/
   `hospital_staff` insert on the sign-up page will fail because there's no
   session yet.
4. Copy your **Project URL**, **anon public key**, and **service_role key**
   from Project Settings → API.

## 2. Configure environment variables

Copy `.env.example` to `.env` (a working `.env` is already included in this
project, pointed at a live Supabase project — just fill in the
`SUPABASE_SERVICE_ROLE_KEY`):

```bash
cp .env.example .env
```

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Project Settings → API (anon/public key) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Project Settings → API — **keep secret**, used server-side only by the Guardian check and notifications APIs |
| `NEXT_PUBLIC_ONESIGNAL_APP_ID` | optional | From your OneSignal app. App runs fine without it — push notifications are just silently skipped. |
| `ONESIGNAL_REST_API_KEY` | optional | OneSignal Dashboard → Settings → Keys & IDs (this is **not** the App ID) |
| `CRON_SECRET` | optional | Any random string. Protects `GET /api/notifications` (the refill-reminder job) from being called by randoms. |

## 3. Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 4. First-time bootstrap flow

Because hospital staff need a hospital to attach to, and a system admin
needs to exist to onboard hospitals/manage Guardian rules, sign up in this
order:

1. Go to `/auth/signup` and create your own account as **System
   Administrator**. (No hospital selection is required for this role.)
2. Log in → you land on `/admin/dashboard`. Use **"Onboard New Hospital"**
   to add a real hospital (or just use the seeded demo hospital).
3. Sign up a second account as **Hospital Administrator**, selecting that
   hospital. Their account starts as unverified staff — that's expected.
4. Sign up a third account as **Doctor**, also selecting that hospital, with
   a medical license number.
5. As the patient, sign up a fourth account choosing **Patient** and fill in
   blood group / allergies / emergency contact. You'll land on
   `/patient/dashboard` and see your QR code.
6. Log in as the doctor → `/doctor/scan` → paste the patient's `qr_token`
   (visible under the QR code in Supabase's table editor, or scan it with
   your camera if your browser supports `BarcodeDetector`, e.g. Chrome) →
   you're taken to the prescribe screen.
7. Try prescribing **Aspirin**, then scan the same patient again and
   prescribe **Warfarin** — the Guardian should block submission with a
   high-severity interaction warning.

## Project structure

```
src/
├── app/
│   ├── api/
│   │   ├── check-interactions/   # Guardian rule engine (service-role, no RLS)
│   │   └── notifications/        # OneSignal push dispatch + refill-reminder cron
│   ├── auth/{login,signup}/
│   ├── patient/dashboard/
│   ├── doctor/{scan,prescribe}/
│   ├── hospital/dashboard/
│   └── admin/dashboard/
├── components/
│   ├── QRScanner.client.tsx        # Native BarcodeDetector camera scanner
│   ├── InteractionWarningModal.tsx # Guardian conflict/override modal
│   ├── OneSignalInit.tsx           # Links OneSignal device to Supabase user
│   └── LogoutButton.tsx
├── lib/
│   ├── supabase/{client,server}.ts # Browser / server / admin Supabase clients
│   └── onesignal.ts                # Push dispatch helper (external_id targeting)
└── middleware.ts                   # Role-based route protection
supabase/
└── schema.sql                      # Full schema + RLS policies + seed data
```

## Notes on the Guardian engine

`POST /api/check-interactions` takes `{ patient_id, new_drug_name }`, pulls
every drug in the patient's *active* prescriptions, and checks the
`drug_interactions` table for a match in either direction (case-insensitive).
It runs with the Supabase **service role** key so it can read across
hospitals — a patient's full medication history should be visible to any
treating doctor regardless of which hospital prescribed what, which is the
whole point of a unified Guardian system.

## Scheduling the refill-reminder job (optional)

`GET /api/notifications` scans active prescriptions whose free-text
`duration` (e.g. "5 days", "2 weeks") indicates the course ends within 24
hours, and sends a push reminder. Wire it up with any scheduler that can hit
a URL, e.g. [Vercel Cron](https://vercel.com/docs/cron-jobs):

```json
// vercel.json
{
  "crons": [
    { "path": "/api/notifications?secret=YOUR_CRON_SECRET", "schedule": "0 8 * * *" }
  ]
}
```

## Deploying

Deploy to [Vercel](https://vercel.com/new) (or any Next.js host) and set the
same environment variables in your hosting dashboard. Remember to also add
your production domain under Supabase → Authentication → URL Configuration.
