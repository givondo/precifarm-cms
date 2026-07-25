# Analytics ingest (Phase 2)

CMS exposes a first-party analytics ingest API. Events are stored in PostgreSQL when `DATABASE_URL` or `SUPABASE_DB_PASSWORD` is configured.

Full architecture: `kenya-ebus-ecosystem/docs/analytics/`

## Setup

```bash
npm run db:push   # creates analytics_* tables
```

## Ingest API

**POST** `/api/v1/analytics/events`

Single event:

```json
{
  "event_id": "550e8400-e29b-41d4-a716-446655440000",
  "event_name": "website_page_viewed",
  "schema_version": 1,
  "event_timestamp": "2026-07-25T12:00:00.000Z",
  "anonymous_id": "550e8400-e29b-41d4-a716-446655440001",
  "session_id": "550e8400-e29b-41d4-a716-446655440002",
  "platform": "web",
  "environment": "production",
  "event_properties": { "page": "/" }
}
```

Batch:

```json
{
  "events": [ { "...": "..." } ]
}
```

**GET** `/api/v1/analytics/events` — ingest health (`postgres`, `environment`).

Optional header: `X-Analytics-Key` when `ANALYTICS_INGEST_KEY` is set in env.

## Server-side events (automatic)

Emitted from booking/payment flows:

- `booking_created`, `booking_paid`
- `payment_initiated`, `payment_succeeded`, `payment_failed`
- `identity_merged` (when booking includes `analytics.anonymousId`)

## Booking attribution

Pass optional `analytics` on `POST /api/v1/bookings`:

```json
{
  "analytics": {
    "anonymousId": "...",
    "sessionId": "...",
    "acquisitionSource": "google",
    "acquisitionMedium": "cpc",
    "acquisitionCampaign": "nairobi-kisumu-launch"
  }
}
```

## Environment variables

| Variable | Purpose |
|---|---|
| `ANALYTICS_ENVIRONMENT` | `development` / `staging` / `production` |
| `ANALYTICS_INGEST_ENABLED` | Set `false` to disable ingest |
| `ANALYTICS_INGEST_KEY` | Optional shared secret for clients |
| `ANALYTICS_CRON_KEY` | Optional secret for scheduled aggregation (`X-Analytics-Cron-Key`) |

---

## Phase 4 — Aggregation + dashboard

### Setup

```bash
npm run db:push              # analytics_* tables (if not already)
npm run analytics:views      # SQL views for Metabase / BI
npm run analytics:aggregate  # backfill daily metrics (yesterday + today)
```

Single date or range:

```bash
npm run analytics:aggregate -- 2026-07-20
npm run analytics:aggregate -- 2026-07-01 2026-07-25
```

### Daily metrics

Written to `analytics_daily_metrics` (idempotent per date + environment):

- `paid_seats`, `gbv`, `bookings_created`, `new_customers`
- `paid_seats` / `gbv` by `channel` dimension
- `payments_succeeded`, `payments_failed`
- `event_count` by `event_name`, `active_users` (when Postgres events exist)

Transactional metrics come from the CMS store; event metrics from `analytics_events`.

### SQL views (`drizzle/analytics-views.sql`)

| View | Purpose |
|---|---|
| `vw_paid_seats_daily` | North Star trend |
| `vw_revenue_daily` | GBV trend |
| `vw_daily_active_users` | DAU from events |
| `vw_analytics_event_counts_daily` | Event volume |
| `vw_website_funnel` | Website funnel steps |
| `vw_payment_funnel` | Payment events |
| `vw_acquisition_by_source` | First-touch UTM |
| `vw_error_event_summary` | Error events |

### Admin dashboard

**UI:** `/analytics` (admin role only)

**API:** `GET /api/v1/analytics/dashboard?days=30` — session admin required

Returns North Star, revenue by channel, funnel, acquisition, payment health, trend, top events.

### Manual / cron aggregation

**POST** `/api/v1/analytics/aggregate`

Admin session, or header `X-Analytics-Cron-Key` when `ANALYTICS_CRON_KEY` is set (aggregates yesterday + today).

Body (optional):

```json
{ "date": "2026-07-25" }
```

or `{ "start": "2026-07-01", "end": "2026-07-25" }`.

---

## Phase 5 — Operations + BI

### Scheduled daily aggregation (Netlify)

Function: `netlify/functions/analytics-daily.mjs` — runs at **03:00 UTC** (06:00 EAT).

Requires Netlify env:

```
ANALYTICS_CRON_KEY=your-random-secret
```

The function POSTs to `/api/v1/analytics/aggregate` with header `X-Analytics-Cron-Key`.

Manual test: `npm run analytics:cron` (Netlify CLI).

### Contact form

**POST** `/api/v1/contact` — public, rate-limited (5/min/IP)

Stores in `contact_submissions` and emits `website_contact_submitted` (interest only — no PII in event).

Website proxies via `POST /api/contact` when `CMS_API_URL` is set.

### Error ingest

**POST** `/api/v1/analytics/errors` — same auth as events ingest

Website proxy: `POST /api/analytics/errors`

Mobile: `trackClientError()` in `lib/analytics.ts`

See [SENTRY_SETUP.md](./SENTRY_SETUP.md) for optional Sentry alongside first-party errors.

### Metabase / BI

See [METABASE_SETUP.md](./METABASE_SETUP.md) — connect read-only user to Supabase + Phase 4 SQL views.
