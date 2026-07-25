# Precifarm CMS — Supabase database + Netlify app

Supabase hosts the **PostgreSQL database** (persistent bookings, payments, agents). The **Next.js CMS app** still runs on Netlify (or Vercel) and connects to Supabase via `DATABASE_URL`.

```
Website / Mobile app
        │
        ▼
   Netlify (CMS Next.js)
        │
        ▼
   Supabase PostgreSQL  ← persistent store
```

## 1. Supabase project

Your project (from dashboard):

| Setting | Value |
|---------|--------|
| Project ID | `wvqkhvimsxgyxryehnom` |
| Region | West EU (Ireland) |

In Supabase: **Project Settings → Database → Connection string → URI**

Use the **Transaction pooler** string (port **6543**) for serverless Netlify:

```
postgresql://postgres.wvqkhvimsxgyxryehnom:[YOUR-PASSWORD]@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
```

Replace `[YOUR-PASSWORD]` with the database password you set when creating the project.

## 2. Push schema (one time, from your PC)

In the CMS folder, add to `.env`:

```env
DATABASE_URL=postgresql://postgres.wvqkhvimsxgyxryehnom:YOUR_PASSWORD@aws-0-eu-west-1.pooler.supabase.com:6543/postgres
```

Then run:

```bash
npm run db:push
npm run db:seed
```

- `db:push` creates all tables including `app_store` (JSON document for bookings/data).
- `db:seed` inserts default route, departures, and demo agents if empty.

## 3. Netlify environment variables

In **Netlify → Site → Environment variables**, add:

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Same Supabase pooler URI as `.env` — **must be URL-encoded** (e.g. `#` → `%23`). Copy from `.env` after `npm run supabase:setup`, do not paste the raw password. |
| `DEMO_PAYMENT` | `false` (for live M-Pesa) |
| `MPESA_*` | Your Daraja credentials (see `.env.example`) |
| `MPESA_CALLBACK_URL` | `https://YOUR-CMS-DOMAIN/api/v1/payments/mpesa/callback` |

Redeploy after saving env vars.

## 4. Verify

Open:

```
GET https://YOUR-CMS-DOMAIN/api/v1/health
```

Expected:

```json
{
  "data": {
    "ok": true,
    "storageBackend": "postgresql",
    "databaseConfigured": true,
    ...
  }
}
```

Log in at `/login` with `agent@precifarm.com` / `precifarm2026` (seeded on first request if DB was empty).

## 5. Website + mobile

Point the website and mobile app API URL at the Netlify CMS host:

```
CMS_API_URL=https://YOUR-CMS-DOMAIN/api
EXPO_PUBLIC_API_URL=https://YOUR-CMS-DOMAIN/api
```

## Notes

- **Supabase does not host Next.js** — only the database. Keep Netlify for the CMS UI and API routes.
- Use the **pooler** URL (6543), not the direct connection (5432), on Netlify serverless functions.
- Data lives in Supabase; redeploys and cold starts no longer wipe bookings.
- For production hardening later: migrate from JSON `app_store` blob to normalized Drizzle tables (schema already defined in `src/db/schema.ts`).
