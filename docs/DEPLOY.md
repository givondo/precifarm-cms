# Precifarm Ticketing CMS — deploy

> **Production (2026-07):** [DEPLOY-CLOUD-RUN.md](./DEPLOY-CLOUD-RUN.md) — Google Cloud Run at `api.precifarm.com`.  
> **Database:** [DEPLOY-SUPABASE.md](./DEPLOY-SUPABASE.md) or Cloud SQL — host-agnostic PostgreSQL setup.

Netlify and Vercel are **deprecated** for new deploys.

---

## Recommended path

| Step | Document |
|---|---|
| 1. PostgreSQL | [DEPLOY-SUPABASE.md](./DEPLOY-SUPABASE.md) (dev/staging) or Cloud SQL (production) |
| 2. App host | [DEPLOY-CLOUD-RUN.md](./DEPLOY-CLOUD-RUN.md) |
| 3. Website link | Set `CMS_API_URL` on website Cloud Run — [ecosystem DEPLOY-GCP](../../kenya-ebus-ecosystem/website/docs/DEPLOY-GCP.md) |

---

## Verify after deploy

```bash
curl https://api.precifarm.com/api/v1/health
```

Expect: `paymentMode`, `storageBackend`, `analyticsPostgres`.

---

## Legacy hosts (do not use for new deploys)

<details>
<summary>Vercel / Netlify (deprecated)</summary>

These were used during early prototyping. `netlify.toml` and Netlify scheduled functions remain in repo for reference only.

- Vercel: import repo, set env from `.env.example`
- Netlify: `npm run build:netlify`, see `DEPLOY-SUPABASE.md` for DB env vars

Migrate to Cloud Run — see [DEPLOY-CLOUD-RUN.md](./DEPLOY-CLOUD-RUN.md).

</details>

---

## Channel connection

**Website** (`kenya-ebus-ecosystem/website`):

```env
CMS_API_URL=https://api.precifarm.com/api
```

**Mobile** (`Precifarm Mobile App`):

```env
EXPO_PUBLIC_API_URL=https://api.precifarm.com/api
EXPO_PUBLIC_USE_MOCK=false
```

Secrets: [ecosystem environment.md](../../kenya-ebus-ecosystem/docs/infrastructure/environment.md)
