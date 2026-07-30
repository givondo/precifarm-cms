# Storage architecture

How the CMS persists data today and what is planned.

---

## Modes

| Mode | Trigger | Location | Survives restart |
|---|---|---|---|
| **JSON file** | No `DATABASE_URL` / `SUPABASE_DB_PASSWORD` | `data/store.json` (or `/tmp` on serverless) | File only |
| **PostgreSQL** | `DATABASE_URL` or password-based URL | `app_store.data` JSONB row | Yes |

Selector: `src/db/index.ts` → `getStore()` / `mutateStore()` in `src/db/store.ts` or `src/db/postgres-store.ts`.

**Health:** `GET /api/v1/health` → `storageBackend: "json-file" | "postgresql"`.

---

## Document store (booking runtime)

All passenger booking, cargo, payments, agents, and desk operations use a **single JSON document**:

```text
app_store
  id: "default"
  data: { trips, bookings, payments, agents, riders, ... }
```

This is intentional for Phase A speed. The shape matches `data/store.json` exactly.

**Implication:** Drizzle tables like `bookings`, `seat_inventory`, and `trips` exist in schema and are seeded on setup, but **booking services do not read them yet**. Normalized migration is future work.

---

## Relational tables (active)

When PostgreSQL is connected, these domains use real tables:

### Analytics

`analytics_events`, `analytics_identity`, `analytics_acquisition`, `analytics_daily_metrics`, `analytics_errors`, `analytics_audit_log`, `contact_submissions`

Requires: `DATABASE_URL` + `ANALYTICS_INGEST_ENABLED` (default on when Postgres available).

### SEO / AISO

`seo_entities`, `seo_content`, `seo_embeddings`, `seo_metrics`, `seo_search_queries`, `seo_competitor_snapshots`, …

Powers public `/api/v1/seo/*` and website `/guides`, `/faq`, `/locations`.

Setup: `npm run supabase:seo`

---

## Setup commands

```bash
# JSON file only (default)
npm run dev

# PostgreSQL via Supabase
npm run supabase:setup

# PostgreSQL via local Docker (port 5433)
docker compose up -d
# DATABASE_URL=postgresql://postgres:postgres@localhost:5433/precifarm
npm run db:push && npm run db:seed
```

---

## Production (Cloud SQL)

Same `app_store` blob model on Cloud SQL until normalized migration. Connection via Secret Manager `DATABASE_URL` on Cloud Run.

See: [`kenya-ebus-ecosystem/docs/infrastructure/database.md`](../../kenya-ebus-ecosystem/docs/infrastructure/database.md)

---

## Future: normalized booking

Priority roadmap item — migrate `services.ts` from JSON blob to Drizzle `bookings` / `seat_inventory` / `trips` tables with transactions and row-level locking.

Until then, treat **`app_store.data` as source of truth** for inventory integrity testing.
