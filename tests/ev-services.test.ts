// EV desk services in src/lib/services.ts: install orders, dashboard figures, charging sessions and
// customer records created from public leads. Runs against the JSON file store in a temp directory.
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { StoreChargingSession, StoreInstallOrder } from "../src/lib/ev-ops";

type Services = typeof import("../src/lib/services");
let services: Services;
let db: typeof import("../src/db");
let dataDir: string;

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), "precifarm-ev-"));
  process.env.CMS_DATA_DIR = dataDir;
  process.env.CMS_DEMO_DATA = "false";
  delete process.env.DATABASE_URL;
  delete process.env.SUPABASE_DB_PASSWORD;
  process.env.SEED_ADMIN_PASSWORD = "test-admin-password";
  process.env.SEED_AGENT_PASSWORD = "test-agent-password";
  db = await import("../src/db");
  services = await import("../src/lib/services");
});

after(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

beforeEach(async () => {
  await db.mutateStore((s) => {
    s.installOrders = [];
    s.chargingSessions = [];
    s.customers = [];
    s.auditEvents = [];
  });
});

const HOUR = 3_600_000;
const iso = (ms: number) => new Date(ms).toISOString();

function install(o: Partial<StoreInstallOrder> & Pick<StoreInstallOrder, "reference" | "stage">): StoreInstallOrder {
  const now = new Date().toISOString();
  return {
    id: o.reference,
    customerId: "c",
    product: "pulse",
    city: "Nairobi",
    county: "Nairobi County",
    lipaPolePole: false,
    channel: "web",
    contactName: "Test",
    contactPhone: "254712000000",
    createdAt: now,
    updatedAt: now,
    ...o,
  };
}

function session(o: Partial<StoreChargingSession> & Pick<StoreChargingSession, "reference" | "status">): StoreChargingSession {
  return {
    id: o.reference,
    siteType: "depot",
    siteName: "Westlands Depot",
    city: "Nairobi",
    amountKes: 0,
    paymentMethod: "mpesa",
    createdAt: new Date().toISOString(),
    ...o,
  };
}

test("dashboard: surveys today, pipeline, commissioned, deposits and kWh today", async () => {
  const now = Date.now();
  const longAgo = iso(now - 30 * 24 * HOUR);
  await db.mutateStore((s) => {
    s.installOrders = [
      install({ reference: "PI-000001", stage: "survey_requested" }),
      install({ reference: "PI-000002", stage: "survey_scheduled" }),
      install({ reference: "PI-000003", stage: "survey_requested", createdAt: longAgo }),
      install({ reference: "PI-000004", stage: "quoted", quoteAmount: 89_000 }),
      install({ reference: "PI-000005", stage: "deposit_paid", depositAmount: 25_000, lipaPolePole: true }),
      install({ reference: "PI-000006", stage: "install_scheduled", depositAmount: 50_000, lipaPolePole: true, createdAt: longAgo }),
      install({ reference: "PI-000007", stage: "commissioned", depositAmount: 20_000, lipaPolePole: true, commissionedAt: iso(now), createdAt: longAgo }),
      install({ reference: "PI-000008", stage: "commissioned", commissionedAt: longAgo, createdAt: longAgo, updatedAt: iso(now) }),
      install({ reference: "PI-000009", stage: "survey_requested", lipaPolePole: true }),
    ];
    s.chargingSessions = [
      session({ reference: "CS-1", status: "completed", kwhDelivered: 42.46, amountKes: 1658 }),
      session({ reference: "CS-2", status: "completed", kwhDelivered: 28, amountKes: 1092 }),
      session({ reference: "CS-3", status: "active", kwhDelivered: 3.3 }),
      session({ reference: "CS-4", status: "failed" }),
      session({ reference: "CS-5", status: "completed", kwhDelivered: 100, amountKes: 4000, createdAt: longAgo }),
    ];
  });

  const stats = await services.getEvDashboardStats();
  assert.equal(stats.surveysToday, 3, "requested or scheduled, created today");
  assert.equal(stats.surveyPipeline, 5, "requested, scheduled or quoted, any day");
  assert.equal(stats.commissionedTotal, 2);
  assert.equal(stats.commissionedToday, 1, "by commission date, not last update");
  assert.equal(stats.lipaPolePoleActive, 2, "Lipa Pole Pole with a deposit and not yet commissioned");
  assert.equal(stats.chargingSessionsToday, 4);
  assert.equal(stats.kwhDeliveredToday, 73.8, "rounded to one decimal");
  assert.equal(stats.sessionRevenueTotal, 1658 + 1092 + 4000, "completed sessions only");
  assert.equal(stats.installDepositsTotal, 95_000);
  assert.equal(stats.mpesaCollectedTotal, 1658 + 1092 + 4000 + 95_000);
});

test("dashboard: an empty store gives zeros, not errors", async () => {
  const stats = await services.getEvDashboardStats();
  for (const [k, v] of Object.entries(stats)) assert.equal(v, 0, k);
});

test("charging sessions are listed newest first; install orders by last change, filterable by stage", async () => {
  const now = Date.now();
  await db.mutateStore((s) => {
    s.chargingSessions = [
      session({ reference: "CS-old", status: "completed", createdAt: iso(now - 2 * HOUR) }),
      session({ reference: "CS-new", status: "completed", createdAt: iso(now) }),
      session({ reference: "CS-mid", status: "failed", createdAt: iso(now - HOUR) }),
    ];
    s.installOrders = [
      install({ reference: "PI-000001", stage: "quoted", updatedAt: iso(now - HOUR) }),
      install({ reference: "PI-000002", stage: "survey_requested", updatedAt: iso(now) }),
      install({ reference: "PI-000003", stage: "quoted", updatedAt: iso(now - 2 * HOUR) }),
    ];
  });
  assert.deepEqual((await services.listChargingSessions()).map((s) => s.reference), ["CS-new", "CS-mid", "CS-old"]);
  assert.deepEqual((await services.listInstallOrders()).map((o) => o.reference), ["PI-000002", "PI-000001", "PI-000003"]);
  assert.deepEqual((await services.listInstallOrders({ stage: "quoted" })).map((o) => o.reference), ["PI-000001", "PI-000003"]);
});

test("updateInstallStage: unknown reference is 404; a system change is audited as system", async () => {
  assert.deepEqual(await services.updateInstallStage("PI-404404", "quoted"), { error: "Install order not found.", status: 404 });
  await db.mutateStore((s) => s.installOrders.push(install({ reference: "PI-000010", stage: "quoted" })));
  const r = await services.updateInstallStage("PI-000010", "deposit_paid", undefined, { depositAmount: 30_000 });
  assert.equal(r.status, 200);
  const store = await db.getStore();
  assert.equal(store.installOrders[0].depositAmount, 30_000);
  const audit = store.auditEvents.find((e) => e.action === "stage_deposit_paid")!;
  assert.equal(audit.actorType, "system");
  assert.equal(JSON.parse(audit.payload!).depositAmount, 30_000);
});

test("a lead with a phone is linked to the customer with that phone, in any format", async () => {
  await db.mutateStore((s) =>
    s.customers.push({ id: "cust-1", phoneE164: "254712345678", name: "Samuel Kariuki", email: "samuel@example.com", createdAt: "", updatedAt: "" }),
  );
  const r = await services.createInstallSurveyFromLead({
    name: "Samuel K",
    email: "samuel@example.com",
    phone: "+254 712 345 678",
    interest: "Home charger installation",
    message: "City: Nairobi\nProduct interest: Pulse charger",
  });
  assert.equal(r.skipped, false);
  const store = await db.getStore();
  assert.equal(store.customers.length, 1);
  assert.equal(store.installOrders[0].customerId, "cust-1");
});

test("an unauthenticated lead cannot rename a customer or replace their email", async () => {
  await db.mutateStore((s) =>
    s.customers.push({ id: "cust-2", phoneE164: "254722000303", name: "Brian Omondi", email: "brian@example.com", createdAt: "", updatedAt: "" }),
  );
  await services.createInstallSurveyFromLead({
    name: "Mallory",
    email: "mallory@evil.example",
    phone: "0722 000 303",
    interest: "Home charger installation",
    message: "City: Kisumu\nProduct interest: Pod",
  });
  const store = await db.getStore();
  const c = store.customers.find((x) => x.id === "cust-2")!;
  assert.equal(c.name, "Brian Omondi");
  assert.equal(c.email, "brian@example.com");
  // The lead's own details are kept on the install order for staff to check.
  assert.equal(store.installOrders[0].contactName, "Mallory");
  assert.equal(store.installOrders[0].contactEmail, "mallory@evil.example");
});

test("a lead without a phone is never merged into another customer who merely shares the name", async () => {
  await db.mutateStore((s) =>
    s.customers.push({ id: "cust-3", phoneE164: "254733000202", name: "John Kamau", email: "john.real@example.com", createdAt: "", updatedAt: "" }),
  );
  await services.createInstallSurveyFromLead({
    name: "John Kamau",
    email: "another.john@example.com",
    interest: "Home charger installation",
    message: "City: Nakuru\nProduct interest: Spark portable charger",
  });
  const store = await db.getStore();
  assert.equal(store.customers.find((x) => x.id === "cust-3")!.email, "john.real@example.com", "the real customer is untouched");
  assert.equal(store.customers.length, 2, "a separate record is created");
  const lead = store.customers.find((x) => x.id !== "cust-3")!;
  assert.equal(lead.email, "another.john@example.com");
  assert.notEqual(store.installOrders[0].customerId, "cust-3");
});

test("a lead without a phone reuses the customer with the same email and fills in blanks only", async () => {
  await db.mutateStore((s) =>
    s.customers.push({ id: "cust-4", phoneE164: "254701000404", email: "faith@example.com", createdAt: "", updatedAt: "" }),
  );
  await services.createInstallSurveyFromLead({
    name: "Faith Wanjiru",
    email: "Faith@Example.com",
    interest: "Home charger installation",
    message: "City: Eldoret\nProduct interest: Pulse",
  });
  const store = await db.getStore();
  assert.equal(store.customers.length, 1);
  assert.equal(store.customers[0].name, "Faith Wanjiru", "a missing name is filled in");
  assert.equal(store.installOrders[0].customerId, "cust-4");
  assert.equal(store.installOrders[0].city, "Eldoret");
  assert.equal(store.installOrders[0].county, "Uasin Gishu County");
});
