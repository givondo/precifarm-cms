// Public routes that write to PostgreSQL: analytics events, client error reports and the contact
// form. DATABASE_URL points at a closed local port, so every check before the database is exercised
// and nothing ever leaves the machine.
import { test, before, afterEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const DEAD_DB = "postgresql://ci:not-a-real-password@127.0.0.1:1/precifarm";

let events: typeof import("../src/app/api/v1/analytics/events/route");
let errors: typeof import("../src/app/api/v1/analytics/errors/route");
let contact: typeof import("../src/app/api/v1/contact/route");
let ipCounter = 0;

before(async () => {
  delete process.env.SUPABASE_DB_PASSWORD;
  delete process.env.ANALYTICS_INGEST_KEY;
  delete process.env.ANALYTICS_INGEST_ENABLED;
  process.env.DATABASE_URL = DEAD_DB;
  events = await import("../src/app/api/v1/analytics/events/route");
  errors = await import("../src/app/api/v1/analytics/errors/route");
  contact = await import("../src/app/api/v1/contact/route");
});

afterEach(() => {
  process.env.DATABASE_URL = DEAD_DB;
  delete process.env.ANALYTICS_INGEST_KEY;
  delete process.env.ANALYTICS_INGEST_ENABLED;
});

function req(url: string, body: unknown, opts: { ip?: string; raw?: string; headers?: Record<string, string> } = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": opts.ip ?? `192.0.2.${++ipCounter % 250}`, ...opts.headers },
    body: opts.raw ?? JSON.stringify(body),
  });
}
const ev = (overrides: Record<string, unknown> = {}) => ({
  event_id: randomUUID(),
  event_name: "website_cta_clicked",
  event_timestamp: new Date().toISOString(),
  platform: "web",
  anonymous_id: randomUUID(),
  ...overrides,
});
const postEvent = (body: unknown, opts?: Parameters<typeof req>[2]) => events.POST(req("http://localhost/api/v1/analytics/events", body, opts));
const postError = (body: unknown, opts?: Parameters<typeof req>[2]) => errors.POST(req("http://localhost/api/v1/analytics/errors", body, opts));
const postContact = (body: unknown, opts?: Parameters<typeof req>[2]) => contact.POST(req("http://localhost/api/v1/contact", body, opts));

test("without a database the public write routes answer 503 and say nothing about configuration secrets", async () => {
  delete process.env.DATABASE_URL;
  for (const [name, res] of [
    ["events", await postEvent(ev())],
    ["errors", await postError({ message: "boom" })],
    ["contact", await postContact({})],
  ] as const) {
    assert.equal(res.status, 503, name);
    const text = await res.text();
    assert.ok(!text.includes("not-a-real-password"), name);
  }
});

test("analytics ingest can be switched off", async () => {
  process.env.ANALYTICS_INGEST_ENABLED = "false";
  assert.equal((await postEvent(ev())).status, 503);
  assert.equal((await postError({ message: "boom" })).status, 503);
});

test("with ANALYTICS_INGEST_KEY set, events and errors need the key", async () => {
  process.env.ANALYTICS_INGEST_KEY = "ingest-key-0123456789";
  assert.equal((await postEvent(ev())).status, 401);
  assert.equal((await postEvent(ev(), { headers: { "x-analytics-key": "wrong" } })).status, 401);
  assert.equal((await postError({ message: "boom" })).status, 401);
  const ok = await postEvent(ev(), { headers: { "x-analytics-key": "ingest-key-0123456789" } });
  assert.equal(ok.status, 200);
});

test("events: bad JSON, unknown names and junk are refused with 400", async () => {
  const bad = await postEvent(null, { raw: "{ nope" });
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error.code, "INVALID_JSON");
  for (const body of [ev({ event_name: "free_money" }), { events: [] }, { events: [ev(), ev({ platform: "x" })] }, "string", 7]) {
    const res = await postEvent(body);
    assert.equal(res.status, 400, JSON.stringify(body).slice(0, 60));
    assert.equal((await res.json()).error.code, "VALIDATION_ERROR");
  }
});

test("events: an oversized body is refused with 413", async () => {
  const huge = { events: Array.from({ length: 50 }, () => ev({ page_url: "u".repeat(20_000) })) };
  const res = await postEvent(huge);
  assert.equal(res.status, 413);
  assert.equal((await res.json()).error.code, "PAYLOAD_TOO_LARGE");
  // The size is enforced on the bytes read, not just the declared length.
  const sneaky = await events.POST(
    new Request("http://localhost/api/v1/analytics/events", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "192.0.2.251", "content-length": "10" },
      body: JSON.stringify(huge),
    }),
  );
  assert.equal(sneaky.status, 413);
});

test("events: a valid event whose insert fails is answered 200 with accepted 0, never the database error", async () => {
  const res = await postEvent(ev());
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.deepEqual(JSON.parse(text), { data: { accepted: 0, total: 1 } });
  for (const leak of ["ECONNREFUSED", "127.0.0.1", "not-a-real-password", "postgres"]) assert.ok(!text.includes(leak), leak);
  const batch = await postEvent({ events: [ev(), ev()] });
  assert.deepEqual(await batch.json(), { data: { accepted: 0, total: 2 } });
});

test("events: 120 a minute per address", async () => {
  const ip = "198.18.0.10";
  const statuses: number[] = [];
  for (let i = 0; i < 122; i++) statuses.push((await postEvent({}, { ip })).status);
  assert.ok(statuses.slice(0, 120).every((s) => s === 400));
  assert.deepEqual(statuses.slice(120), [429, 429]);
});

test("errors: validation, size and rate limits", async () => {
  assert.equal((await postError(null, { raw: "nope" })).status, 400);
  assert.equal((await postError({ message: "" })).status, 400);
  assert.equal((await postError({ errors: [] })).status, 400);
  assert.equal((await postError({ message: "m".repeat(200_000) })).status, 413);
  const ok = await postError({ message: "boom", request_id: "not-a-uuid" });
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { data: { accepted: 0, total: 1 } });

  const ip = "198.18.0.11";
  const statuses: number[] = [];
  for (let i = 0; i < 61; i++) statuses.push((await postError({}, { ip })).status);
  assert.equal(statuses[59], 400);
  assert.equal(statuses[60], 429);
});

test("contact: bad JSON, invalid fields and oversized bodies are refused before the database", async () => {
  const bad = await postContact(null, { raw: "{" });
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error.code, "INVALID_JSON");
  for (const body of [{}, { name: "Al", email: "x", interest: "General enquiry", message: "Hello there, a question." }]) {
    const res = await postContact(body);
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, "VALIDATION_ERROR");
  }
  const big = await postContact({ name: "Al Bundy", email: "al@example.com", interest: "General enquiry", message: "x".repeat(100_000) });
  assert.equal(big.status, 413);
});

test("contact: 5 submissions a minute per address", async () => {
  const ip = "198.18.0.12";
  const statuses: number[] = [];
  for (let i = 0; i < 7; i++) statuses.push((await postContact({}, { ip })).status);
  assert.deepEqual(statuses, [400, 400, 400, 400, 400, 429, 429]);
});
