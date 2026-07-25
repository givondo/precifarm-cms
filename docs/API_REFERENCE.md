# API reference

REST API specification for the Precifarm Ticketing & Payment CMS.

> Passenger booking endpoints are current core. Cargo endpoints document expansion capability in code and must not be described as current product or traction. See [`PRODUCTS_AND_CHANNELS.md`](./PRODUCTS_AND_CHANNELS.md).

**Version:** 0.3 · 24 July 2026  
**Base URL (local):** `http://localhost:3002/api`  
**Base URL (production, planned):** `https://api.precifarm.com/api`  
**Related:** [Data model](./DATA_MODEL.md) · [Project specification](./PROJECT_SPECIFICATION.md) · [Channels & workflows](./CHANNELS_AND_WORKFLOWS.md)

---

## Implementation status

| Symbol | Meaning |
|---|---|
| ✅ | Implemented and available in this repo |
| 🔜 | Specified; not yet implemented |

Most Phase A endpoints are ✅. Agent auth uses **HTTP-only session cookies** today; Bearer JWT for external clients is 🔜.

---

## Table of contents

1. [Conventions](#1-conventions)
2. [Authentication](#2-authentication)
3. [Public endpoints](#3-public-endpoints)
4. [Passenger booking endpoints](#4-passenger-booking-endpoints)
5. [Cargo booking endpoints](#5-cargo-booking-endpoints)
6. [Cargo delivery stages](#6-cargo-delivery-stages)
7. [Payment endpoints](#7-payment-endpoints)
8. [Agent desk endpoints](#8-agent-desk-endpoints)
9. [Operations endpoints](#9-operations-endpoints)
10. [Website migration map](#10-website-migration-map)
11. [Error codes](#11-error-codes)
12. [Webhooks](#12-webhooks)

---

## 1. Conventions

| Rule | Value |
|---|---|
| Format | JSON request/response bodies |
| Charset | UTF-8 |
| Dates | ISO 8601 (`2026-07-16`) |
| Times | 24-hour string (`06:00`, `14:00`) |
| Phone | E.164 (`254712345678`) in storage; accept local format (`07XX XXX XXX`) in input |
| Currency | Integer KSh (no decimals) |
| IDs | UUID v4 for entities |
| Booking references | `PF-XXXXXX` (passenger) · `PF-CXXXXX` (cargo) |
| National ID / passport | 6–20 alphanumeric characters; stored uppercase, spaces stripped |
| Versioning | URL prefix `/v1` under `/api` |

### Standard response envelope

**Success:**

```json
{
  "data": { ... }
}
```

Some older routes omit the envelope and return `{ data: ... }` or plain `{ error: "..." }`. New ops routes use structured errors (see below).

**Structured error (ops routes):**

```json
{
  "error": {
    "code": "DELIVERY_ERROR",
    "message": "Assign a rider on the Last Mile page before dispatching."
  }
}
```

**Legacy error (some public routes):**

```json
{
  "error": {
    "code": "BOOKING_ERROR",
    "message": "National ID or passport number is required."
  }
}
```

---

## 2. Authentication

| Endpoint group | Auth (current) | Auth (planned) |
|---|---|---|
| Public (routes, availability, bookings) | None | None |
| Customer payment (STK) | None (phone verified via M-Pesa) | Same |
| Agent desk & ops API | ✅ HTTP-only session cookie (`POST /api/auth/login`) | Bearer JWT |
| Website server-to-server | 🔜 | `X-API-Key` header |
| M-Pesa callback | ✅ No client auth (validate in handler) | Safaricom IP whitelist + signature |

### POST `/api/auth/login` ✅

Agent login. Sets an HTTP-only session cookie (8-hour TTL). Used by the agent desk UI and ops API.

**Request:**

```json
{
  "email": "agent@precifarm.com",
  "password": "precifarm2026"
}
```

**Response (200):**

```json
{
  "data": {
    "agent": {
      "id": "uuid",
      "name": "Jane Agent",
      "email": "agent@precifarm.com",
      "role": "agent",
      "branch": "Nairobi"
    }
  }
}
```

**Errors:** `400` missing fields · `401` invalid credentials

### POST `/api/auth/logout` ✅

Clears the session cookie.

### Ops / agent API calls

From browser or server with cookie jar: login first, then call ops routes — cookie is sent automatically.

From scripts (curl example):

```bash
curl -c cookies.txt -X POST http://localhost:3002/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"agent@precifarm.com","password":"precifarm2026"}'

curl -b cookies.txt http://localhost:3002/api/v1/ops/cargo/deliveries
```

---

## 3. Public endpoints

### GET `/api/v1/health` ✅

Public health and payment mode — safe for website/mobile to read before booking.

**Response (200):**

```json
{
  "data": {
    "ok": true,
    "paymentMode": "live-production",
    "mpesaEnvironment": "production",
    "hasConsumerKey": true,
    "hasConsumerSecret": true,
    "hasPasskey": true,
    "hasShortcode": true,
    "callbackHost": "your-tunnel.example.com",
    "databaseConfigured": false
  }
}
```

| `paymentMode` | Meaning |
|---|---|
| `demo` | Simulated STK — instant `DEMO…` receipt, no phone prompt |
| `live-sandbox` | Real Daraja STK (sandbox) |
| `live-production` | Real M-Pesa Express STK (production) |
| `misconfigured` | `DEMO_PAYMENT=false` but missing `MPESA_*` |

Website proxy: `GET /api/cms/health` (when `CMS_API_URL` set).

### GET `/api/v1/routes` ✅

List active routes with fares and departures.

**Response (200):**

```json
{
  "data": [
    {
      "id": "nairobi-kisumu",
      "label": "Nairobi – Kisumu",
      "from": "Nairobi",
      "to": "Kisumu",
      "duration": "4h 45m",
      "distance": "~345 km",
      "vehicle": "Yutong U18",
      "fare": 1550,
      "departures": ["06:00", "08:00", "10:00", "14:00", "16:00"],
      "status": "current"
    }
  ]
}
```

*Matches website `lib/route.ts` shape for easy migration.*

### GET `/api/v1/routes/:routeId/trips` ✅

Trips for a route on a given date.

**Query:** `?date=2026-07-20`

**Response (200):**

```json
{
  "data": {
    "routeId": "nairobi-kisumu",
    "date": "2026-07-20",
    "trips": [
      {
        "tripId": "uuid",
        "departureTime": "06:00",
        "seatsAvailable": 42,
        "seatCapacity": 48,
        "cargoAvailableKg": 350,
        "cargoCapacityKg": 500,
        "status": "scheduled"
      }
    ]
  }
}
```

### GET `/api/v1/trips/:tripId/seats` ✅

Seat availability for a trip. **Replaces website `/api/seats`.**

**Response (200):**

```json
{
  "data": {
    "tripId": "uuid",
    "routeId": "nairobi-kisumu",
    "date": "2026-07-20",
    "departureTime": "06:00",
    "bookedSeats": ["1A", "3C", "5B"],
    "heldSeats": [],
    "layout": {
      "rows": 12,
      "letters": ["A", "B", "C", "D"],
      "totalSeats": 48
    }
  }
}
```

### GET `/api/v1/routes/:routeId/seats` ✅

Drop-in replacement for website `/api/seats` — combines trip lookup + seat availability.

**Query:** `?date=2026-07-20&time=06:00`

**Response (200):**

```json
{
  "data": {
    "bookedSeats": ["1A", "3C", "5B"]
  }
}
```

---

## 4. Passenger booking endpoints

### POST `/api/v1/bookings` ✅

Create a passenger booking. **Replaces website `/api/booking`.**

**Request:**

```json
{
  "routeId": "nairobi-kisumu",
  "date": "2026-07-20",
  "time": "06:00",
  "passengers": 2,
  "seats": ["7B", "7C"],
  "name": "Jane Wanjiku",
  "phone": "0712 345 678",
  "idNumber": "12345678",
  "email": "jane@example.com",
  "channel": "web"
}
```

| Field | Required | Notes |
|---|---|---|
| `routeId` | Yes | Must match active route (`nairobi-kisumu`) |
| `date` | Yes | Not in past (local EAT date) |
| `time` | Yes | Must be valid departure |
| `passengers` | Yes | 1–6 |
| `seats` | Yes | Count must equal `passengers`; valid seat IDs only |
| `name` | Yes | Min 2 chars |
| `phone` | Yes | Valid Kenyan number |
| `idNumber` | Yes | National ID or passport (6–20 alphanumeric) |
| `email` | No | Validated if present |
| `channel` | No | Default `web`; agents send `agent_walkin` or `agent_callin` |

**Response (201):**

```json
{
  "data": {
    "bookingId": "uuid",
    "reference": "PF-K7M2NP",
    "total": 3100,
    "status": "pending",
    "expiresAt": "2026-07-16T08:40:00+03:00"
  }
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| 400 | `BOOKING_ERROR` / `VALIDATION_ERROR` | Invalid input (see message) |
| 409 | `BOOKING_ERROR` | Seat already booked or insufficient capacity |

### GET `/api/v1/bookings/:reference` ✅

Lookup booking by reference (passenger or cargo).

**Response (200) — passenger:**

```json
{
  "data": {
    "id": "uuid",
    "reference": "PF-K7M2NP",
    "bookingType": "passenger",
    "routeId": "nairobi-kisumu",
    "from": "Nairobi",
    "to": "Kisumu",
    "date": "2026-07-20",
    "time": "06:00",
    "passengers": 2,
    "seats": ["7B", "7C"],
    "farePerUnit": 1550,
    "total": 3100,
    "name": "Jane Wanjiku",
    "phone": "254712345678",
    "idNumber": "12345678",
    "status": "paid",
    "mpesaReceipt": "QAB1CD2EFG",
    "paidAt": "2026-07-16T08:35:00+03:00",
    "createdAt": "2026-07-16T08:30:00+03:00",
    "ticket": {
      "code": "PF-K7M2NP",
      "status": "valid",
      "smsSentAt": "2026-07-16T08:35:05+03:00"
    }
  }
}
```

**Response (200) — cargo** includes a `cargo` object and `deliveryMessages` (see [Cargo booking](#5-cargo-booking-endpoints)).

### POST `/api/v1/bookings/:bookingId/cancel` 🔜

Cancel a pending or paid booking (ops/agent only for paid).

### POST `/api/v1/trips/:tripId/seats/hold` 🔜

Hold seats temporarily (call-in workflow). Auth: Agent session.

---

## 5. Cargo booking endpoints

### POST `/api/v1/cargo/bookings` ✅

Create a cargo waybill. Optionally includes **last mile delivery** (+ KSh 500).

**Auth:** None for web; agent session optional (sets `agent_walkin` channel and enables cash payment).

**Request:**

```json
{
  "routeId": "nairobi-kisumu",
  "date": "2026-07-20",
  "time": "06:00",
  "weightKg": 25,
  "description": "Electronics — laptop box",
  "senderName": "John Kamau",
  "senderPhone": "0711 111 111",
  "senderIdNumber": "12345678",
  "receiverName": "Mary Akinyi",
  "receiverPhone": "0722 222 222",
  "receiverIdNumber": "A1234567",
  "isFragile": true,
  "lastMileDelivery": true,
  "deliveryAddress": "Kisumu CBD, Oginga Odinga St, Shop 12",
  "paymentMethod": "mpesa",
  "channel": "web"
}
```

| Field | Required | Notes |
|---|---|---|
| `routeId` | Yes | `nairobi-kisumu` only |
| `date`, `time` | Yes | Same rules as passenger |
| `weightKg` | Yes | 0.1–500 kg per departure |
| `description` | Yes | Min 3 characters |
| `senderName`, `senderPhone`, `senderIdNumber` | Yes | Sender contact + ID |
| `receiverName`, `receiverPhone`, `receiverIdNumber` | Yes | Receiver contact + ID |
| `isFragile` | No | Flag for handling |
| `lastMileDelivery` | No | Default `false`; adds KSh 500 to fare |
| `deliveryAddress` | Required if `lastMileDelivery` | Min 5 characters |
| `paymentMethod` | No | `mpesa` (default) or `cash` (agent session + open cash session required) |
| `channel` | No | Default `web` or `agent_walkin` when agent logged in |

**Fare calculation:** `ceil(weightKg) × 50` + `500` if last mile.

**Response (201) — paid (demo M-Pesa or cash):**

```json
{
  "data": {
    "bookingId": "uuid",
    "reference": "PF-C7K2NP",
    "total": 1750,
    "status": "paid",
    "receipt": "DEMO12345678",
    "smsBody": "Precifarm Cargo: Waybill PF-C7K2NP confirmed.\n...",
    "demo": true
  }
}
```

**Response (201) — STK pending (live M-Pesa):**

```json
{
  "data": {
    "bookingId": "uuid",
    "reference": "PF-C7K2NP",
    "total": 1750,
    "status": "pending",
    "paymentStatus": "pending",
    "message": "STK push sent to 0711 111 111. Enter your M-Pesa PIN."
  }
}
```

On payment confirmation, delivery tracking starts at stage **`confirmed`** and SMS is sent to sender and receiver. Messages are logged to `data/sms.log` (demo mode).

**Errors:**

| Status | Code | When |
|---|---|---|
| 400 | `BOOKING_ERROR` | Validation failure |
| 401 | `UNAUTHORIZED` | Cash payment without agent session |
| 409 | `BOOKING_ERROR` | Insufficient cargo capacity on departure |
| 422 | `NO_CASH_SESSION` | Cash payment without open cash session |

### GET `/api/v1/bookings/:reference` — cargo fields ✅

When `bookingType` is `cargo`, the lookup response includes:

```json
{
  "cargo": {
    "weightKg": 25,
    "description": "Electronics — laptop box",
    "senderName": "John Kamau",
    "senderPhone": "254711111111",
    "receiverName": "Mary Akinyi",
    "receiverPhone": "254722222222",
    "senderIdNumber": "12345678",
    "receiverIdNumber": "A1234567",
    "lastMileDelivery": true,
    "deliveryAddress": "Kisumu CBD, Oginga Odinga St, Shop 12",
    "deliveryStatus": "confirmed",
    "deliveryStatusUpdatedAt": "2026-07-16T08:35:00+03:00",
    "riderId": null,
    "riderAssignedAt": null,
    "rider": null
  },
  "deliveryMessages": [
    {
      "id": "uuid",
      "stage": "confirmed",
      "recipient": "sender",
      "phone": "254711111111",
      "body": "Hi John, Precifarm Cargo waybill PF-C7K2NP is confirmed.\n...",
      "sentAt": "2026-07-16T08:35:05+03:00"
    }
  ]
}
```

---

## 6. Cargo delivery stages

Delivery tracking applies to **paid cargo** bookings only. Agents advance stages from the **Delivery** desk (`/delivery`) or via the ops API.

### Stage pipeline

**Hub pickup (no last mile):**

```
confirmed → received → loaded → in_transit → arrived → delivered
```

**Last mile delivery:**

```
confirmed → received → loaded → in_transit → arrived → out_for_delivery → delivered
```

**Failure path:** From `arrived` (LMD) or `out_for_delivery` → `failed_delivery`

| Stage | Label | SMS to sender & receiver |
|---|---|---|
| `confirmed` | Confirmed | Payment received — waybill issued |
| `received` | Received | Cargo received at origin hub |
| `loaded` | Loaded | Cargo loaded on vehicle |
| `in_transit` | In transit | En route to destination |
| `arrived` | Arrived | At destination hub; collect or await courier |
| `out_for_delivery` | Out for delivery | Courier en route (LMD only; includes rider details) |
| `delivered` | Delivered | Handed to receiver |
| `failed_delivery` | Failed delivery | Attempt unsuccessful; team will follow up |

### Rules

- Advance **one stage at a time** (unless posting a specific valid target stage).
- **`out_for_delivery`** requires a **rider assigned** when `lastMileDelivery` is true.
- Rider must operate in the **destination city** (e.g. Kisumu rider for Nairobi → Kisumu).
- SMS bodies are recorded in `deliveryMessages` and appended to `data/sms.log`.

### Last mile workflow

1. Book cargo with `lastMileDelivery: true` and `deliveryAddress`.
2. Advance through hub stages to **`arrived`**.
3. **Assign rider** — `POST /api/v1/ops/cargo/:ref/rider` with `{ "riderId": "..." }`.
4. **Dispatch** — same endpoint with `{ "riderId": "...", "dispatch": true }` → moves to `out_for_delivery` and notifies clients with rider name, phone, and vehicle.
5. Mark **`delivered`** or **`failed_delivery`**.

---

## 7. Payment endpoints

### POST `/api/v1/payments/stk` ✅

Initiate M-Pesa STK push. **Replaces website `/api/payment`.**

**Request:**

```json
{
  "bookingId": "uuid"
}
```

**Response (200) — demo mode:**

```json
{
  "data": {
    "status": "success",
    "reference": "PF-K7M2NP",
    "mpesaReceipt": "DEMO12345678",
    "paidAt": "2026-07-16T08:35:00+03:00",
    "demo": true,
    "message": "Demo payment successful. No M-Pesa charge was made.",
    "smsBody": "..."
  }
}
```

**Response (200) — live mode (STK sent):**

```json
{
  "data": {
    "status": "pending",
    "reference": "PF-K7M2NP",
    "checkoutRequestId": "ws_CO_...",
    "message": "STK push sent to 0712 345 678. Enter your M-Pesa PIN."
  }
}
```

Demo mode when `DEMO_PAYMENT !== "false"` or Daraja credentials are missing.

### POST `/api/v1/payments/cash` ✅

Record cash payment (agent desk only).

**Auth:** Agent session with open cash session

**Request:**

```json
{
  "bookingId": "uuid",
  "amountReceived": 3100
}
```

### POST `/api/v1/payments/mpesa/callback` ✅

M-Pesa Daraja callback (Safaricom → CMS). Not called by clients.

**Behaviour:**

1. Validate callback payload
2. Match `CheckoutRequestID` to pending payment
3. Idempotent: ignore duplicate callbacks
4. On success: mark booking `paid`, issue ticket/waybill, send SMS, start cargo delivery at `confirmed`
5. On failure: mark payment `failed`

### GET `/api/v1/payments/:bookingId/status` ✅

Poll payment status (for PWA/web after STK sent).

**Response (200):**

```json
{
  "data": {
    "bookingId": "uuid",
    "reference": "PF-K7M2NP",
    "paymentStatus": "completed",
    "bookingStatus": "paid",
    "mpesaReceipt": "QAB1CD2EFG"
  }
}
```

---

## 8. Agent desk endpoints

All require agent session unless noted.

### POST `/api/v1/agents/bookings` ✅

Same body as `POST /api/v1/bookings` (including required `idNumber`).

- Auto-sets `channel` to `agent_walkin` (unless overridden)
- Auto-sets `agent_id` from session
- Accepts optional `paymentMethod`: `cash` | `mpesa` (default `cash`)

If `paymentMethod: "cash"`, completes payment in one step (requires open cash session).

If `paymentMethod: "mpesa"`, initiates **M-Pesa Express STK** via `processStkPayment` (same as public API — not demo-only).

**Response (201) — cash paid:**

```json
{
  "data": {
    "bookingId": "uuid",
    "reference": "PF-K7M2NP",
    "total": 3100,
    "status": "paid",
    "receipt": "CSH-20260724-0042",
    "smsBody": "..."
  }
}
```

**Response (201) — M-Pesa live STK pending:**

```json
{
  "data": {
    "bookingId": "uuid",
    "reference": "PF-K7M2NP",
    "total": 3100,
    "status": "pending",
    "paymentStatus": "pending",
    "message": "STK push sent. Enter your M-Pesa PIN on 2547…",
    "checkoutRequestId": "ws_CO_...",
    "demo": false
  }
}
```

**Response (201) — M-Pesa demo or instant success:**

```json
{
  "data": {
    "reference": "PF-K7M2NP",
    "status": "paid",
    "receipt": "DEMO15358206",
    "demo": true,
    "smsBody": "..."
  }
}
```

Quick Book UI polls `GET /v1/payments/:bookingId/status` until paid when status is `pending`.

### GET `/api/v1/agents/cash-session` ✅

Returns the agent's open cash session, or `null`.

### POST `/api/v1/agents/cash-session` ✅

Open a cash session.

**Request:**

```json
{ "openingFloat": 5000 }
```

### POST `/api/v1/agents/cash-session/close` ✅

**Request:**

```json
{
  "actualCash": 47500,
  "notes": "All reconciled"
}
```

**Response includes discrepancy calculation.**

### GET `/api/v1/agents/me` 🔜

Current agent profile and open cash session.

### GET `/api/v1/agents/customers/search` 🔜

**Query:** `?phone=0712`

### POST `/api/v1/agents/tickets/:reference/resend-sms` 🔜

Resend ticket SMS to customer.

---

## 9. Operations endpoints

All require **agent session** (same cookie as desk login).

### GET `/api/v1/ops/cargo/deliveries` ✅

List paid cargo shipments with delivery status.

**Query:**

| Param | Values | Description |
|---|---|---|
| `status` | `active`, `completed` | Filter in-progress vs closed deliveries |
| `q` | string | Search reference, sender/receiver name or phone |

**Response (200):**

```json
{
  "data": [
    {
      "reference": "PF-C7K2NP",
      "bookingId": "uuid",
      "from": "Nairobi",
      "to": "Kisumu",
      "date": "2026-07-20",
      "time": "06:00",
      "senderName": "John Kamau",
      "senderPhone": "254711111111",
      "receiverName": "Mary Akinyi",
      "receiverPhone": "254722222222",
      "weightKg": 25,
      "description": "Electronics — laptop box",
      "lastMileDelivery": true,
      "deliveryAddress": "Kisumu CBD, Oginga Odinga St, Shop 12",
      "deliveryStatus": "arrived",
      "deliveryStatusUpdatedAt": "2026-07-20T14:00:00+03:00",
      "riderId": "uuid",
      "rider": {
        "id": "uuid",
        "name": "Grace Achieng",
        "phone": "+254712345004",
        "vehicle": "E-bike",
        "city": "Kisumu",
        "status": "available"
      },
      "nextStage": "out_for_delivery",
      "nextStageLabel": "Out for delivery",
      "messageCount": 10,
      "lastMessageAt": "2026-07-20T14:00:05+03:00",
      "paidAt": "2026-07-16T08:35:00+03:00"
    }
  ]
}
```

### GET `/api/v1/ops/cargo/:reference/delivery-status` ✅

Full booking lookup for one cargo shipment, including `deliveryMessages`.

### POST `/api/v1/ops/cargo/:reference/delivery-status` ✅

Advance delivery stage and notify sender + receiver via SMS.

**Request (optional):**

```json
{ "stage": "loaded" }
```

If `stage` is omitted, advances to the **next** stage in the pipeline.

**Response (200):**

```json
{
  "data": {
    "reference": "PF-C7K2NP",
    "deliveryStatus": "loaded",
    "deliveryStatusLabel": "Loaded",
    "nextStage": "in_transit",
    "nextStageLabel": "In transit",
    "messages": [ "...delivery message records..." ],
    "message": "Client notified at \"loaded\" stage (SMS sent to sender and receiver)."
  }
}
```

**Errors:**

| Status | Code | When |
|---|---|---|
| 400 | `NOT_CARGO` | Reference is a passenger booking |
| 404 | `NOT_FOUND` | Unknown reference |
| 409 | `DELIVERY_ERROR` | Invalid stage transition, delivery closed, or rider required for dispatch |

### GET `/api/v1/ops/riders` ✅

List active delivery riders.

**Query:** `?city=Nairobi` or `?city=Kisumu` (optional filter)

**Response (200):**

```json
{
  "data": [
    {
      "id": "uuid",
      "name": "James Ochieng",
      "phone": "+254712345001",
      "city": "Nairobi",
      "vehicle": "E-bike",
      "status": "available",
      "statusLabel": "Available",
      "isActive": true,
      "activeDeliveries": 0
    }
  ]
}
```

**Rider statuses:** `available` · `on_delivery` · `off_duty`

### GET `/api/v1/ops/last-mile/deliveries` ✅

Last mile queue — cargo with `lastMileDelivery: true` only.

**Query:**

| Param | Values | Description |
|---|---|---|
| `bucket` | `ready`, `active`, `upcoming`, `completed` | Queue segment |
| `q` | string | Search reference, receiver, address, rider name |

**Bucket definitions:**

| Bucket | `deliveryStatus` | Meaning |
|---|---|---|
| `ready` | `arrived` | At hub — assign rider and dispatch |
| `active` | `out_for_delivery` | Courier en route |
| `upcoming` | before `arrived` | Still in transit to destination |
| `completed` | `delivered`, `failed_delivery` | Closed |

**Response (200):**

```json
{
  "data": [
    {
      "reference": "PF-C7K2NP",
      "bookingId": "uuid",
      "from": "Nairobi",
      "to": "Kisumu",
      "destinationCity": "Kisumu",
      "date": "2026-07-20",
      "time": "06:00",
      "receiverName": "Mary Akinyi",
      "receiverPhone": "254722222222",
      "weightKg": 25,
      "description": "Electronics — laptop box",
      "deliveryAddress": "Kisumu CBD, Oginga Odinga St, Shop 12",
      "deliveryStatus": "arrived",
      "deliveryStatusUpdatedAt": "2026-07-20T14:00:00+03:00",
      "riderId": null,
      "rider": null,
      "bucket": "ready",
      "canAssignRider": true,
      "canDispatch": false
    }
  ]
}
```

### POST `/api/v1/ops/cargo/:reference/rider` ✅

Assign a rider to a last mile shipment. Optionally dispatch in one call.

**Request:**

```json
{
  "riderId": "uuid",
  "dispatch": false
}
```

| Field | Required | Notes |
|---|---|---|
| `riderId` | Yes | Must be active rider in destination city |
| `dispatch` | No | If `true`, assigns (if needed) and advances to `out_for_delivery` |

**Response (200) — assign only:**

```json
{
  "data": {
    "reference": "PF-C7K2NP",
    "riderId": "uuid",
    "rider": { "id": "uuid", "name": "Grace Achieng", "...": "..." },
    "message": "Grace Achieng assigned to PF-C7K2NP."
  }
}
```

**Response (200) — dispatch:** Same shape as `POST .../delivery-status` when `dispatch: true`.

**Errors:**

| Status | Code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing body or `riderId` |
| 400 | `RIDER_ASSIGN_ERROR` | Not a last mile shipment |
| 404 | `RIDER_ASSIGN_ERROR` | Unknown cargo or rider |
| 409 | `RIDER_ASSIGN_ERROR` | Wrong city, off duty, not yet arrived, delivery closed |

### GET `/api/v1/ops/reconciliation` ✅

Daily reconciliation report.

**Query:** `?date=2026-07-16` (defaults to today)

**Response (200):**

```json
{
  "data": {
    "date": "2026-07-16",
    "mpesa": {
      "total": 12,
      "amount": 18600,
      "failed": 1,
      "demo": 12,
      "pending": 0
    },
    "cash": {
      "sessionsOpened": 2,
      "totalCollected": 9300,
      "discrepancies": []
    },
    "bookings": {
      "created": 15,
      "paid": 14,
      "cancelled": 0,
      "refunded": 0,
      "byChannel": {
        "web": 3,
        "pwa": 0,
        "agent_walkin": 11,
        "agent_callin": 1
      },
      "revenue": 27900
    },
    "tickets": {
      "issued": 12,
      "smsSent": 12,
      "smsFailed": 0
    },
    "unmatched": {
      "paymentsWithoutTickets": 0,
      "paidBookingsWithoutPayments": 0
    },
    "agentSessions": []
  }
}
```

### POST `/api/v1/ops/bookings/:reference/refund` ✅

Cancel or refund a paid booking (passenger or cargo).

**Response (200):**

```json
{
  "data": {
    "reference": "PF-K7M2NP",
    "status": "refunded",
    "message": "Booking refunded."
  }
}
```

### GET `/api/v1/ops/bookings` 🔜

Paginated booking list with filters.

### POST `/api/v1/ops/trips/:tripId/disrupt` 🔜

Trip delay, cancel, or vehicle substitution with customer notification.

---

## 10. Website migration map

Replace in-memory website API routes with CMS calls (base: `http://localhost:3002/api`):

| Website route | CMS endpoint | Notes |
|---|---|---|
| `GET /api/seats?routeId&date&time` | `GET /api/v1/routes/:routeId/seats?date=&time=` | Drop-in `{ bookedSeats }` shape |
| `POST /api/booking` | `POST /api/v1/bookings` | Add required `idNumber`; set `channel: "web"` |
| `POST /api/payment` | `POST /api/v1/payments/stk` | Same `{ bookingId }` body |
| *(new)* cargo booking | `POST /api/v1/cargo/bookings` | Waybill + optional last mile |
| *(new)* track cargo | `GET /api/v1/bookings/:reference` | Public lookup when reference known |

See [Integrations](./INTEGRATIONS.md) and [Client channels](./CLIENT_CHANNELS.md). Website env: `CMS_API_URL=http://localhost:3002/api`.

---

## 11. Error codes

| HTTP | Code | Description |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Input failed validation |
| 400 | `BOOKING_ERROR` | Booking business rule failure |
| 400 | `NOT_CARGO` | Operation requires a cargo booking |
| 401 | `UNAUTHORIZED` | Missing or invalid agent session |
| 403 | `FORBIDDEN` | Insufficient role 🔜 |
| 404 | `NOT_FOUND` | Entity not found |
| 409 | `SEATS_UNAVAILABLE` | Seat conflict 🔜 |
| 409 | `BOOKING_EXPIRED` | Pending booking past hold TTL 🔜 |
| 409 | `DELIVERY_ERROR` | Invalid delivery stage transition |
| 409 | `RIDER_ASSIGN_ERROR` | Rider assignment or dispatch failed |
| 422 | `NO_CASH_SESSION` | Cash payment without open session |
| 422 | `PAYMENT_FAILED` | M-Pesa or cash payment rejected |
| 422 | `REFUND_ERROR` | Refund could not be processed |
| 429 | `RATE_LIMITED` | Too many requests 🔜 |
| 500 | `INTERNAL_ERROR` | Unexpected server error |

---

## 12. Webhooks

### Outbound 🔜

CMS can notify external systems on booking events:

| Event | Payload |
|---|---|
| `booking.created` | Booking details |
| `booking.paid` | Booking + payment + ticket |
| `booking.cancelled` | Booking + reason |
| `cargo.delivery.updated` | Reference, stage, rider |
| `trip.disrupted` | Trip + affected bookings |

Configure webhook URLs in admin settings. Signed with HMAC-SHA256.

### Inbound

| Source | Endpoint | Purpose | Status |
|---|---|---|---|
| M-Pesa Daraja | `POST /api/v1/payments/mpesa/callback` | STK result | ✅ |
| SMS provider | `POST /api/v1/webhooks/sms/delivery` | Delivery status | 🔜 |

---

## Rate limits (planned)

| Actor | Limit |
|---|---|
| Public read | 60 req/min per IP |
| Booking create | 10 req/min per IP |
| Agent | 120 req/min per session |
| M-Pesa callback | No limit (Safaricom IPs) |

---

## SMS logging (demo)

Until a live SMS provider is integrated, all ticket and delivery messages append to **`data/sms.log`**. Each cargo stage change creates two records (sender + receiver) in `deliveryMessages` on the booking.
