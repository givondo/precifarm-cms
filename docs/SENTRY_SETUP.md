# Error monitoring (Phase 5)

Precifarm uses a **first-party error pipeline** into `analytics_errors`. Optional Sentry can run alongside it.

## First-party pipeline (implemented)

**POST** `/api/v1/analytics/errors`

Single error:

```json
{
  "message": "Payment widget failed to mount",
  "platform": "web",
  "environment": "production",
  "error_category": "client_error",
  "severity": "error",
  "endpoint": "/book",
  "anonymous_id": "550e8400-e29b-41d4-a716-446655440000",
  "metadata": { "component": "BookingPortal" }
}
```

Batch: `{ "errors": [ ... ] }`

Optional header: `X-Analytics-Key` when `ANALYTICS_INGEST_KEY` is set.

### Client wiring

| App | Mechanism |
|---|---|
| Website | `initClientErrorHandlers()` in `AnalyticsProvider` → `/api/analytics/errors` proxy |
| Mobile | `trackClientError()` in `lib/analytics.ts` |
| CMS | Server routes can call `insertAnalyticsError()` directly |

PII is scrubbed from `metadata` keys containing `password`, `token`, `secret`, `phone`, `email`.

View errors in CMS **Analytics → Engineering health** or Metabase `vw_error_event_summary`.

## Optional Sentry (recommended for mobile crashes)

Sentry is **not required** for v1 analytics. Add when you need stack traces, release tracking, and crash grouping.

### Mobile (Expo)

```bash
npx expo install @sentry/react-native
npx @sentry/wizard@latest -i reactNative
```

Set in EAS secrets:

```
EXPO_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

In `app/_layout.tsx`, call Sentry init before analytics. Keep `trackClientError` for CMS-side correlation.

### Website / CMS (Next.js)

```bash
npx @sentry/wizard@latest -i nextjs
```

Set `SENTRY_DSN` (server) and `NEXT_PUBLIC_SENTRY_DSN` (client) in Netlify.

### Dual-write pattern

If Sentry is enabled, optionally forward to CMS in `beforeSend`:

```javascript
// Pseudocode — in sentry client config
beforeSend(event) {
  fetch("/api/analytics/errors", {
    method: "POST",
    body: JSON.stringify({
      message: event.exception?.values?.[0]?.value ?? event.message,
      platform: "web",
      error_category: "sentry",
      severity: event.level ?? "error",
      metadata: { sentry_event_id: event.event_id },
    }),
  });
  return event;
}
```

Scrub PII in Sentry project settings before enabling in production.

## Environment variables

| Variable | App | Purpose |
|---|---|---|
| `ANALYTICS_INGEST_KEY` | CMS, website, mobile | Protects errors + events ingest |
| `SENTRY_DSN` | CMS, website | Optional Sentry server |
| `NEXT_PUBLIC_SENTRY_DSN` | Website | Optional Sentry client |
| `EXPO_PUBLIC_SENTRY_DSN` | Mobile | Optional Sentry |
