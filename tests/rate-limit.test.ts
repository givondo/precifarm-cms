import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { getClientIp } from "../src/lib/api/rate-limit";

const originalNetlify = process.env.NETLIFY;

afterEach(() => {
  if (originalNetlify === undefined) delete process.env.NETLIFY;
  else process.env.NETLIFY = originalNetlify;
});

function req(headers: Record<string, string>) {
  return new Request("http://localhost/", { headers });
}

test("client-supplied x-nf-client-connection-ip is ignored off Netlify", () => {
  delete process.env.NETLIFY;
  const ip = getClientIp(req({ "x-nf-client-connection-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9, 203.0.113.7" }));
  assert.equal(ip, "203.0.113.7");
});

test("x-nf-client-connection-ip is used when running on Netlify", () => {
  process.env.NETLIFY = "true";
  assert.equal(getClientIp(req({ "x-nf-client-connection-ip": "1.2.3.4" })), "1.2.3.4");
});

test("right-most X-Forwarded-For entry is used, not the spoofable left-most", () => {
  delete process.env.NETLIFY;
  assert.equal(getClientIp(req({ "x-forwarded-for": "6.6.6.6, 203.0.113.7" })), "203.0.113.7");
});

test("rateLimited only reads the count; only recorded attempts use the allowance", async () => {
  const { checkRateLimit, rateLimited } = await import("../src/lib/api/rate-limit");
  const key = "login:203.0.113.77";
  for (let i = 0; i < 20; i++) assert.equal(rateLimited(key, 3), false, "checking alone never blocks");
  checkRateLimit(key, 3, 60_000);
  checkRateLimit(key, 3, 60_000);
  assert.equal(rateLimited(key, 3), false);
  checkRateLimit(key, 3, 60_000);
  assert.equal(rateLimited(key, 3), true);
});
