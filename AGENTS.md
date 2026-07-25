# CMS Agent Rules

## Read first

**Passenger booking:** [`../kenya-ebus-ecosystem/agents/passenger-booking/AGENTS.md`](../kenya-ebus-ecosystem/agents/passenger-booking/AGENTS.md)

**Business rules:** [`../kenya-ebus-ecosystem/docs/CANON.md`](../kenya-ebus-ecosystem/docs/CANON.md)

**Channel doc:** [`../kenya-ebus-ecosystem/docs/channels/cms.md`](../kenya-ebus-ecosystem/docs/channels/cms.md)

## Three products (this repo)

| Product | CMS role |
|---|---|
| **1. Reserved Route Charging** | Future: charge sessions, windows, uptime *(not live)* |
| **2. Digital Ticketing** | Source of truth: trips, seats, bookings, tickets, M-Pesa |
| **3. Settlement & Reporting** | Reconciliation, refunds, cash sessions, operator records |

## Scope for booking changes

- Nairobi–Kisumu passenger flow only unless explicitly instructed
- Public API: `src/app/api/v1/**`
- Agent desk: Quick Book, bookings, lookup, cash session, reconciliation
- Do not break website or mobile API contracts

## Out of scope (core pitch)

Cargo, vehicle financing, and expansion features may exist in code but are not current fundraising scope. See [`../kenya-ebus-ecosystem/docs/roadmap/expansion-plan.md`](../kenya-ebus-ecosystem/docs/roadmap/expansion-plan.md).

## Key paths

| Area | Path |
|---|---|
| Schema | `src/db/schema.ts` |
| Store | `src/db/store.ts` |
| Public API | `src/app/api/v1/` |
| M-Pesa | `src/lib/mpesa.ts` |
| Quick Book | `src/app/(app)/quick-book/` |
| Reconciliation | `src/app/(app)/reconciliation/` |

## Docs before API changes

- `docs/API_REFERENCE.md`
- `docs/DATA_MODEL.md`
- `docs/PAYMENTS_AND_SETTLEMENT.md`

## Commands

```bash
npm run dev          # :3002
npm run typecheck
npm run lint
```

Demo login: `agent@precifarm.com` / `precifarm2026`
