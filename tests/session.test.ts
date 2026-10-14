import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sessionCookieOptions,
  signSessionToken,
  verifySessionToken,
} from "../src/lib/security/session";

const SECRET = "test-secret-0123456789abcdef0123456789abcdef";

test("signed session cookie round-trips", () => {
  const token = signSessionToken("agent-123", SECRET);
  const payload = verifySessionToken(token, SECRET);
  assert.ok(payload);
  assert.equal(payload.sub, "agent-123");
  assert.ok(payload.exp > Date.now() / 1000);
  assert.notEqual(token, "agent-123");
});

test("tampered payload is rejected", () => {
  const token = signSessionToken("agent-123", SECRET);
  const [, sig] = token.split(".");
  const forged = Buffer.from(JSON.stringify({ sub: "admin-999", exp: 9_999_999_999 })).toString(
    "base64url"
  );
  assert.equal(verifySessionToken(`${forged}.${sig}`, SECRET), null);
});

test("tampered signature is rejected", () => {
  const token = signSessionToken("agent-123", SECRET);
  const [payload, sig] = token.split(".");
  const flipped = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
  assert.equal(verifySessionToken(`${payload}.${flipped}`, SECRET), null);
});

test("wrong secret, raw ids, garbage and expired tokens are rejected", () => {
  const token = signSessionToken("agent-123", SECRET);
  assert.equal(verifySessionToken(token, "another-secret-0123456789abcdef0123456789"), null);
  assert.equal(verifySessionToken("agent-123", SECRET), null);
  assert.equal(verifySessionToken("", SECRET), null);
  assert.equal(verifySessionToken(undefined, SECRET), null);
  const expired = signSessionToken("agent-123", SECRET, 60, Date.now() - 120_000);
  assert.equal(verifySessionToken(expired, SECRET), null);
});

test("cookie options are httpOnly and sameSite lax", () => {
  const opts = sessionCookieOptions();
  assert.equal(opts.httpOnly, true);
  assert.equal(opts.sameSite, "lax");
  assert.equal(opts.path, "/");
});
