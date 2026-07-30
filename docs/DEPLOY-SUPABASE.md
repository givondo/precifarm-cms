# Precifarm CMS — PostgreSQL setup (Supabase or any Postgres host)

Supabase provides **managed PostgreSQL** for development, staging, analytics, and SEO. The CMS app connects via `DATABASE_URL` — the **app host is separate** (Cloud Run in production).

```
Website / Mobile app
        │
        ▼
   Cloud Run (CMS Next.js)     ← production host
        │
        ▼
   PostgreSQL                   ← Supabase (dev) or Cloud SQL (prod)
```

> **Production target:** Cloud SQL in `africa-south1` with Secret Manager — same schema and commands as below. See [DEPLOY-CLOUD-RUN.md](./DEPLOY-CLOUD-RUN.md).

---

## 1. Create / open Supabase project

In [Supabase dashboard](https://supabase.com/dashboard):

1. Create or open your project
2. **Project Settings → Database** — note region and database password
3. **Connect → Transaction pooler** (port **6543**) for serverless/Cloud Run

**Do not commit** project ref, password, or full URI — store only in `.env`.

---

## 2. Configure CMS `.env`

```bash
cp .env.example .env
```

Set **one of**:

```env
SUPABASE_DB_PASSWORD=your-database-password
```

or full pooler URI:

```env
DATABASE_URL=postgresql://postgres.<PROJECT_REF>:<PASSWORD>@aws-0-<REGION>.pooler.supabase.com:6543/postgres
```

---

## 3. Push schema and seed

```bash
npm run supabase:setup
```

This runs:

- `drizzle-kit push` (all tables including `app_store`, analytics, SEO)
- `seed-postgres.ts` (demo bookings in `app_store` blob)
- Writes encoded `DATABASE_URL` to `.env` (local only)

### SEO / AISO (required for website content pages)

```bash
npm run supabase:seo
```

Adds SEO tables, entities, guides, Swahili FAQ, local page drafts.

Also set:

```env
NEXT_PUBLIC_SITE_URL=https://precifarm.com
```

### Analytics views (Metabase)

```bash
npm run analytics:views
```

---

## 4. Verify locally

```bash
npm run dev
curl http://localhost:3002/api/v1/health
```

Expect `storageBackend: "postgresql"`, `analyticsPostgres: true`.

---

## 5. Production env vars (Cloud Run)

Store in **GCP Secret Manager** — not Netlify dashboard:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Cloud SQL socket URI or Supabase pooler |
| `DEMO_PAYMENT` | `false` for live M-Pesa |
| `MPESA_*` | Daraja credentials |
| `ANALYTICS_INGEST_KEY` | Match website |
| `OPENAI_API_KEY` | SEO embeddings |

See [ecosystem environment.md](../../kenya-ebus-ecosystem/docs/infrastructure/environment.md).

---

## 6. Storage model

PostgreSQL stores booking state in **`app_store.data` JSONB** (same as local JSON file). Analytics and SEO use relational tables.

See [STORAGE.md](./STORAGE.md) and [ecosystem database.md](../../kenya-ebus-ecosystem/docs/infrastructure/database.md).

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Connection refused | Use pooler port 6543, not direct 5432, on serverless |
| Analytics disabled | Run `supabase:setup`; check health `analyticsPostgres` |
| Website guides 404 | Run `supabase:seo`; ensure website `CMS_API_URL` set |
| DDL fails on push | Use session pooler :5432 for `db:push` (see `drizzle.config.ts`) |

---

## Related

- [DEPLOY-CLOUD-RUN.md](./DEPLOY-CLOUD-RUN.md)
- [SEO.md](./SEO.md)
- [ANALYTICS.md](./ANALYTICS.md)
