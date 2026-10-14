import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

type LoginRoute = typeof import("../src/app/api/auth/login/route");

let login: LoginRoute;
let workDir: string;
const originalCwd = process.cwd();

before(async () => {
  workDir = mkdtempSync(path.join(tmpdir(), "precifarm-login-"));
  process.chdir(workDir);
  delete process.env.DATABASE_URL;
  delete process.env.SUPABASE_DB_PASSWORD;
  process.env.SESSION_SECRET = "test-session-secret-0123456789abcdef0123456789";
  process.env.SEED_ADMIN_PASSWORD = "test-admin-password";
  process.env.SEED_AGENT_PASSWORD = "test-agent-password";
  login = await import("../src/app/api/auth/login/route");
});

after(() => {
  process.chdir(originalCwd);
  rmSync(workDir, { recursive: true, force: true });
});

function attempt(ip: string) {
  return login.POST(
    new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": ip },
      body: JSON.stringify({ email: "nobody@example.com", password: "wrong-password" }),
    })
  );
}

test("login is throttled to 10 attempts per IP per window", async () => {
  const statuses: number[] = [];
  for (let i = 0; i < 12; i++) statuses.push((await attempt("198.51.100.20")).status);
  assert.deepEqual(statuses.slice(0, 10), Array(10).fill(401));
  assert.equal(statuses[10], 429);
  assert.equal(statuses[11], 429);

  // A different client is unaffected.
  assert.equal((await attempt("198.51.100.21")).status, 401);
});
