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
