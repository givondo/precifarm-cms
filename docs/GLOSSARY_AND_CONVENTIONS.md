# Glossary and conventions

Terms, naming rules, and copy conventions for the Precifarm Ticketing & Payment CMS.

**Version:** 0.1 · 16 July 2026  
**Related:** [Project specification](./PROJECT_SPECIFICATION.md) · [kenya-ebus-ecosystem/website/AGENTS.md](../../kenya-ebus-ecosystem/website/AGENTS.md)

---

## Copy conventions

These rules apply to all user-facing text in the CMS, agent desk, PWA, and SMS messages.

| Rule | Correct | Incorrect |
|---|---|---|
| Use **route**, not corridor | "Nairobi–Kisumu route" | "Nairobi–Kisumu corridor" |
| Current route label | "Nairobi – Kisumu" (en dash with spaces) | "Nairobi-Kisumu" |
| CTA button | "Book Now" | "Book NOW", "BOOK NOW" |
| Headlines | Full sentences | Staccato fragments ("Fast. Clean. Electric.") |
| Vehicle names | "Yutong U18" (intercity), "Yutong U12" (city), "ET01 electric cargo van" | Generic "bus" or "van" |
| Currency | "KSh 1,550" (comma separator) | "KES 1550", "1550/-" |
| Phone display | "0712 345 678" (local format with spaces) | "254712345678" (in UI) |
| Company name | "Precifarm" (customer-facing) | "Precifarm AI Ltd" (legal docs only) |
| Status: route | "Current route" | "Active", "Live" |
| Status: planned routes | "Next" or "Planned" | "Coming soon" (too casual) |

---

## Glossary

| Term | Definition |
|---|---|
| **Route** | An intercity path between two cities (e.g. Nairobi–Kisumu). Customer-facing term. |
| **Corridor** | Internal/strategy term for a highway corridor. **Never use in customer-facing copy.** |
| **Trip** | A specific departure: route + calendar date + departure time. |
| **Departure** | Scheduled time a vehicle leaves (e.g. 06:00). |
| **Booking** | A customer's reservation for one or more seats or cargo slots on a trip. |
| **Ticket** | Issued after payment; contains reference, trip details, and boarding info. |
| **Reference** | Unique booking identifier: `PF-XXXXXX`. |
| **Seat** | A numbered position on the coach: row + letter (e.g. 7B). 48 total on U18. |
| **Hold** | Temporary seat reservation (10 min) during checkout or call-in. |
| **Channel** | How the booking was created: web, pwa, agent_walkin, agent_callin. |
| **Agent** | Sales desk staff who book on behalf of customers. |
| **Cash session** | Agent's cash drawer period: open → collect → close → reconcile. |
| **Load factor** | Seats sold ÷ scheduled seats. Core network metric. |
| **Hub** | Precifarm charging hub on a route (separate from ticketing, but trips depend on hub energy). |
| **Partner** | Licensed coach operator who owns vehicles and employs drivers. |
| **Seed fleet** | ≤5 Precifarm-bootstrap vehicles; hard cap per master document. |
| **PSV licence** | Public Service Vehicle licence held by partners, not Precifarm. |
| **STK push** | M-Pesa SIM Tool Kit push — payment prompt on customer's phone. |
| **Daraja** | Safaricom M-Pesa API platform. |
| **Waybill** | Cargo equivalent of a passenger ticket. |
| **Fleet account** | Registered cargo customer billed on invoice (Phase B). |
| **Disruption** | Trip delay, cancellation, or vehicle substitution. |
| **Reconciliation** | Matching payments (M-Pesa + cash) against bookings. |
| **Demo mode** | Simulated M-Pesa payment with no real charge. |
| **PWA** | Progressive Web App — mobile web app installable on home screen. |
| **Neura Pod** | Precifarm solar/storage product (separate from ticketing). |
| **ET01** | Electric cargo van used for fleet/logistics on the network. |
| **U18** | Yutong U18 intercity electric bus (48 seats). |
| **U12** | Yutong U12 electric city bus (within-city, future). |
| **OCPP** | Open Charge Point Protocol — charger communication standard (Phase C). |
| **CSMS** | Charge Station Management System (Phase C integration). |

---

## Reference formats

| Entity | Format | Example |
|---|---|---|
| Booking reference | `PF-` + 6 alphanumeric (no 0/O/1/I) | `PF-K7M2NP` |
| Cash receipt | `CSH-YYYYMMDD-NNNN` | `CSH-20260716-0042` |
| M-Pesa receipt | Safaricom-assigned | `QAB1CD2EFG` |
| Demo receipt | `DEMO` + timestamp suffix | `DEMO12345678` |
| Seat ID | Row number + letter (A–D) | `7B`, `12D` |
| Phone (storage) | E.164 without `+` | `254712345678` |
| Phone (display) | Local with spaces | `0712 345 678` |
| Trip key | `{routeId}:{date}:{time}` | `nairobi-kisumu:2026-07-20:06:00` |

---

## Vehicle reference

| Model | Role | Capacity | Route type | Image |
|---|---|---|---|---|
| Yutong U18 | Intercity bus | 48 seats (12×4) | Nairobi–Kisumu | `yutong-u18.png` |
| Yutong U12 | City bus | TBD | Within-city (future) | `yutong-u12.png` |
| ET01 | Cargo van | TBD kg | Same route network | `et01.jpg` |

---

## Route reference

| Route ID | Label | Status | Fare | Departures |
|---|---|---|---|---|
| `nairobi-kisumu` | Nairobi – Kisumu | Current | KSh 1,550/seat | 06:00, 08:00, 10:00, 14:00, 16:00 |
| `nairobi-nakuru` | Nairobi – Nakuru | Planned (Phase B) | TBD | TBD |
| `nairobi-mombasa` | Nairobi – Mombasa | Planned (Phase C) | TBD | TBD |

---

## Regional cities

Referenced across Precifarm products:

Nairobi · Mombasa · Kisumu · Eldoret · Kitui · Nakuru

---

## File and code conventions (planned)

| Convention | Rule |
|---|---|
| Language | TypeScript everywhere |
| Package manager | pnpm ( workspaces) |
| API version prefix | `/v1` |
| Database naming | snake_case tables and columns |
| TypeScript naming | camelCase variables; PascalCase types |
| API JSON fields | camelCase (matching website demo) |
| Timestamps | ISO 8601 with timezone (`+03:00` EAT) |
| Timezone | `Africa/Nairobi` (EAT, UTC+3) |
| Error codes | SCREAMING_SNAKE_CASE |
| Git branches | `feat/`, `fix/`, `docs/` prefixes |
| Commit messages | Conventional commits: `feat:`, `fix:`, `docs:`, `chore:` |

---

## SMS and notification tone

- Professional, concise, informative
- Include: reference, route, date/time, seats/fare, contact number
- No marketing language in transactional SMS
- Sign off with Precifarm contact: +254 794 702 768

**Example tone:**

> Good: "Precifarm: Your ticket PF-K7M2NP is confirmed. Nairobi → Kisumu, 20 Jul, 06:00. Seats: 7B, 7C. KSh 3,100."

> Bad: "🎉 You're all set! Your AMAZING journey awaits! 🚌✨"

---

## Contact constants

Shared across all Precifarm products (from `kenya-ebus-ecosystem/website/lib/contact.ts`):

| Field | Value |
|---|---|
| Email | sales@precifarm.com |
| Phone | +254 794 702 768 |
| Phone (E.164) | 254794702768 |
| WhatsApp | https://wa.me/254794702768 |
| Website | https://precifarm.com |
| HQ | Nairobi, Kenya |

Update in one place when implementing; reference from shared package.
