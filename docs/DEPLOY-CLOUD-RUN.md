# Deploy CMS to Google Cloud Run

**Production target** for `precifarm-cms` at `https://api.precifarm.com`.

Netlify and Vercel are **deprecated** for this service. Supabase or Cloud SQL provides PostgreSQL — the app host is Cloud Run.

Cross-repo guide: [`kenya-ebus-ecosystem/website/docs/DEPLOY-GCP.md`](../../kenya-ebus-ecosystem/website/docs/DEPLOY-GCP.md)

---

## Architecture

```text
api.precifarm.com → precifarm-cms (europe-west1)
                         │
                         └── Cloud SQL PostgreSQL (africa-south1)
                             via Secret Manager DATABASE_URL
```

---

## Prerequisites

1. GCP project with billing
2. `gcloud` CLI authenticated
3. Database ready (Cloud SQL or Supabase URI in Secret Manager)
4. Daraja credentials in Secret Manager (production)

---

## One-time setup

Enable APIs and Artifact Registry (see ecosystem DEPLOY-GCP §1).

Create secrets from your local `.env` — **never paste values into docs**:

| Secret name | Env var |
|---|---|
| `precifarm-database-url` | `DATABASE_URL` |
| `precifarm-demo-payment` | `DEMO_PAYMENT` |
| `precifarm-mpesa-consumer-key` | `MPESA_CONSUMER_KEY` |
| `precifarm-mpesa-consumer-secret` | `MPESA_CONSUMER_SECRET` |
| `precifarm-mpesa-passkey` | `MPESA_PASSKEY` |
| `precifarm-mpesa-shortcode` | `MPESA_SHORTCODE` |
| `precifarm-mpesa-callback-url` | `MPESA_CALLBACK_URL` |
| `precifarm-mpesa-environment` | `MPESA_ENVIRONMENT` |

Optional (analytics / SEO):

| Secret | Env var |
|---|---|
| `precifarm-analytics-ingest-key` | `ANALYTICS_INGEST_KEY` |
| `precifarm-analytics-cron-key` | `ANALYTICS_CRON_KEY` |
| `precifarm-openai-api-key` | `OPENAI_API_KEY` |

Grant Cloud Run service account `roles/secretmanager.secretAccessor`.

---

## Deploy

```powershell
cd "Ticketing and Payment CMS"
gcloud builds submit --config cloudbuild.yaml
```

`cloudbuild.yaml` builds Docker image → `africa-south1` Artifact Registry → deploys `precifarm-cms` to **`europe-west1`** (domain mapping region).

### Cloud SQL attachment

Production deploy must include:

```powershell
--add-cloudsql-instances=PROJECT:africa-south1:precifarm-db
--set-secrets=DATABASE_URL=precifarm-database-url:latest,...
```

---

## Database migration (after first deploy)

With Cloud SQL Auth Proxy or authorized network:

```bash
npm run db:push
npm run db:seed          # if empty
npm run supabase:seo     # SEO tables (works on Cloud SQL)
npm run analytics:views
```

---

## Custom domain

```powershell
gcloud run domain-mappings create `
  --service precifarm-cms `
  --domain api.precifarm.com `
  --region europe-west1
```

DNS: CNAME `api` → `ghs.googlehosted.com` (Hostinger). See ecosystem DEPLOY-GCP §5.

---

## Verify

```bash
curl https://api.precifarm.com/api/v1/health
```

Expect JSON with `paymentMode`, `storageBackend`, `analyticsPostgres`.

---

## Scheduled jobs (GCP)

Replace Netlify `analytics-daily` function with **Cloud Scheduler**:

| Job | Endpoint | Schedule |
|---|---|---|
| Analytics aggregate | `POST /api/v1/analytics/aggregate` | `0 3 * * *` UTC |
| SEO metrics (optional) | `POST /api/v1/seo/metrics` | daily |

Header: `X-Analytics-Cron-Key: <ANALYTICS_CRON_KEY>` or `X-Seo-Cron-Key` per route.

---

## Bootstrap deploy (demo only)

`cloudbuild.bootstrap.yaml` — deploys with `DEMO_PAYMENT=true` and no secrets for initial smoke test. Not for production.

---

## Related

- [DEPLOY-SUPABASE.md](./DEPLOY-SUPABASE.md) — database setup (host-agnostic)
- [STORAGE.md](./STORAGE.md) — app_store vs relational tables
- [ANALYTICS.md](./ANALYTICS.md) — ingest + aggregation
- [SEO.md](./SEO.md) — content API for website
