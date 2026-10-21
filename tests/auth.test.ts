// src/lib/auth.ts and the API guards built on it: session lookup, revocation, page redirect,
// password sign-in and the admin check.
import { withRequestCookies } from "./helpers/request-scope";
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { signSessionToken } from "../src/lib/security/session";

const SECRET = "test-session-secret-0123456789abcdef0123456789";

type Auth = typeof import("../src/lib/auth");
let auth: Auth;
let db: typeof import("../src/db");
let requireAgent: typeof import("../src/lib/api/require-agent").requireAgent;
let requireAdmin: typeof import("../src/lib/api/require-admin").requireAdmin;
let dataDir: string;
let agentId: string;
let adminId: string;

before(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), "precifarm-auth-"));
  process.env.CMS_DATA_DIR = dataDir;
  process.env.CMS_DEMO_DATA = "false";
  process.env.SESSION_SECRET = SECRET;
  delete process.env.DATABASE_URL;
  delete process.env.SUPABASE_DB_PASSWORD;
  delete process.env.ALLOW_LEGACY_PLAINTEXT;
  process.env.SEED_ADMIN_PASSWORD = "test-admin-password";
  process.env.SEED_AGENT_PASSWORD = "test-agent-password";
  auth = await import("../src/lib/auth");
  db = await import("../src/db");
  requireAgent = (await import("../src/lib/api/require-agent")).requireAgent;
  requireAdmin = (await import("../src/lib/api/require-admin")).requireAdmin;
  const store = await db.getStore();
  agentId = store.agents.find((a) => a.email === "agent@precifarm.com")!.id;
  adminId = store.agents.find((a) => a.email === "admin@precifarm.com")!.id;
});

after(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

const cookieFor = (id: string, nowMs = Date.now()) => ({ [auth.SESSION_COOKIE]: signSessionToken(id, SECRET, 3600, nowMs) });
const as = <T>(cookies: Record<string, string>, fn: () => Promise<T>) => withRequestCookies(cookies, fn);

test("the cookie name is the development one outside production", () => {
  assert.equal(auth.SESSION_COOKIE, "precifarm_agent_session");
});

test("getSessionAgent returns the signed-in agent without secrets", async () => {
  const agent = await as(cookieFor(agentId), () => auth.getSessionAgent());
  assert.ok(agent);
  assert.deepEqual(Object.keys(agent!).sort(), ["branch", "email", "id", "name", "role"]);
  assert.equal(agent!.id, agentId);
  assert.equal(agent!.role, "agent");
});

test("getSessionAgent returns null for no cookie, bad signatures, unknown or deactivated agents", async () => {
  assert.equal(await as({}, () => auth.getSessionAgent()), null);
  assert.equal(await as({ [auth.SESSION_COOKIE]: agentId }, () => auth.getSessionAgent()), null, "raw id");
  assert.equal(await as(cookieFor("ghost"), () => auth.getSessionAgent()), null, "unknown agent");
  const other = { [auth.SESSION_COOKIE]: signSessionToken(agentId, "another-secret-0123456789abcdef0123456789") };
  assert.equal(await as(other, () => auth.getSessionAgent()), null, "wrong secret");

  const store = await db.getStore();
  const temp = { ...store.agents.find((a) => a.id === agentId)!, id: "deactivated-1", email: "gone@precifarm.com", isActive: false };
  await db.mutateStore((s) => s.agents.push(temp));
  assert.equal(await as(cookieFor("deactivated-1"), () => auth.getSessionAgent()), null, "deactivated");
});

test("sign-out ends sessions issued before it, and a later sign-in works", async () => {
  const t = Date.now();
  const before = cookieFor(adminId, t - 10);
  assert.ok(await as(before, () => auth.getSessionAgent()));
  await auth.revokeAgentSessions(adminId, t);
  assert.equal(await as(before, () => auth.getSessionAgent()), null);
  assert.ok(await as(cookieFor(adminId, t + 1), () => auth.getSessionAgent()));
  // A token without an issue time cannot outlive a sign-out.
  const { createHmac } = await import("node:crypto");
  const legacy = Buffer.from(JSON.stringify({ sub: adminId, exp: Math.floor(t / 1000) + 3600 })).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(legacy).digest("base64url");
  assert.equal(await as({ [auth.SESSION_COOKIE]: `${legacy}.${sig}` }, () => auth.getSessionAgent()), null);
});

test("requirePageAgent redirects to /login without a session and returns the agent with one", async () => {
  await assert.rejects(
    as({}, () => auth.requirePageAgent()),
    (err: Error & { digest?: string }) => {
      assert.match(err.digest ?? "", /^NEXT_REDIRECT;[a-z]+;\/login;/);
      return true;
    },
  );
  const agent = await as(cookieFor(agentId), () => auth.requirePageAgent());
  assert.equal(agent.id, agentId);
});

test("requireAgent answers 401; requireAdmin answers 401 signed out and 403 for an agent", async () => {
  const signedOut = await as({}, () => requireAgent());
  assert.equal(signedOut.ok, false);
  if (!signedOut.ok) assert.equal(signedOut.response.status, 401);

  const agentOk = await as(cookieFor(agentId), () => requireAgent());
  assert.ok(agentOk.ok);

  const adminSignedOut = await as({}, () => requireAdmin());
  if (!adminSignedOut.ok) assert.equal(adminSignedOut.response.status, 401);
  else assert.fail("signed out passed requireAdmin");

  const asAgent = await as(cookieFor(agentId), () => requireAdmin());
  if (!asAgent.ok) {
    assert.equal(asAgent.response.status, 403);
    assert.equal((await asAgent.response.json()).error.code, "FORBIDDEN");
  } else assert.fail("an agent passed requireAdmin");

  const asAdmin = await as(cookieFor(adminId, Date.now() + 5), () => requireAdmin());
  assert.ok(asAdmin.ok);
});

test("authenticateAgent: right password signs in, email case and spaces ignored", async () => {
  const agent = await auth.authenticateAgent("  Agent@Precifarm.COM ", "test-agent-password");
  assert.equal(agent?.id, agentId);
  assert.equal((agent as unknown as { password?: string }).password, undefined, "no hash returned");
});

test("authenticateAgent: wrong password, unknown email and deactivated accounts fail", async () => {
  assert.equal(await auth.authenticateAgent("agent@precifarm.com", "wrong"), null);
  assert.equal(await auth.authenticateAgent("nobody@precifarm.com", "test-agent-password"), null);
  assert.equal(await auth.authenticateAgent("gone@precifarm.com", "test-agent-password"), null);
});

test("legacy plaintext passwords only work when allowed, and are upgraded to a hash on use", async () => {
  await db.mutateStore((s) =>
    s.agents.push({ id: "legacy-1", email: "legacy@precifarm.com", password: "plain-legacy-pw", name: "Legacy", role: "agent", isActive: true, createdAt: "" }),
  );
  assert.equal(await auth.authenticateAgent("legacy@precifarm.com", "plain-legacy-pw"), null, "refused by default");
  process.env.ALLOW_LEGACY_PLAINTEXT = "true";
  try {
    assert.equal((await auth.authenticateAgent("legacy@precifarm.com", "plain-legacy-pw"))?.id, "legacy-1");
  } finally {
    delete process.env.ALLOW_LEGACY_PLAINTEXT;
  }
  const stored = (await db.getStore()).agents.find((a) => a.id === "legacy-1")!.password;
  assert.match(stored, /^scrypt\$/);
  assert.equal((await auth.authenticateAgent("legacy@precifarm.com", "plain-legacy-pw"))?.id, "legacy-1", "the hash now works");
});
