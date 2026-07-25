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

Use the **Transaction pooler** string (port **6543**) for serverless Netlify. Copy the URI from Supabase → **Connect** (replace `[YOUR-PASSWORD]` with your database password, URL-encoded).

## 2. Push schema (one time, from your PC)

Add to `.env`:

```env
SUPABASE_DB_PASSWORD="your-database-password"
```

Then run:

```bash
npm run supabase:setup
```

This pushes the schema, seeds demo data, and writes the encoded `DATABASE_URL` to `.env` locally.

## 3. Netlify environment variables

In **Netlify → Site → Environment variables**, add:

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Copy from local `.env` after `npm run supabase:setup`. **Scopes: Functions only** — do **not** include Builds (avoids Netlify secrets scan failures). |
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
