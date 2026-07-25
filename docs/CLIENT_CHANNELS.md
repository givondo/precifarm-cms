# Client channels (mobile + website)

How **Precifarm Mobile App** and **kenya-ebus-ecosystem/website** consume this CMS API.

**Source docs (mobile repo):** [CMS integration](../../Precifarm%20Mobile%20App/docs/CMS_INTEGRATION.md) · [Daraja setup](../../Precifarm%20Mobile%20App/docs/DARAJA_SETUP.md) · [Ecosystem map](../../Precifarm%20Mobile%20App/docs/ECOSYSTEM.md)

**Last updated:** 24 July 2026  
**Related:** [API reference](./API_REFERENCE.md) · [Payments & settlement](./PAYMENTS_AND_SETTLEMENT.md) · [Integrations](./INTEGRATIONS.md)

---

## Principle

All customer channels are **thin clients**. The CMS owns inventory, bookings, payments, tickets, and SMS. **M-Pesa Daraja credentials live in CMS `.env` only** — never in mobile or website env files.

---

## Channel configuration

| Channel | Repo | API access | Env var | Booking `channel` |
|---|---|---|---|---|
| Public website | `kenya-ebus-ecosystem/website` | Proxy via Next.js `/api/*` | `CMS_API_URL=http://localhost:3002/api` | `web` |
| Native mobile | `Precifarm Mobile App` | Direct to CMS | `EXPO_PUBLIC_API_URL=http://localhost:3002/api` | `mobile` (recommended) or `pwa` |
| Agent desk | This repo UI | Same-origin `/api/*` + session cookie | CMS `.env` | `agent_walkin` / `agent_callin` |

On a physical phone, mobile uses the dev machine **LAN IP** instead of `localhost`.

---

## Harmonized M-Pesa Express STK flow

All channels follow the same three-step pattern:

```text
1. POST /api/v1/bookings          →  { bookingId, reference, status: "pending" }
2. POST /api/v1/payments/stk      →  { status: "pending" | "success", demo?, message, checkoutRequestId? }
3. GET  /api/v1/payments/:id/status  →  poll until bookingStatus === "paid"
```

| Setting | Value |
|---|---|
| Poll interval | 3 seconds |
| Poll timeout | 120 seconds |
| Demo mode | Instant `{ status: "success", demo: true, mpesaReceipt: "DEMO..." }` — **no phone prompt** |
| Live mode | `{ status: "pending" }` → customer enters PIN → callback completes payment |

Check mode: `GET /api/v1/health` → `paymentMode`: `demo` · `live-sandbox` · `live-production`

### Client implementations

| Channel | Code location | UX |
|---|---|---|
| **Website** | `website/lib/payment.ts`, `BookingPortal.tsx` | Paying step with auto-poll; Retry + “I've paid” buttons |
| **Mobile (bus)** | `lib/mpesa.ts`, `useMpesaPaymentPoll`, `app/bus/confirm.tsx` | Pending state + poll; retry/check buttons |
| **Mobile (cargo)** | `services/cargo.ts`, `app/cargo/confirm.tsx` | Single `POST /cargo/bookings` then poll (STK in one CMS call) |
| **Agent Quick Book** | `POST /agents/bookings` + Quick Book UI | Live STK via `processStkPayment`; pending screen + poll |

---

## API mapping (passenger)

| Step | CMS endpoint | Website proxy | Mobile service |
|---|---|---|---|
| Routes / trips | `GET /v1/routes`, `/trips` | — (static route Phase A) | `services/routes.ts` |
| Seats | `GET /v1/routes/:id/seats` | `GET /api/seats` | `getSeats()` |
| Create booking | `POST /v1/bookings` | `POST /api/booking` | `createPassengerBooking()` |
| STK | `POST /v1/payments/stk` | `POST /api/payment` | `initiateStkPayment()` |
| Poll status | `GET /v1/payments/:id/status` | `GET /api/payment/status` | `fetchPaymentStatus()` |
| Lookup | `GET /v1/bookings/:ref` | — | `getBookingByReference()` |
| Health | `GET /v1/health` | `GET /api/cms/health` | `fetchCmsHealth()` |

### Required passenger fields (all channels)

| Field | CMS key | Notes |
|---|---|---|
| Name | `name` | Min 2 chars |
| Phone | `phone` | Kenyan 07… or 254… — **STK sent here** |
| National ID / passport | `idNumber` | 6–20 alphanumeric |
| Seats | `seats[]` | Must match `passengers` count |

---

## API mapping (cargo)

| Step | CMS endpoint | Mobile |
|---|---|---|
| Create + pay | `POST /v1/cargo/bookings` | `createCargoBooking()` — includes STK |
| Poll (if pending) | `GET /v1/payments/:id/status` | `useMpesaPaymentPoll` |
| Track | `GET /v1/bookings/:ref` | `getBookingByReference()` — maps `cargo.deliveryStatus` |

### Required cargo fields

| Field | CMS key |
|---|---|
| Sender / receiver name, phone, ID | `senderName`, `senderPhone`, `senderIdNumber`, `receiverName`, `receiverPhone`, `receiverIdNumber` |
| Weight, description | `weightKg`, `description` |
| Last mile (optional) | `lastMileDelivery`, `deliveryAddress` (+ KSh 500) |

Fare: `ceil(weightKg) × 50` + optional KSh 500 last mile.

---

## Cargo delivery status (track screen)

CMS stages map to mobile track UI via `lib/mpesa.ts` → `CMS_DELIVERY_TO_STATUS`:

| CMS `deliveryStatus` | Mobile track status |
|---|---|
| `confirmed` | pending |
| `received`, `loaded` | picked_up |
| `in_transit` | in_transit |
| `arrived` | at_hub |
| `out_for_delivery` | out_for_delivery |
| `delivered` | delivered |

Ops advance stages via `/delivery` desk or ops API — see [API reference](./API_REFERENCE.md) §6.

---

## Local dev (three terminals)

| Terminal | Command | URL |
|---|---|---|
| CMS | `npm run dev` | http://localhost:3002 |
| Website | `npm run dev` (with `CMS_API_URL`) | http://localhost:3000 |
| Mobile | `npm start` (with `EXPO_PUBLIC_USE_MOCK=false`) | Expo QR |

### Live STK testing

```bash
# CMS folder
npm run tunnel:mpesa      # HTTPS tunnel for callbacks
npm run test:mpesa-auth   # OAuth check
npm run test:stk          # Full booking + STK smoke test
```

Set in CMS `.env`: `DEMO_PAYMENT=false`, all `MPESA_*`, `MPESA_TEST_PHONE=2547XXXXXXXX`.

Full walkthrough: [Mobile Daraja setup](../../Precifarm%20Mobile%20App/docs/DARAJA_SETUP.md)

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Receipt starts with `DEMO` | Demo mode active | `DEMO_PAYMENT=false` + Daraja creds; check `/api/v1/health` |
| No STK on phone (agent desk) | Was hardcoded demo — **fixed** | Select M-Pesa (not cash); restart CMS after update |
| STK sent, booking stays pending | Callback unreachable | Keep tunnel running; update `MPESA_CALLBACK_URL`; restart CMS |
| Mobile “CMS unreachable” | Wrong API URL on device | Use LAN IP, not `localhost` |
| Website payment error after STK | Missing poll | Ensure `CMS_API_URL` set; website polls `/api/payment/status` |

---

## Related documents

| Document | Use when |
|---|---|
| [Mobile CMS integration](../../Precifarm%20Mobile%20App/docs/CMS_INTEGRATION.md) | Screen-level API mapping |
| [Mobile Daraja setup](../../Precifarm%20Mobile%20App/docs/DARAJA_SETUP.md) | Live STK credentials + tunnel |
| [Channels & workflows](./CHANNELS_AND_WORKFLOWS.md) | Agent desk + delivery desk flows |
| [Payments & settlement](./PAYMENTS_AND_SETTLEMENT.md) | Callback handling, reconciliation |
