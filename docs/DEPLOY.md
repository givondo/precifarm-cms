# Precifarm Ticketing CMS — deploy

## GitHub

Repository: `givondo/precifarm-cms` (after push)

## Vercel (recommended for Next.js)

> **Note:** If Vercel billing is inactive, use Netlify below or reactivate at vercel.com → Settings → Billing.

1. Import `givondo/precifarm-cms` at [vercel.com/new](https://vercel.com/new)
2. Set **Root Directory** to repo root
3. Add environment variables from `.env.example` (production values in Vercel dashboard only)
4. Deploy — note the URL (e.g. `https://precifarm-cms.vercel.app`)
5. Optional custom domain: `cms.precifarm.co.ke` or `api.precifarm.com`

### Required production env vars

| Variable | Example |
|----------|---------|
| `DEMO_PAYMENT` | `false` |
| `MPESA_CONSUMER_KEY` | from Daraja portal |
| `MPESA_CONSUMER_SECRET` | from Daraja portal |
| `MPESA_PASSKEY` | Lipa Na M-Pesa passkey |
| `MPESA_SHORTCODE` | paybill number |
| `MPESA_CALLBACK_URL` | `https://YOUR-CMS-HOST/api/v1/payments/mpesa/callback` |
| `MPESA_ENVIRONMENT` | `production` |

Health check: `GET /api/v1/health`

## Netlify (alternative — precifarm.com already uses Netlify)

1. [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import from Git** → `givondo/precifarm-cms`
2. Build: `npm run build`, publish handled by `@netlify/plugin-nextjs`
3. Site settings → Environment variables → add M-Pesa vars from `.env.example`
4. Optional domain: `cms.precifarm.co.ke` or subdomain under precifarm.com

## Website connection

Set on the **website** Vercel project:

```
CMS_API_URL=https://YOUR-CMS-HOST/api
```

Mobile app EAS:

```
EXPO_PUBLIC_API_URL=https://YOUR-CMS-HOST/api
```
