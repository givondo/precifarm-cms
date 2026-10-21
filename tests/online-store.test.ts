// Hosting at cms.precifarm.com: the store must survive Cloud Run, start with no default accounts,
// take the admin from Secret Manager, and never replace real data with seed data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { hashPassword, verifyPassword } from "../src/lib/security/password";
import { signSessionToken, verifySessionToken } from "../src/lib/security/session";

function withEnv(vars: Record<string, string | undefined>, fn: () => Promise<void> | void) {
  const saved: Record<string, string | undefined> = {};
  for (const k of Object.keys(vars)) saved[k] = process.env[k];
  const env = process.env as Record<string, string | undefined>;
  for (const [k, v] of Object.entries(vars)) v === undefined ? delete env[k] : (env[k] = v);
  return Promise.resolve(fn()).finally(() => {
    for (const [k, v] of Object.entries(saved)) v === undefined ? delete env[k] : (env[k] = v);
  });
}

test("production store: no default accounts, admin from the secret, every write kept", async () => {
  const dir = mkdtempSync(join(tmpdir(), "cms-store-"));
  const hash = hashPassword("a long admin password");
  await withEnv(
    { NODE_ENV: "production", CMS_DATA_DIR: dir, CMS_ADMIN_EMAIL: "David@Precifarm.com", CMS_ADMIN_PASSWORD_HASH: hash, CMS_ADMIN_NAME: "David", DATABASE_URL: undefined, SUPABASE_DB_PASSWORD: undefined, CMS_DEMO_DATA: undefined },
    async () => {
      const store = await import("../src/db/store");
      const s = store.getStore();
      assert.deepEqual(s.agents.map((a) => [a.email, a.role, a.isActive]), [["david@precifarm.com", "admin", true]]);
      assert.ok(verifyPassword("a long admin password", s.agents[0].password).ok);
      assert.equal(s.installOrders.length, 0, "no demo installs in production");
      assert.equal(s.riders.length, 0, "no demo riders in production");

      store.mutateStore((x) => x.customers.push({ id: "c1" } as never));
      store.mutateStore((x) => x.customers.push({ id: "c2" } as never));
      const disk = JSON.parse(readFileSync(join(dir, "store.json"), "utf-8"));
      assert.deepEqual(disk.customers.map((c: { id: string }) => c.id), ["c1", "c2"], "the second write keeps the first");

      // An account still on the password published in earlier versions is retired.
      disk.agents.push({ id: "old", email: "agent@precifarm.com", password: "precifarm2026", name: "Old", role: "agent", isActive: true, createdAt: "" });
      const n = store.normalizeStore(disk);
      assert.ok(n.changed);
      const old = n.store.agents.find((a) => a.id === "old")!;
      assert.equal(old.isActive, false);
      assert.equal(old.password, "");

      // A changed admin hash is a password reset: it takes effect and ends that admin's sessions.
      const next = hashPassword("another long password");
      process.env.CMS_ADMIN_PASSWORD_HASH = next;
      const r = store.normalizeStore(n.store);
      const admin = r.store.agents.find((a) => a.role === "admin")!;
      assert.equal(admin.password, next);
      assert.ok((admin.sessionsNotBefore ?? 0) > 0);

      // A store that cannot be read stops the CMS rather than being replaced with seed data.
      writeFileSync(join(dir, "store.json"), "{ not json");
      assert.throws(() => store.mutateStore(() => {}), /empty or unreadable/);
      assert.equal(readFileSync(join(dir, "store.json"), "utf-8"), "{ not json", "the damaged file is left for repair");

      // Production without any storage refuses to run.
      delete process.env.CMS_DATA_DIR;
      assert.throws(() => store.dataDir(), /No storage configured/);
    },
  );
});

test("sessions carry an issue time, so sign-out can end them", () => {
  const secret = "test-secret-0123456789abcdef0123456789abcdef";
  const now = 1_800_000_000_000;
  const p = verifySessionToken(signSessionToken("agent-1", secret, 3600, now), secret, now + 1000);
  assert.equal(p?.iat, now / 1000);
});

test("a sign-in right after signing out stays valid; sessions from before do not", () => {
  const secret = "test-secret-0123456789abcdef0123456789abcdef";
  const t = 1_800_000_000_500;
  const before = verifySessionToken(signSessionToken("a", secret, 3600, t - 1), secret, t)!;
  const after = verifySessionToken(signSessionToken("a", secret, 3600, t + 1), secret, t + 2)!;
  const notBefore = t; // set by sign-out at time t
  assert.ok(before.iatMs! <= notBefore, "session from before sign-out ends");
  assert.ok(after.iatMs! > notBefore, "sign-in in the same second after sign-out works");
});
