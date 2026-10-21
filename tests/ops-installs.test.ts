// Staff-only EV desk routes: install pipeline, charging sessions and reconciliation. Calls the route
// handlers inside a minimal Next.js request scope so the real session cookie check runs.
import { withRequestCookies } from "./helpers/request-scope";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { signSessionToken } from "../src/lib/security/session";

const SECRET = "test-session-secret-0123456789abcdef0123456789";

type Db = typeof import("../src/db");
let db: Db;
let stageRoute: typeof import("../src/app/api/v1/ops/installs/[reference]/stage/route");
let installsRoute: typeof import("../src/app/api/v1/ops/installs/route");
let chargingRoute: typeof import("../src/app/api/v1/ops/charging/sessions/route");
let reconRoute: typeof import("../src/app/api/v1/ops/reconciliation/route");
let cookieName: string;
let dataDir: string;
let agentId: string;

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), "precifarm-ops-"));
  process.env.CMS_DATA_DIR = dataDir;
  process.env.CMS_DEMO_DATA = "true";
  process.env.SESSION_SECRET = SECRET;
  delete process.env.DATABASE_URL;
  delete process.env.SUPABASE_DB_PASSWORD;
  process.env.SEED_ADMIN_PASSWORD = "test-admin-password";
  process.env.SEED_AGENT_PASSWORD = "test-agent-password";
  db = await import("../src/db");
  cookieName = (await import("../src/lib/auth")).SESSION_COOKIE;
  stageRoute = await import("../src/app/api/v1/ops/installs/[reference]/stage/route");
  installsRoute = await import("../src/app/api/v1/ops/installs/route");
  chargingRoute = await import("../src/app/api/v1/ops/charging/sessions/route");
  reconRoute = await import("../src/app/api/v1/ops/reconciliation/route");
  const store = await db.getStore();
  agentId = store.agents.find((a) => a.email === "agent@precifarm.com")!.id;
});

after(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

const session = (id = agentId, nowMs = Date.now()) => ({ [cookieName]: signSessionToken(id, SECRET, 3600, nowMs) });

function patchStage(reference: string, body: unknown, cookies: Record<string, string> = session()) {
  return withRequestCookies(cookies, () =>
    stageRoute.PATCH(
      new Request(`http://localhost/api/v1/ops/installs/${reference}/stage`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
      { params: Promise.resolve({ reference }) },
    ),
  );
}

async function order(reference: string) {
  return (await db.getStore()).installOrders.find((o) => o.reference === reference)!;
}

test("every ops route refuses a request without a session", async () => {
  const calls: [string, () => Promise<Response>][] = [
    ["PATCH stage", () => patchStage("PI-000044", { stage: "quoted" }, {})],
    ["GET installs", () => withRequestCookies({}, () => installsRoute.GET())],
    ["GET charging", () => withRequestCookies({}, () => chargingRoute.GET())],
    ["GET reconciliation", () => withRequestCookies({}, () => reconRoute.GET(new Request("http://localhost/api/v1/ops/reconciliation")))],
  ];
  for (const [name, call] of calls) {
    const res = await call();
    assert.equal(res.status, 401, name);
    assert.equal((await res.json()).error.code, "UNAUTHORIZED", name);
  }
  assert.equal((await order("PI-000044")).stage, "survey_requested", "nothing changed");
});

test("forged, expired, unknown and revoked sessions are refused", async () => {
  // Flip the first signature character: the last one carries two padding bits a decoder may ignore.
  const [payloadPart, sig] = session()[cookieName].split(".");
  const forged = `${payloadPart}.${sig[0] === "A" ? "B" : "A"}${sig.slice(1)}`;
  const expired = signSessionToken(agentId, SECRET, 60, Date.now() - 3600_000);
  const unknown = signSessionToken("no-such-agent", SECRET);
  const wrongSecret = signSessionToken(agentId, "another-secret-0123456789abcdef0123456789");
  for (const [label, value] of [["forged", forged], ["expired", expired], ["unknown agent", unknown], ["wrong secret", wrongSecret], ["raw id", agentId]]) {
    const res = await patchStage("PI-000044", { stage: "quoted" }, { [cookieName]: value });
    assert.equal(res.status, 401, label);
  }

  // Signing out sets sessionsNotBefore: a cookie issued before then stops working.
  const old = session(agentId, Date.now() - 5_000);
  const { revokeAgentSessions } = await import("../src/lib/auth");
  await revokeAgentSessions(agentId, Date.now() - 1_000);
  assert.equal((await patchStage("PI-000044", { stage: "quoted" }, old)).status, 401, "revoked");
  assert.equal((await order("PI-000044")).stage, "survey_requested");
});

test("an invalid stage is refused, even when an amount is sent with it", async () => {
  for (const body of [{ stage: "teleported" }, { stage: "teleported", quoteAmount: 50_000 }, { stage: 3 }, {}]) {
    const res = await patchStage("PI-000044", body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal((await res.json()).error.code, "VALIDATION_ERROR");
  }
  const o = await order("PI-000044");
  assert.equal(o.stage, "survey_requested");
  assert.equal(o.quoteAmount, undefined, "the amount sent with a bad stage was not saved");
});

test("negative, non-numeric and non-finite amounts are refused", async () => {
  for (const raw of [
    '{"quoteAmount": -1}',
    '{"depositAmount": -0.5}',
    '{"quoteAmount": "89000"}',
    '{"stage": "quoted", "quoteAmount": "89000"}',
    '{"depositAmount": 1e400}',
    '{"stage": "deposit_paid", "depositAmount": true}',
  ]) {
    const res = await patchStage("PI-000044", raw);
    assert.equal(res.status, 400, raw);
  }
  const o = await order("PI-000044");
  assert.equal(o.stage, "survey_requested");
  assert.equal(o.quoteAmount, undefined);
  assert.equal(o.depositAmount, undefined);
});

test("malformed JSON and an unknown reference are refused", async () => {
  assert.equal((await patchStage("PI-000044", "{ nope")).status, 400);
  const res = await patchStage("PI-999999", { stage: "quoted" });
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.code, "NOT_FOUND");
});

test("a valid stage change is saved and audited with the agent and the prior stage", async () => {
  const res = await patchStage("PI-000044", { stage: " survey_scheduled " });
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(json.data.reference, "PI-000044");
  assert.equal(json.data.stage, "survey_scheduled");

  const store = await db.getStore();
  const o = store.installOrders.find((x) => x.reference === "PI-000044")!;
  assert.equal(o.stage, "survey_scheduled");
  const audit = store.auditEvents.find((e) => e.entityId === o.id && e.action === "stage_survey_scheduled");
  assert.ok(audit);
  assert.equal(audit!.actorType, "agent");
  assert.equal(audit!.actorId, agentId);
  assert.deepEqual(JSON.parse(audit!.payload!), { reference: "PI-000044", priorStage: "survey_requested" });
});

test("amounts sent with a stage change are saved and recorded in its audit entry", async () => {
  const res = await patchStage("PI-000044", { stage: "quoted", quoteAmount: 89_000 });
  assert.equal(res.status, 200);
  const store = await db.getStore();
  const o = store.installOrders.find((x) => x.reference === "PI-000044")!;
  assert.equal(o.stage, "quoted");
  assert.equal(o.quoteAmount, 89_000);
  const audit = store.auditEvents.find((e) => e.entityId === o.id && e.action === "stage_quoted")!;
  const payload = JSON.parse(audit.payload!);
  assert.equal(payload.priorStage, "survey_scheduled");
  assert.equal(payload.quoteAmount, 89_000, "money changes are always in the audit trail");
});

test("an amount-only update is saved and audited as amounts_updated", async () => {
  const res = await patchStage("PI-000044", { depositAmount: 25_000 });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).data.stage, "quoted");
  const store = await db.getStore();
  const o = store.installOrders.find((x) => x.reference === "PI-000044")!;
  assert.equal(o.depositAmount, 25_000);
  assert.equal(o.quoteAmount, 89_000, "the other amount is left alone");
  const audit = store.auditEvents.find((e) => e.entityId === o.id && e.action === "amounts_updated")!;
  assert.equal(audit.actorId, agentId);
  assert.equal(JSON.parse(audit.payload!).depositAmount, 25_000);
});

test("commissioning stamps commissionedAt", async () => {
  const res = await patchStage("PI-000044", { stage: "commissioned" });
  const json = await res.json();
  assert.equal(json.data.stage, "commissioned");
  assert.ok(json.data.commissionedAt);
  assert.equal((await order("PI-000044")).commissionedAt, json.data.commissionedAt);
});

test("GET installs and charging sessions return the store, newest first", async () => {
  const cookies = session();
  const installs = await (await withRequestCookies(cookies, () => installsRoute.GET())).json();
  assert.ok(installs.data.length >= 4);
  const updated = installs.data.map((o: { updatedAt: string }) => o.updatedAt);
  assert.deepEqual(updated, [...updated].sort().reverse());
  assert.equal(installs.data[0].reference, "PI-000044", "most recently changed first");

  const charging = await (await withRequestCookies(cookies, () => chargingRoute.GET())).json();
  assert.ok(charging.data.length >= 3);
  const created = charging.data.map((s: { createdAt: string }) => s.createdAt);
  assert.deepEqual(created, [...created].sort().reverse());
});

test("reconciliation answers for a valid date and refuses a malformed one", async () => {
  const cookies = session();
  const ok = await withRequestCookies(cookies, () =>
    reconRoute.GET(new Request("http://localhost/api/v1/ops/reconciliation?date=2030-01-15")),
  );
  assert.equal(ok.status, 200);
  const report = (await ok.json()).data;
  assert.equal(report.date, "2030-01-15");
  assert.equal(report.mpesa.total, 0);

  const today = await withRequestCookies(cookies, () => reconRoute.GET(new Request("http://localhost/api/v1/ops/reconciliation")));
  assert.equal(today.status, 200);
  assert.match((await today.json()).data.date, /^\d{4}-\d{2}-\d{2}$/);

  // An empty or partial date used to match every record ("".startsWith) and report all time as one day.
  for (const date of ["", "2", "2026-1-5", "yesterday", "2026-13-40"]) {
    const res = await withRequestCookies(cookies, () =>
      reconRoute.GET(new Request(`http://localhost/api/v1/ops/reconciliation?date=${encodeURIComponent(date)}`)),
    );
    assert.equal(res.status, 400, JSON.stringify(date));
  }
});
