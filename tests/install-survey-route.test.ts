// Public home charging survey intake (POST /api/v1/installs/survey), against the JSON file store in
// a temporary CMS_DATA_DIR.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

type Db = typeof import("../src/db");
type SurveyRoute = typeof import("../src/app/api/v1/installs/survey/route");

let db: Db;
let route: SurveyRoute;
let dataDir: string;
let ipCounter = 0;
/** Requests accepted (201) in this file: each one counts towards the overall hourly cap. */
let accepted = 0;

const HOME_INTEREST = "Home charger installation (Pulse charger or Pod energy storage)";

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), "precifarm-survey-"));
  process.env.CMS_DATA_DIR = dataDir;
  process.env.CMS_DEMO_DATA = "false";
  delete process.env.DATABASE_URL;
  delete process.env.SUPABASE_DB_PASSWORD;
  process.env.SEED_ADMIN_PASSWORD = "test-admin-password";
  process.env.SEED_AGENT_PASSWORD = "test-agent-password";
  db = await import("../src/db");
  route = await import("../src/app/api/v1/installs/survey/route");
});

after(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

/** A fresh client address per call unless one is given, so the per-IP limit does not interfere. */
async function post(body: unknown, opts: { ip?: string; raw?: string } = {}) {
  const ip = opts.ip ?? `198.51.100.${++ipCounter % 250}`;
  const res = await route.POST(
    new Request("http://localhost/api/v1/installs/survey", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: opts.raw ?? JSON.stringify(body),
    }),
  );
  if (res.status === 201) accepted++;
  return res;
}

let emailCounter = 0;
function survey(overrides: Record<string, unknown> = {}) {
  return {
    name: "Brian Omondi",
    email: `brian${++emailCounter}@example.co.ke`,
    phone: "0722 000 303",
    interest: HOME_INTEREST,
    message: ["City: Kisumu", "Product interest: Pod energy storage, home charging plus backup", "Lipa Pole Pole: yes"].join("\n"),
    channel: "web-private-house",
    anonymousId: "6f1c1f4e-8d0a-4b8e-9a51-1d2c3b4a5f60",
    ...overrides,
  };
}

test("a valid survey creates an install order at survey_requested and answers 201", async () => {
  const body = survey({ email: "Amina.Hassan@Example.com" });
  const res = await post(body);
  assert.equal(res.status, 201);
  const json = await res.json();
  assert.equal(json.data.received, true);
  const io = json.data.installOrder;
  assert.match(io.reference, /^PI-\d{6}$/);
  assert.equal(io.stage, "survey_requested");
  assert.equal(io.product, "pod");
  assert.deepEqual(Object.keys(io).sort(), ["id", "product", "reference", "stage"], "only public fields are returned");

  const store = await db.getStore();
  const order = store.installOrders.find((o) => o.reference === io.reference)!;
  assert.ok(order);
  assert.equal(order.stage, "survey_requested");
  assert.equal(order.city, "Kisumu");
  assert.equal(order.county, "Kisumu County");
  assert.equal(order.lipaPolePole, true);
  assert.equal(order.channel, "web-private-house");
  assert.equal(order.contactEmail, "amina.hassan@example.com");
  assert.equal(order.contactPhone, "254722000303", "phone stored in M-Pesa format");

  const audit = store.auditEvents.find((e) => e.entityId === order.id && e.action === "survey_requested");
  assert.ok(audit, "survey is audited");
  assert.equal(audit!.actorType, "customer");
});

test("references follow PI-000000 and count up from the highest existing one", async () => {
  await db.mutateStore((s) => {
    s.installOrders.push({ ...s.installOrders[0], id: "seed-high", reference: "PI-000120", contactEmail: "seed@example.com" });
  });
  const res = await post(survey());
  assert.equal((await res.json()).data.installOrder.reference, "PI-000121");
});

test("concurrent surveys each get their own reference", async () => {
  const results = await Promise.all(Array.from({ length: 4 }, () => post(survey())));
  const refs = await Promise.all(results.map(async (r) => (await r.json()).data.installOrder.reference as string));
  assert.equal(new Set(refs).size, refs.length, `references must be unique, got ${refs.join(", ")}`);
  const store = await db.getStore();
  for (const ref of refs) {
    assert.equal(store.installOrders.filter((o) => o.reference === ref).length, 1, ref);
  }
});

test("a second survey from the same email on the same day is reported as a duplicate, not saved twice", async () => {
  const body = survey({ email: "repeat@example.com" });
  const first = await (await post(body)).json();
  const again = await post({ ...body, email: " REPEAT@example.com " });
  assert.equal(again.status, 201);
  const json = await again.json();
  assert.deepEqual(json.data.installOrder, { reference: first.data.installOrder.reference, duplicate: true });
  const store = await db.getStore();
  assert.equal(store.installOrders.filter((o) => o.contactEmail === "repeat@example.com").length, 1);
});

test("a double submission sent at the same moment saves one order", async () => {
  const body = survey({ email: "doubleclick@example.com" });
  const [a, b] = await Promise.all([post(body), post(body)]);
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  const store = await db.getStore();
  assert.equal(store.installOrders.filter((o) => o.contactEmail === "doubleclick@example.com").length, 1);
});

test("a lead that is not about home charging is received without an install order", async () => {
  const before = (await db.getStore()).installOrders.length;
  const res = await post(survey({ interest: "General enquiry", message: "We host a podcast and would like an interview." }));
  assert.equal(res.status, 201);
  assert.deepEqual((await res.json()).data, { received: true, installOrder: null });
  assert.equal((await db.getStore()).installOrders.length, before);
});

test("malformed JSON is refused with 400 and a fixed message", async () => {
  const res = await post(null, { raw: "{ not json" });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: { code: "INVALID_JSON", message: "Invalid JSON body." } });
  assert.equal((await post(null, { raw: "" })).status, 400, "an empty body is malformed too");
});

test("missing or malformed phone is refused: the installation team calls this number", async () => {
  for (const phone of [undefined, "", "12345", "0812 345 678", "+44 20 7946 0958", "07123456789012"]) {
    const res = await post(survey({ phone }));
    assert.equal(res.status, 400, `phone ${JSON.stringify(phone)}`);
    const json = await res.json();
    assert.equal(json.error.code, "VALIDATION_ERROR");
    assert.match(json.error.message, /phone/i);
  }
});

test("Kenyan phone formats are all accepted and stored the same way", async () => {
  for (const phone of ["0712345678", "+254712345678", "254712345678", "0112 345 678", "+254 112 345 678"]) {
    const res = await post(survey({ phone }));
    assert.equal(res.status, 201, phone);
    const ref = (await res.json()).data.installOrder.reference;
    const order = (await db.getStore()).installOrders.find((o) => o.reference === ref)!;
    assert.match(order.contactPhone, /^254[17]\d{8}$/, phone);
  }
});

test("missing or malformed email, name and message are refused", async () => {
  for (const [label, body] of [
    ["no email", survey({ email: undefined })],
    ["bad email", survey({ email: "no-at-sign" })],
    ["no name", survey({ name: "" })],
    ["short message", survey({ message: "hi" })],
    ["oversized message", survey({ message: "x".repeat(5001) })],
    ["oversized name", survey({ name: "n".repeat(500) })],
    ["oversized channel", survey({ channel: "c".repeat(1000) })],
    ["array body", []],
  ] as const) {
    const res = await post(body);
    assert.equal(res.status, 400, label);
    assert.equal((await res.json()).error.code, "VALIDATION_ERROR", label);
  }
});

test("an oversized request body is refused before it is parsed", async () => {
  const res = await post(survey({ notes: "x".repeat(200_000) }));
  assert.equal(res.status, 413);
  assert.equal((await res.json()).error.code, "PAYLOAD_TOO_LARGE");
});

test("validation errors never echo the submitted values", async () => {
  const secret = "sk_live_should_not_echo_0123456789";
  const res = await post(survey({ email: `${secret}`, phone: secret }));
  assert.equal(res.status, 400);
  assert.ok(!(await res.text()).includes(secret));
});

test("the same address is limited to 5 surveys a minute, including refused ones", async () => {
  const ip = "203.0.113.50";
  const statuses: number[] = [];
  for (let i = 0; i < 7; i++) statuses.push((await post({}, { ip })).status);
  assert.deepEqual(statuses, [400, 400, 400, 400, 400, 429, 429]);
  const res = await post(survey(), { ip });
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error.code, "RATE_LIMITED");
  // Another address is unaffected.
  assert.equal((await post(survey(), { ip: "203.0.113.51" })).status, 201);
});

test("saved surveys are capped at 60 an hour across all addresses; refused requests do not count", async () => {
  // Junk from many addresses first: refused, and it must not use up the overall allowance.
  for (let i = 0; i < 15; i++) assert.equal((await post({ name: "x" })).status, 400);

  // Earlier tests in this file have already saved some surveys; fill up to the cap.
  let status = 201;
  for (let i = 0; i < 80 && status === 201; i++) status = (await post(survey())).status;
  assert.equal(status, 429, "the cap is reached");

  assert.equal(accepted, 60, "exactly 60 accepted in the hour; refused requests did not count");

  const res = await post(survey());
  assert.equal(res.status, 429);
  assert.match((await res.json()).error.message, /Too many survey requests/);
});
