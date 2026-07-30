# CMS Agent Rules

## Read first

**Passenger booking:** [`../kenya-ebus-ecosystem/agents/passenger-booking/AGENTS.md`](../kenya-ebus-ecosystem/agents/passenger-booking/AGENTS.md)

**Business rules:** [`../kenya-ebus-ecosystem/docs/CANON.md`](../kenya-ebus-ecosystem/docs/CANON.md)

**Workflows:** [`../kenya-ebus-ecosystem/docs/infrastructure/workflows.md`](../kenya-ebus-ecosystem/docs/infrastructure/workflows.md)

## Three products (this repo)

| Product | CMS role |
|---|---|
| **Reserved Route Charging** | Future: charge sessions *(not live)* |
| **Digital Ticketing** | Source of truth: trips, seats, bookings, tickets, M-Pesa |
| **Settlement & Reporting** | Reconciliation, refunds, cash sessions, audit |

## Scope for booking changes

- Nairobi–Kisumu passenger flow only unless explicitly instructed
- Public API: `src/app/api/v1/**`
- Agent desk: Quick Book, bookings, lookup, cash session, reconciliation
- Do not break website or mobile API contracts

## Storage (read before DB changes)

| Layer | Path | Notes |
|---|---|---|
| Selector | `src/db/index.ts` | JSON file vs PostgreSQL |
| Document store | `src/db/store.ts`, `src/db/postgres-store.ts` | Booking runtime — `app_store.data` blob |
| Schema | `src/db/schema.ts` | Analytics + SEO relational; core tables forward-looking |

See `docs/STORAGE.md`.

## Key paths

| Area | Path |
|---|---|
| Public API | `src/app/api/v1/` |
| Analytics | `src/lib/analytics/`, `/api/v1/analytics/*`, admin `/analytics` |
| SEO | `src/lib/seo/`, `/api/v1/seo/*`, admin `/seo/*` |
| M-Pesa | `src/lib/mpesa.ts` |
| Quick Book | `src/app/(app)/quick-book/` |
| Reconciliation | `src/app/(app)/reconciliation/` |

## Supabase / database commands

```bash
npm run supabase:setup     # Postgres + seed app_store
npm run supabase:seo       # SEO tables + content
npm run db:push            # schema only
npm run analytics:aggregate
```

Secrets in `.env` only — see `.env.example` and ecosystem `docs/infrastructure/environment.md`.

## Docs before API changes

- `docs/API_REFERENCE.md`
- `docs/PAYMENTS_AND_SETTLEMENT.md`
- `docs/ANALYTICS.md` / `docs/SEO.md` for new ingest or content endpoints

## Deploy

Production: **Cloud Run** — `docs/DEPLOY-CLOUD-RUN.md`. Netlify/Vercel deprecated.

## Commands

```bash
npm run dev          # :3002
npm run typecheck
npm run lint
```

Demo login: `agent@precifarm.com` / `precifarm2026`
