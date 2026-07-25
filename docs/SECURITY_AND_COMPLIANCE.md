# Security and compliance

Security architecture, access control, and regulatory considerations for the Precifarm CMS.

**Version:** 0.1 · 16 July 2026  
**Related:** [Project specification](./PROJECT_SPECIFICATION.md)

---

## Table of contents

1. [Security principles](#1-security-principles)
2. [Authentication](#2-authentication)
3. [Role-based access control](#3-role-based-access-control)
4. [API security](#4-api-security)
5. [Payment security](#5-payment-security)
6. [Data protection](#6-data-protection)
7. [Audit logging](#7-audit-logging)
8. [Infrastructure security](#8-infrastructure-security)
9. [Regulatory compliance (Kenya)](#9-regulatory-compliance-kenya)
10. [Incident response](#10-incident-response)

---

## 1. Security principles

From master document §8 launch standards:

| Standard | Implementation |
|---|---|
| MFA/RBAC | Agents and ops require auth; ops/admin require MFA (Phase B) |
| No raw card storage | Card payments via hosted checkout only |
| Unique IDs + timestamps | Every event in `audit_events` |
| Offline manifests | Exportable trip data for agents (Phase B) |
| Segmentation | External services isolated from database |
| Idempotent payments | No double-charge on callback retry |

---

## 2. Authentication

### Agents and ops staff

| Method | Phase A | Phase B |
|---|---|---|
| Email + password | Yes | Yes |
| MFA (TOTP) | No | Yes (ops/admin) |
| Session | JWT (8-hour expiry) | JWT + refresh token |
| Password policy | Min 12 chars | Min 12 chars + complexity |

### Customers (public)

| Method | Purpose |
|---|---|
| Phone number | Primary identifier; no password required |
| M-Pesa STK | Implicit verification (payment proves phone ownership) |
| Phone OTP | PWA account login (Phase B) |

Customers do not have passwords in Phase A. Booking lookup by reference + phone.

### Service accounts (website → CMS)

| Method | Purpose |
|---|---|
| API key (`X-API-Key` header) | Website server-to-server calls |
| IP allowlist (optional) | Restrict to website server IP |

---

## 3. Role-based access control

### Roles

| Role | Access |
|---|---|
| `customer` | Own bookings (by phone/reference); public read endpoints |
| `agent` | Create bookings (walk-in/call-in); cash payments; customer lookup; own cash sessions |
| `ops` | All agent permissions + refunds; disruption; all bookings read; reconciliation |
| `admin` | All ops permissions + route/fare management; agent management; system config |
| `partner` | Own trip manifests and load factors (Phase C) |
| `service` | API key auth; read routes/availability; create web bookings |

### Permission matrix

| Action | customer | agent | ops | admin | service |
|---|---|---|---|---|---|
| View routes/availability | Yes | Yes | Yes | Yes | Yes |
| Create booking (web) | Yes | — | — | — | Yes |
| Create booking (desk) | — | Yes | Yes | Yes | — |
| Cash payment | — | Yes | Yes | — | — |
| View all bookings | — | Own shift | Yes | Yes | — |
| Refund | — | — | Yes | Yes | — |
| Disrupt trip | — | — | Yes | Yes | — |
| Manage routes/fares | — | — | — | Yes | — |
| Manage agents | — | — | — | Yes | — |
| Reconciliation | — | Own session | Yes | Yes | — |

---

## 4. API security

### Transport

- HTTPS only in production (TLS 1.2+)
- HSTS headers
- No sensitive data in URL query strings

### Rate limiting

| Actor | Limit | Window |
|---|---|---|
| Public read | 60 requests | 1 minute |
| Booking create | 10 requests | 1 minute |
| Payment initiate | 5 requests | 1 minute |
| Agent authenticated | 120 requests | 1 minute |
| M-Pesa callback | Unlimited | Safaricom IPs only |

### Input validation

- All inputs validated server-side (port `validateBookingInput()` from website)
- Phone numbers normalized before storage
- SQL injection prevented via parameterized queries (ORM)
- XSS prevented via JSON API (no HTML rendering in API)

### CORS

| Origin | Allowed |
|---|---|
| `precifarm.com` | Yes |
| `localhost:3000` (dev) | Yes |
| Agent desk origin | Yes |
| All others | Blocked |

---

## 5. Payment security

### M-Pesa

- Credentials stored in environment variables only (never in code or database)
- Callback endpoint validates Safaricom source IP
- Idempotency keys prevent duplicate processing
- Full callback payload stored in audit log
- Demo mode clearly flagged (`is_demo = true`) to prevent accounting confusion

### Cash

- Cash sessions tied to authenticated agent
- Amount validated against booking total
- Discrepancies require ops review
- No agent can close another agent's session

### Cards (Phase B)

- Hosted checkout (Paystack/Stripe) — no card data touches CMS servers
- PCI DSS compliance via payment provider

---

## 6. Data protection

### Personal data collected

| Field | Purpose | Retention |
|---|---|---|
| Name | Booking, ticket | Duration of booking + 1 year |
| Phone | Booking, SMS, customer lookup | Duration of booking + 1 year |
| Email | Optional contact | Duration of booking + 1 year |
| National ID | Optional (cargo Phase B) | Duration of booking + 1 year |
| M-Pesa receipt | Payment proof | 7 years (financial records) |

### Kenya Data Protection Act (2019)

- Collect minimum necessary data
- Purpose limitation: data used only for booking/ticketing
- Customer can request data export or deletion (via ops)
- Data Processing Agreement with SMS provider
- No sale of customer data to third parties

### Storage

- PostgreSQL encrypted at rest (hosting provider)
- Backups encrypted
- No PII in application logs (phone numbers masked in debug logs)
- Redis holds no PII (only seat IDs and booking draft IDs)

---

## 7. Audit logging

Every state change on bookings, payments, and tickets is logged in `audit_events`.

### Required audit events

| Event | Actor | Payload |
|---|---|---|
| `booking.created` | customer/agent/system | Full booking data |
| `booking.paid` | system/webhook | Payment receipt |
| `booking.cancelled` | agent/ops/customer | Reason |
| `booking.refunded` | ops | Refund details |
| `payment.stk_initiated` | system | CheckoutRequestID |
| `payment.completed` | webhook | M-Pesa receipt |
| `payment.failed` | webhook | Failure reason |
| `payment.reversed` | ops/system | Reversal receipt |
| `ticket.issued` | system | Ticket code |
| `ticket.sms_sent` | system | SMS provider ID |
| `trip.disrupted` | ops | Action + reason |
| `agent.session_opened` | agent | Opening float |
| `agent.session_closed` | agent | Actual vs expected |
| `agent.login` | agent | IP, timestamp |

### Retention

- Audit logs: 7 years
- Application logs: 90 days
- M-Pesa callback payloads: 7 years

---

## 8. Infrastructure security

| Control | Implementation |
|---|---|
| Secrets management | Environment variables; no secrets in git |
| Database access | CMS API only; no direct public access |
| Redis access | Internal network only |
| Dependency scanning | npm audit in CI |
| HTTPS | Required for all production endpoints |
| Backups | Daily PostgreSQL backup; 30-day retention |
| Monitoring | Uptime checks; error rate alerts (Phase B) |

### Deployment

- Separate environments: development, staging, production
- Staging uses M-Pesa sandbox
- Production requires manual approval for deploys
- Database migrations reviewed before apply

---

## 9. Regulatory compliance (Kenya)

From master document open decisions — **legal memo required before public ops.**

| Area | Authority | Status | Notes |
|---|---|---|---|
| PSV licensing | NTSA | **TBD** | Partners hold PSV licences; Precifarm does not |
| Partner ticketing | Legal counsel | **TBD** | Can Precifarm sell tickets for partner-operated vehicles? |
| EPRA (energy) | EPRA | N/A for CMS | Applies to charging hubs, not ticketing |
| Consumer protection | CAK | **TBD** | Refund policy, fare transparency, SMS terms |
| Data protection | ODPC | **TBD** | Registration as data controller |
| Payment services | CBK | **TBD** | M-Pesa aggregation vs own paybill |
| Tax | KRA | **TBD** | VAT on fares; e-TIMS integration (Phase B) |

### Action required

Obtain written legal memo covering items 2, 5, 6, and 7 before accepting live payments from the public.

---

## 10. Incident response

From master document §10 edge cases:

| Incident | Detection | Response | Owner |
|---|---|---|---|
| Payment breach / double charge | Reconciliation drift | Reverse duplicate; notify customer | Ops |
| Unauthorized agent access | Failed login alerts | Disable account; audit actions | Admin |
| Data leak | External report / monitoring | Contain; notify ODPC if required | Admin |
| M-Pesa credential compromise | Unusual transaction pattern | Rotate credentials; audit payments | Admin |
| SMS provider breach | Provider notification | Rotate API key; review sent messages | Admin |
| System outage during peak | Uptime monitor | Agent desk cash-only fallback; comms | Ops |

### Agent desk fallback (payment/telco outage)

From master document: "Controlled fallback; no double charge."

- If M-Pesa is down: agent accepts cash only
- If CMS is down: agent records booking on paper manifest; sync when restored
- Offline limits: max KSh 10,000 cash per booking without system confirmation
- No double charge: paper bookings reconciled against system on recovery
