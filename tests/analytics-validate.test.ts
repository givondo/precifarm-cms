// Validation for the public analytics ingest (events and client errors), which is open to anyone
// while ANALYTICS_INGEST_KEY is unset, plus the pure parts of the server-side tracker.
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { validateAnalyticsBatch, validateAnalyticsEvent } from "../src/lib/analytics/validate";
import { validateAnalyticsError, validateAnalyticsErrorBatch } from "../src/lib/analytics/error-validate";
import { isAllowedEventName } from "../src/lib/analytics/catalog";
import { channelToPlatform } from "../src/lib/analytics/server";
import { getAnalyticsEnvironment, getAnalyticsIngestKey, isAnalyticsIngestEnabled } from "../src/lib/analytics/environment";

const event = (overrides: Record<string, unknown> = {}) => ({
  event_id: randomUUID(),
  event_name: "website_page_viewed",
  event_timestamp: new Date().toISOString(),
  platform: "web",
  anonymous_id: randomUUID(),
  event_properties: { path: "/home-charging" },
  ...overrides,
});

test("a well formed website event is accepted and normalised", () => {
  const ts = "2026-10-21T10:00:00+03:00";
  const r = validateAnalyticsEvent(event({ event_timestamp: new Date(Date.parse(ts)).toISOString() }));
  assert.ok(r.ok);
  assert.equal(r.event.schema_version, 1);
  assert.equal(r.event.platform, "web");
  assert.deepEqual(r.event.event_properties, { path: "/home-charging" });
});

test("junk bodies and unknown event names are refused", () => {
  for (const [label, body] of [
    ["null", null],
    ["string", "website_page_viewed"],
    ["number", 42],
    ["unknown event", event({ event_name: "website_free_money" })],
    ["empty event", event({ event_name: "" })],
    ["event name as object", event({ event_name: { name: "website_page_viewed" } })],
    ["prototype name", event({ event_name: "constructor" })],
    ["bad event id", event({ event_id: "1234" })],
    ["no event id", event({ event_id: undefined })],
    ["bad platform", event({ platform: "toaster" })],
    ["bad schema", event({ schema_version: 2 })],
    ["bad timestamp", event({ event_timestamp: "yesterday" })],
    ["old timestamp", event({ event_timestamp: new Date(Date.now() - 8 * 86_400_000).toISOString() })],
    ["future timestamp", event({ event_timestamp: new Date(Date.now() + 8 * 86_400_000).toISOString() })],
    ["no identity", event({ anonymous_id: undefined })],
    ["bad anonymous id", event({ anonymous_id: "anon-1" })],
    ["bad customer id", event({ customer_id: "c1" })],
    ["bad session id", event({ session_id: "<script>" })],
  ] as const) {
    assert.equal(validateAnalyticsEvent(body).ok, false, label);
  }
  assert.equal(isAllowedEventName("__proto__"), false);
});

test("the environment label is limited to known values, so clients cannot invent or bloat it", () => {
  for (const environment of ["production", "staging", "development"]) {
    const r = validateAnalyticsEvent(event({ environment }));
    assert.ok(r.ok);
    assert.equal(r.event.environment, environment);
  }
  for (const environment of ["prod", "x".repeat(100_000), 7, { a: 1 }]) {
    const r = validateAnalyticsEvent(event({ environment }));
    assert.ok(r.ok, "the event itself is still accepted");
    assert.equal(r.event.environment, undefined, "the server decides instead");
  }
});

test("PII keys are stripped from properties and metadata, in any case", () => {
  const r = validateAnalyticsEvent(
    event({
      event_properties: { phone: "0712345678", Email: "a@b.co", ID_NUMBER: "123", idNumber: "9", password: "x", token: "t", contact_name: "n", product: "pulse" },
      metadata: { mpesa_pin: "1234", cvv: "123", ok: true },
    }),
  );
  assert.ok(r.ok);
  assert.deepEqual(r.event.event_properties, { product: "pulse" });
  assert.deepEqual(r.event.metadata, { ok: true });
});

test("oversized fields are cut down and nested values dropped", () => {
  const props: Record<string, unknown> = { nested: { deep: true }, list: [1, 2], long: "v".repeat(10_000), n: 1, b: false, z: null };
  for (let i = 0; i < 80; i++) props[`k${i}`] = i;
  const r = validateAnalyticsEvent(
    event({
      event_properties: props,
      page_url: `https://precifarm.com/${"p".repeat(10_000)}`,
      app_version: "1".repeat(100),
      device_id: "d".repeat(500),
      screen_name: "s".repeat(500),
      booking_reference: "b".repeat(100),
      request_id: "not-a-uuid",
    }),
  );
  assert.ok(r.ok);
  const p = r.event.event_properties!;
  assert.equal(Object.keys(p).length, 50, "at most 50 properties");
  assert.equal(p.nested, undefined);
  assert.equal(p.list, undefined);
  assert.equal((p.long as string).length, 512);
  assert.equal(r.event.page_url!.length, 2048);
  assert.equal(r.event.app_version!.length, 32);
  assert.equal(r.event.device_id!.length, 64);
  assert.equal(r.event.screen_name!.length, 128);
  assert.equal(r.event.booking_reference!.length, 32);
  assert.equal(r.event.request_id, undefined);
});

test("property names are bounded too: a huge key is dropped, not stored", () => {
  const bigKey = "k".repeat(100_000);
  const r = validateAnalyticsEvent(event({ event_properties: { [bigKey]: 1, ok: 2 }, metadata: { [bigKey]: "x", fine: "y" } }));
  assert.ok(r.ok);
  assert.deepEqual(r.event.event_properties, { ok: 2 });
  assert.deepEqual(r.event.metadata, { fine: "y" });
});

test("batches: 1 to 50 events, each validated", () => {
  assert.equal(validateAnalyticsBatch("x")[0].ok, false);
  assert.equal(validateAnalyticsBatch([])[0].ok, false);
  assert.equal(validateAnalyticsBatch(Array.from({ length: 51 }, () => event()))[0].ok, false);
  const results = validateAnalyticsBatch([event(), event({ event_name: "nope" })]);
  assert.deepEqual(results.map((r) => r.ok), [true, false]);
});

test("client error reports: message required, severity and platform limited, sizes bounded", () => {
  assert.equal(validateAnalyticsError(null).ok, false);
  assert.equal(validateAnalyticsError({}).ok, false);
  assert.equal(validateAnalyticsError({ message: "   " }).ok, false);
  const r = validateAnalyticsError({
    message: `  ${"m".repeat(5000)}  `,
    severity: "apocalyptic",
    platform: "fridge",
    environment: "prod",
    error_category: "c".repeat(200),
    endpoint: "e".repeat(1000),
  });
  assert.ok(r.ok);
  assert.equal(r.error.message!.length, 2000);
  assert.equal(r.error.severity, "error");
  assert.equal(r.error.platform, undefined);
  assert.equal(r.error.environment, undefined);
  assert.equal(r.error.error_category!.length, 64);
  assert.equal(r.error.endpoint!.length, 256);
});

test("client error ids and times must be well formed, or they are dropped", () => {
  // These go into uuid and timestamp columns; a bad value made the whole insert fail silently.
  const r = validateAnalyticsError({
    message: "boom",
    error_id: "abc",
    request_id: "x".repeat(10_000),
    anonymous_id: "anon",
    occurred_at: "not a date",
  });
  assert.ok(r.ok);
  assert.equal(r.error.error_id, undefined);
  assert.equal(r.error.request_id, undefined);
  assert.equal(r.error.anonymous_id, undefined);
  assert.equal(r.error.occurred_at, undefined);

  const id = randomUUID();
  const when = new Date().toISOString();
  const good = validateAnalyticsError({ message: "boom", error_id: id, request_id: id, anonymous_id: id, occurred_at: when });
  assert.ok(good.ok);
  assert.equal(good.error.error_id, id);
  assert.equal(good.error.occurred_at, when);
});

test("client error metadata is bounded: primitives only, limited keys and lengths", () => {
  const meta: Record<string, unknown> = { nested: { a: 1 }, arr: [1], long: "l".repeat(5000), ["k".repeat(1000)]: 1 };
  for (let i = 0; i < 200; i++) meta[`m${i}`] = i;
  const r = validateAnalyticsError({ message: "boom", metadata: meta });
  assert.ok(r.ok);
  const m = r.error.metadata!;
  assert.ok(Object.keys(m).length <= 50, `${Object.keys(m).length} keys`);
  assert.equal(m.nested, undefined);
  assert.equal(m.arr, undefined);
  assert.ok((m.long as string).length <= 500);
  assert.ok(Object.keys(m).every((k) => k.length <= 64));
  const arr = validateAnalyticsError({ message: "boom", metadata: [1, 2] });
  assert.ok(arr.ok);
  assert.equal(arr.error.metadata, undefined, "an array is not metadata");
});

test("client error batches: 1 to 20, the first bad one refuses the batch", () => {
  assert.equal(validateAnalyticsErrorBatch(null).ok, false);
  assert.equal(validateAnalyticsErrorBatch({ errors: "x" }).ok, false);
  assert.equal(validateAnalyticsErrorBatch({ errors: [] }).ok, false);
  assert.equal(validateAnalyticsErrorBatch({ errors: Array.from({ length: 21 }, () => ({ message: "m" })) }).ok, false);
  assert.equal(validateAnalyticsErrorBatch({ errors: [{ message: "m" }, {}] }).ok, false);
  const ok = validateAnalyticsErrorBatch({ errors: [{ message: "a" }, { message: "b" }] });
  assert.ok(ok.ok);
  assert.equal(ok.errors.length, 2);
});

test("server events map booking channels to platforms", () => {
  assert.equal(channelToPlatform(undefined), "server");
  assert.equal(channelToPlatform("web"), "web");
  assert.equal(channelToPlatform("pwa"), "mobile");
  assert.equal(channelToPlatform("mobile"), "mobile");
  assert.equal(channelToPlatform("agent_walkin"), "cms");
  assert.equal(channelToPlatform("agent_callin"), "cms");
  assert.equal(channelToPlatform("kiosk"), "server");
});

test("analytics environment never defaults to production, and ingest switches read the env", () => {
  const env = process.env as Record<string, string | undefined>;
  const keys = ["ANALYTICS_ENVIRONMENT", "VERCEL_ENV", "NETLIFY_CONTEXT", "NETLIFY", "VERCEL", "NODE_ENV", "ANALYTICS_INGEST_ENABLED", "ANALYTICS_INGEST_KEY"];
  const saved = Object.fromEntries(keys.map((k) => [k, env[k]]));
  try {
    for (const k of keys) delete env[k];
    assert.equal(getAnalyticsEnvironment(), "development");
    env.NODE_ENV = "production";
    assert.equal(getAnalyticsEnvironment(), "development", "production NODE_ENV alone is not enough");
    env.ANALYTICS_ENVIRONMENT = "production";
    assert.equal(getAnalyticsEnvironment(), "production");
    env.ANALYTICS_ENVIRONMENT = "deploy-preview";
    assert.equal(getAnalyticsEnvironment(), "staging");
    assert.equal(isAnalyticsIngestEnabled(), true);
    env.ANALYTICS_INGEST_ENABLED = "false";
    assert.equal(isAnalyticsIngestEnabled(), false);
    assert.equal(getAnalyticsIngestKey(), undefined);
    env.ANALYTICS_INGEST_KEY = "  k  ";
    assert.equal(getAnalyticsIngestKey(), "k");
  } finally {
    for (const [k, v] of Object.entries(saved)) v === undefined ? delete env[k] : (env[k] = v);
  }
});
