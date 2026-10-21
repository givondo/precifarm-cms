// The edge middleware: host allow-list, sign-in redirect for desk pages, the HMAC session check,
// cross-site write refusal and security headers.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../src/middleware";
import { signedSessionValid } from "../src/lib/security/edge-session";
import { signSessionToken } from "../src/lib/security/session";

const SECRET = "test-session-secret-0123456789abcdef0123456789";
const env = process.env as Record<string, string | undefined>;
const saved = { CMS_ALLOWED_HOSTS: env.CMS_ALLOWED_HOSTS, SESSION_SECRET: env.SESSION_SECRET, NODE_ENV: env.NODE_ENV };

afterEach(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete env[k];
    else env[k] = v;
  }
});

function req(
  pathname: string,
  opts: { host?: string; method?: string; cookie?: string; origin?: string; proto?: string } = {},
) {
  const host = opts.host ?? "cms.precifarm.com";
  const headers = new Headers({ host });
  if (opts.cookie) headers.set("cookie", opts.cookie);
  if (opts.origin) headers.set("origin", opts.origin);
  if (opts.proto) headers.set("x-forwarded-proto", opts.proto);
  return new NextRequest(`https://${host}${pathname}`, { method: opts.method ?? "GET", headers });
}

const isNext = (res: Response) => res.headers.get("x-middleware-next") === "1";
const validCookie = () => `precifarm_agent_session=${signSessionToken("agent-1", SECRET)}`;

test("public pages and every API path pass through without a session", async () => {
  env.SESSION_SECRET = SECRET;
  for (const p of ["/", "/login", "/robots.txt", "/icon.svg", "/api/v1/installs/survey", "/api/v1/contact", "/api/v1/analytics/events", "/api/v1/payments/mpesa/callback", "/api/v1/ops/installs"]) {
    const res = await middleware(req(p));
    assert.ok(isNext(res), p);
  }
});

test("desk pages redirect to /login without a valid session", async () => {
  env.SESSION_SECRET = SECRET;
  const forged = `precifarm_agent_session=${signSessionToken("agent-1", "another-secret-0123456789abcdef0123456789")}`;
  const expired = `precifarm_agent_session=${signSessionToken("agent-1", SECRET, 60, Date.now() - 3600_000)}`;
  for (const cookie of [undefined, "precifarm_agent_session=agent-1", forged, expired, `precifarm_agent_session=${"a".repeat(2000)}.b`]) {
    for (const p of ["/dashboard", "/installs", "/charging-sessions", "/reconciliation", "/customers"]) {
      const res = await middleware(req(p, { cookie, proto: "https" }));
      assert.equal(res.status, 307, `${p} ${cookie?.slice(0, 40)}`);
      assert.equal(res.headers.get("location"), "https://cms.precifarm.com/login");
    }
  }
});

test("desk pages open with a validly signed session, under either cookie name", async () => {
  env.SESSION_SECRET = SECRET;
  assert.ok(isNext(await middleware(req("/dashboard", { cookie: validCookie() }))));
  const hostCookie = `__Host-precifarm_agent_session=${signSessionToken("agent-1", SECRET)}`;
  assert.ok(isNext(await middleware(req("/installs", { cookie: hostCookie }))));
});

test("in production a missing or short SESSION_SECRET keeps every desk page closed", async () => {
  env.NODE_ENV = "production";
  for (const secret of [undefined, "too-short"]) {
    if (secret === undefined) delete env.SESSION_SECRET;
    else env.SESSION_SECRET = secret;
    const res = await middleware(req("/dashboard", { cookie: validCookie() }));
    assert.equal(res.status, 307, `secret ${secret}`);
  }
});

test("only the hosts in CMS_ALLOWED_HOSTS are answered; health answers everywhere", async () => {
  env.SESSION_SECRET = SECRET;
  env.CMS_ALLOWED_HOSTS = " cms.precifarm.com , API.precifarm.com ";
  assert.ok(isNext(await middleware(req("/login", { host: "cms.precifarm.com" }))));
  assert.ok(isNext(await middleware(req("/api/v1/installs/survey", { host: "api.precifarm.com", method: "POST" }))));
  assert.ok(isNext(await middleware(req("/login", { host: "CMS.Precifarm.com" }))), "host match ignores case");

  for (const host of ["evil.example", "cms.precifarm.com.evil.example", "precifarm-cms-xyz.a.run.app"]) {
    const res = await middleware(req("/api/v1/installs/survey", { host, method: "POST" }));
    assert.equal(res.status, 421, host);
    assert.equal(res.headers.get("x-frame-options"), "DENY", "refusals carry the headers too");
  }
  assert.ok(isNext(await middleware(req("/api/v1/health", { host: "precifarm-cms-xyz.a.run.app" }))));
});

test("cross-site writes that carry a session cookie are refused; same-site and cookieless ones pass", async () => {
  env.SESSION_SECRET = SECRET;
  const cookie = validCookie();
  const cross = await middleware(req("/api/v1/ops/installs/PI-000001/stage", { method: "PATCH", cookie, origin: "https://evil.example" }));
  assert.equal(cross.status, 403);
  assert.equal((await cross.json()).error.code, "FORBIDDEN");
  const opaque = await middleware(req("/api/v1/ops/installs/PI-000001/stage", { method: "PATCH", cookie, origin: "null" }));
  assert.equal(opaque.status, 403, "an opaque origin is not same-site");

  assert.ok(isNext(await middleware(req("/api/v1/ops/installs/PI-000001/stage", { method: "PATCH", cookie, origin: "https://cms.precifarm.com" }))));
  assert.ok(isNext(await middleware(req("/api/v1/ops/installs/PI-000001/stage", { method: "GET", cookie, origin: "https://evil.example" }))), "reads are not blocked");
  // The website posts surveys from precifarm.com without the CMS cookie: allowed.
  assert.ok(isNext(await middleware(req("/api/v1/installs/survey", { method: "POST", origin: "https://precifarm.com" }))));
});

test("security headers are set on every answer, HSTS only over HTTPS", async () => {
  env.SESSION_SECRET = SECRET;
  const res = await middleware(req("/login", { proto: "https" }));
  assert.equal(res.headers.get("x-content-type-options"), "nosniff");
  assert.equal(res.headers.get("x-frame-options"), "DENY");
  assert.equal(res.headers.get("referrer-policy"), "same-origin");
  assert.match(res.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
  assert.equal(res.headers.get("x-robots-tag"), "noindex, nofollow");
  assert.match(res.headers.get("strict-transport-security") ?? "", /max-age=31536000/);

  const plain = await middleware(new NextRequest("http://localhost:3002/login", { headers: { host: "localhost:3002" } }));
  assert.equal(plain.headers.get("strict-transport-security"), null);
  const redirect = await middleware(req("/dashboard", { proto: "https" }));
  assert.equal(redirect.headers.get("x-content-type-options"), "nosniff");
});

test("edge session check: signature, expiry and shape", async () => {
  const now = Date.now();
  const token = signSessionToken("agent-1", SECRET, 3600, now);
  assert.equal(await signedSessionValid(token, SECRET, now), true);
  assert.equal(await signedSessionValid(token, SECRET, now + 3601_000), false, "expired");
  assert.equal(await signedSessionValid(token, "another-secret-0123456789abcdef0123456789", now), false);
  const [p, s] = token.split(".");
  assert.equal(await signedSessionValid(`${p}.${s[0] === "A" ? "B" : "A"}${s.slice(1)}`, SECRET, now), false);
  const forgedPayload = Buffer.from(JSON.stringify({ sub: "admin", exp: 9_999_999_999 })).toString("base64url");
  assert.equal(await signedSessionValid(`${forgedPayload}.${s}`, SECRET, now), false);
  for (const bad of [undefined, "", "abc", "a.b.c", ".x", "x.", "x".repeat(1025)]) {
    assert.equal(await signedSessionValid(bad, SECRET, now), false, String(bad).slice(0, 12));
  }
  // A correctly signed token without a numeric expiry is refused.
  const { createHmac } = await import("node:crypto");
  const noExp = Buffer.from(JSON.stringify({ sub: "agent-1" })).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(noExp).digest("base64url");
  assert.equal(await signedSessionValid(`${noExp}.${sig}`, SECRET, now), false);
});
