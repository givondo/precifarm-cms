# Metabase setup (Precifarm analytics)

Connect Metabase to your Supabase PostgreSQL read-only user for executive dashboards on top of Phase 4 SQL views.

## Prerequisites

- Supabase project: `wvqkhvimsxgyxryehnom` (eu-west-1)
- CMS analytics tables pushed: `npm run db:push`
- SQL views applied: `npm run analytics:views`

## 1. Create a read-only database user (Supabase)

In Supabase SQL editor:

```sql
-- Replace YOUR_STRONG_PASSWORD
create user metabase_ro with password 'YOUR_STRONG_PASSWORD';

grant connect on database postgres to metabase_ro;
grant usage on schema public to metabase_ro;
grant select on all tables in schema public to metabase_ro;
grant select on all sequences in schema public to metabase_ro;

alter default privileges in schema public
  grant select on tables to metabase_ro;
```

Optional: restrict to analytics objects only:

```sql
grant select on
  analytics_events,
  analytics_daily_metrics,
  analytics_acquisition,
  analytics_errors,
  contact_submissions
to metabase_ro;

grant select on
  vw_paid_seats_daily,
  vw_revenue_daily,
  vw_daily_active_users,
  vw_analytics_event_counts_daily,
  vw_website_funnel,
  vw_payment_funnel,
  vw_acquisition_by_source,
  vw_error_event_summary
to metabase_ro;
```

## 2. Connection settings in Metabase

| Field | Value |
|---|---|
| Database type | PostgreSQL |
| Host | `aws-0-eu-west-1.pooler.supabase.com` |
| Port | `5432` (session pooler) |
| Database | `postgres` |
| Username | `metabase_ro` |
| Password | (from step 1) |
| SSL | Required |

Use **session mode** (port 5432), not transaction pooler (6543).

## 3. Recommended starter questions

| Question | Source |
|---|---|
| Paid seats trend (30d) | `vw_paid_seats_daily` |
| GBV trend | `vw_revenue_daily` |
| DAU | `vw_daily_active_users` |
| Website funnel | `vw_website_funnel` |
| Acquisition by source | `vw_acquisition_by_source` |
| Error volume | `vw_error_event_summary` |

Filter all dashboards by `environment = 'production'`.

## 4. North Star dashboard (executive)

Panels:

1. **Paid passenger seats** — line chart from `vw_paid_seats_daily`
2. **GBV** — line chart from `vw_revenue_daily`
3. **Channel mix** — `analytics_daily_metrics` where `metric_name = 'paid_seats'` and `dimensions->>'channel'` is not null
4. **Payment health** — `vw_payment_funnel`
5. **Contact leads** — count from `contact_submissions` by week

## 5. CMS admin vs Metabase

| Audience | Tool |
|---|---|
| Ops / agents | CMS `/analytics` (live, admin login) |
| Leadership / marketing | Metabase (read-only, scheduled email) |
| Engineering | Metabase errors + optional Sentry |

## 6. Hosting Metabase

Options:

- [Metabase Cloud](https://www.metabase.com/cloud/) (fastest)
- Self-host on Railway/Fly with same Supabase connection
- Do **not** expose Supabase service role to Metabase — use `metabase_ro` only

## Security notes

- Never connect Metabase with `postgres` superuser or `SUPABASE_DB_PASSWORD`
- Do not sync PII columns (`contact_submissions.message`, booking tables) to public dashboards
- Use row-level filters on `environment`
