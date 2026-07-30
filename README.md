# Precifarm Ticketing & Payment CMS

Source of truth for PreciFarm **Digital Ticketing** and **Settlement & Reporting** on Nairobi–Kisumu.

The CMS owns passenger trips, seats, bookings, payments, tickets, agent operations, reconciliation, and audit records. Website and mobile consume the same API.

**Canonical business:** [`../kenya-ebus-ecosystem/docs/CANON.md`](../kenya-ebus-ecosystem/docs/CANON.md)  
**Booking agent:** [`../kenya-ebus-ecosystem/agents/passenger-booking/`](../kenya-ebus-ecosystem/agents/passenger-booking/)  
**CMS channel:** [`../kenya-ebus-ecosystem/docs/channels/cms.md`](../kenya-ebus-ecosystem/docs/channels/cms.md)

## Three-product mapping

| Product | CMS responsibility | Status |
|---|---|---|
| Reserved Route Charging | Receive charge-session records for settlement/reporting | **Target — not integrated** |
| Digital Ticketing | Trips, seats, bookings, M-Pesa, tickets, agent desk | **Actual — prototype built** |
| Settlement & Reporting | Reconciliation, refunds, statements, audit | **Partial actual — prototype; live operator settlement target** |

Cargo and last-mile modules exist in code. They are Stage 1 expansion capability, not current product, revenue, or traction.

---

## Status

**Phase A prototype running** — agent desk CMS on `http://localhost:3002`.

| Layer | Status |
|---|---|
| Agent desk UI | Dashboard, Quick Book, Cargo Book, **Delivery**, **Last Mile**, Bookings, Lookup, Customers, Cash Session, Reconciliation |
| Passenger booking | Seat map, National ID/Passport required, M-Pesa or cash at desk |
| Cargo booking | Waybill, sender/receiver ID, optional **last mile delivery** (+ KSh 500) |
| Delivery messaging | Stage-based SMS to sender & receiver (`/delivery`) — logged to `data/sms.log` |
| Last mile ops | Rider assignment & dispatch by destination city (`/last-mile`) |
| Public API | Routes, trips, seats, bookings, cargo, payments, **analytics ingest**, **SEO content**, health |
| Analytics | Ingest API, admin `/analytics`, daily aggregation — requires Postgres |
| SEO / AISO | Public `/api/v1/seo/*`, admin `/seo/*`, website guides/FAQ/locations — requires Postgres |
| Customer channels | **Website** (CMS proxy), **Mobile app** (direct API) — harmonized M-Pesa Express STK |
| Ops API | Deliveries, riders, last-mile, reconciliation, refunds (agent auth) |
| M-Pesa Express STK | Live Daraja when `DEMO_PAYMENT=false` + credentials; demo instant receipt otherwise |
| Cargo | ET01 module — 500 kg/departure, KSh 50/kg, last mile +KSh 500 |
| Storage | JSON file default; **PostgreSQL** with `app_store` blob + analytics/SEO tables |
| Reconciliation | Daily M-Pesa, cash, booking and SMS summary at `/reconciliation` |
| Lookup & refunds | Search by reference at `/lookup`; cancel/refund from agent desk |

### Quick start

```bash
npm install
npm run dev          # http://localhost:3002
npm run dev:clean    # stop port 3002, clear .next, restart (if cache errors)
npm run typecheck    # TypeScript check
npm run lint         # ESLint via next lint
npm run test:mpesa-auth   # Daraja OAuth (requires .env)
npm run test:stk          # Booking + M-Pesa Express STK smoke test
npm run tunnel:mpesa      # HTTPS tunnel for local STK callbacks
```

**Demo login:** `agent@precifarm.com` / `precifarm2026`

> Do not run `npm run build` while the dev server is running — the build script stops port 3002 first to avoid corrupting `.next`.

### PostgreSQL (recommended for analytics + SEO)

```bash
cp .env.example .env          # set SUPABASE_DB_PASSWORD or DATABASE_URL
npm run supabase:setup        # schema + seed + write DATABASE_URL
npm run supabase:seo          # SEO tables + website content seed
```

Without Postgres, the app uses JSON file store (`data/store.json`).

Storage model: [docs/STORAGE.md](./docs/STORAGE.md) — booking uses `app_store` JSON blob; analytics/SEO use relational tables.

### Public API (website integration)

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/routes` | Route list + fares |
| `GET /api/v1/routes/:id/trips?date=` | Departures + seat/cargo availability |
| `GET /api/v1/routes/:id/seats?date=&time=` | Seat map (website-compatible) |
| `POST /api/v1/bookings` | Create passenger booking |
| `POST /api/v1/cargo/bookings` | Create cargo waybill (optional last mile) |
| `POST /api/v1/payments/stk` | M-Pesa Express STK push |
| `GET /api/v1/payments/:bookingId/status` | Poll payment after live STK |
| `GET /api/v1/health` | Payment mode (`demo` · `live-sandbox` · `live-production`) |
| `GET /api/v1/bookings/:reference` | Lookup ticket or waybill |

### Ops API (agent session required)

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/ops/cargo/deliveries` | List cargo shipments by delivery stage |
| `POST /api/v1/ops/cargo/:ref/delivery-status` | Advance delivery stage + notify clients |
| `GET /api/v1/ops/riders` | List delivery riders (filter by `?city=`) |
| `GET /api/v1/ops/last-mile/deliveries` | Last mile queue (`?bucket=ready\|active\|upcoming\|completed`) |
| `POST /api/v1/ops/cargo/:ref/rider` | Assign rider; `{ dispatch: true }` to notify & dispatch |
| `GET /api/v1/ops/reconciliation?date=` | Daily reconciliation report |
| `POST /api/v1/ops/bookings/:ref/refund` | Cancel or refund booking |

---

## What this system does

| Capability | Description |
|---|---|
| **Passenger booking** | Reserved seats on scheduled intercity departures (launch route: Nairobi–Kisumu, Yutong U18) |
| **Cargo booking** | ET01 fleet cargo slots on the same route network |
| **Payments** | M-Pesa STK push, cash at desk, fleet invoicing (Phase 2) |
| **Sales desk** | Walk-in and call-in ticketing for agents |
| **Mobile PWA** | Self-service booking and digital tickets (Phase 2) |
| **Live website sync** | Public site reads schedules, availability, and fares from this API |
| **Operations** | Refunds, disruption handling, reconciliation, reporting |

---

## Relationship to other Precifarm repos

| Repository | Role |
|---|---|
| [`kenya-ebus-ecosystem`](../kenya-ebus-ecosystem) | Canon, product/channel docs, public website |
| [`kenya-ebus-ecosystem/website`](../kenya-ebus-ecosystem/website) | Next.js public site — **CMS proxy wired** when `CMS_API_URL` is set |
| [`Precifarm Mobile App`](../../Desktop/Precifarm%20Mobile%20App) | Native Expo app — bus + cargo + track via CMS; see [mobile CMS integration](../../Desktop/Precifarm%20Mobile%20App/docs/CMS_INTEGRATION.md) |
| **`Ticketing and Payment CMS` (this repo)** | Production API, database, agent desk, cargo module |

**Strategy source of truth:** [`docs/CANON.md`](../kenya-ebus-ecosystem/docs/CANON.md).

---

## Documentation index

| # | Document | Contents |
|---|---|---|
| — | [Deploy — Cloud Run](./docs/DEPLOY-CLOUD-RUN.md) | **Production** GCP deploy |
| — | [Deploy — Supabase DB](./docs/DEPLOY-SUPABASE.md) | PostgreSQL setup (dev/staging) |
| — | [Storage](./docs/STORAGE.md) | app_store blob vs relational tables |
| — | [Analytics](./docs/ANALYTICS.md) | Ingest API + aggregation |
| — | [SEO / AISO](./docs/SEO.md) | Content API for website |
| 1 | [Project specification](./docs/PROJECT_SPECIFICATION.md) | Vision, scope, phases |
| 2 | [Data model](./docs/DATA_MODEL.md) | Schema spec (forward-looking) |
| 3 | [API reference](./docs/API_REFERENCE.md) | REST endpoints |
| 4 | [Channels & workflows](./docs/CHANNELS_AND_WORKFLOWS.md) | User journeys |
| 5 | [Payments & settlement](./docs/PAYMENTS_AND_SETTLEMENT.md) | M-Pesa, reconciliation |
| 6 | [Integrations](./docs/INTEGRATIONS.md) | Website, mobile, Daraja |
| 7 | [Security & compliance](./docs/SECURITY_AND_COMPLIANCE.md) | Auth, RBAC |

Ecosystem: [workflows](../../kenya-ebus-ecosystem/docs/infrastructure/workflows.md) · [database](../../kenya-ebus-ecosystem/docs/infrastructure/database.md)

---

## Launch route (Phase A)

| Field | Value |
|---|---|
| Route | Nairobi → Kisumu |
| Vehicle | Yutong U18 intercity coach |
| Fare | KSh 1,550 per seat |
| Departures | 06:00, 08:00, 10:00, 14:00, 16:00 |
| Seat layout | 12 rows × 4 seats (48 total) |
| Booking reference | `PF-XXXXXX` (passenger), `PF-CXXXXX` (cargo) |
| Last mile fee | KSh 500 (optional on cargo) |

Cargo (ET01 electric van) follows the same route network — see [Channels & workflows](./docs/CHANNELS_AND_WORKFLOWS.md).

---

## Recommendations (next priorities)

Ordered by impact for completing Phase A (**discover → book → pay → reconcile**):

| Priority | Item | Why |
|---|---|---|
| **1** | **Normalized booking storage** | Migrate services from `app_store` JSON blob to Drizzle tables |
| **2** | **Cloud SQL production** | Complete Cloud Run + Cloud SQL migration — see DEPLOY-CLOUD-RUN.md |
| **3** | **GCP analytics cron** | Cloud Scheduler → `/api/v1/analytics/aggregate` |
| **4** | **Live SMS provider** | Messages log to `data/sms.log` only |
| **5** | **Agent auth hardening** | MFA and RBAC before multi-branch rollout |

### Dev & ops tips

- Use `npm run dev:clean` after build errors or stale webpack/Turbopack cache on Windows.
- Seed riders are auto-created in `data/store.json` on first run (Nairobi + Kisumu).
- Last mile dispatch requires cargo at **Arrived** stage and a rider in the destination city.

### Deferred to Phase B+

- Passenger PWA, fleet invoicing, card payments, QR boarding scan, automated M-Pesa reversals, CSMS/telematics integrations.

---

## Phase A goal (0–90 days)

From the master document technology milestone:

> **Discover → book → pay → reconcile**

Ship: core API + PostgreSQL, agent desk (walk-in/call-in), M-Pesa integration, SMS tickets, website live sync.

**Built in this repo so far:** agent desk (passenger + cargo), live/demo M-Pesa Express STK, SMS logging (waybill + delivery stages), delivery & last-mile ops, reconciliation, JSON store with Postgres schema ready.

**Customer channels connected:** e-bus website (CMS proxy + STK poll), native mobile app (direct API, bus + cargo). **Still to ship for Phase A close-out:** production database, live SMS, stable production callbacks, regulatory sign-off.

---

## Contact

- **Email:** sales@precifarm.com  
- **Phone:** +254 794 702 768  
- **Website:** https://precifarm.com

---

## Related reading

- [Kenya e-bus ecosystem README](../kenya-ebus-ecosystem/README.md)
- [Website developer README](../kenya-ebus-ecosystem/website/README.md)
- [Website agent notes](../kenya-ebus-ecosystem/website/AGENTS.md)
