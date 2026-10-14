import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  hashPassword,
  isPasswordHash,
  resolveSeedPassword,
  verifyPassword,
} from "../src/lib/security/password";

afterEach(() => {
  delete process.env.ALLOW_LEGACY_PLAINTEXT;
});

test("scrypt hash has the expected format and a random salt", () => {
  const a = hashPassword("correct horse battery staple");
  const b = hashPassword("correct horse battery staple");
  assert.match(a, /^scrypt\$16384\$8\$1\$[A-Za-z0-9+/=]+\$[A-Za-z0-9+/=]+$/);
  assert.ok(isPasswordHash(a));
  assert.notEqual(a, b);
});

test("verify accepts the right password and rejects the wrong one", () => {
  const stored = hashPassword("s3cret-Passw0rd!");
  assert.deepEqual(verifyPassword("s3cret-Passw0rd!", stored), { ok: true, needsUpgrade: false });
  assert.equal(verifyPassword("s3cret-Passw0rd?", stored).ok, false);
  assert.equal(verifyPassword("", stored).ok, false);
});

test("tampered or malformed hashes are rejected", () => {
  const stored = hashPassword("pw-123456789");
  const parts = stored.split("$");
  parts[1] = String(1 << 30);
  assert.equal(verifyPassword("pw-123456789", parts.join("$")).ok, false);
  assert.equal(verifyPassword("pw-123456789", "scrypt$broken").ok, false);
  assert.equal(verifyPassword("pw-123456789", undefined).ok, false);
});

test("legacy plaintext is rejected unless ALLOW_LEGACY_PLAINTEXT=true", () => {
  assert.deepEqual(verifyPassword("old-plain", "old-plain"), { ok: false, needsUpgrade: false });
  process.env.ALLOW_LEGACY_PLAINTEXT = "true";
  assert.deepEqual(verifyPassword("old-plain", "old-plain"), { ok: true, needsUpgrade: true });
  assert.deepEqual(verifyPassword("wrong", "old-plain"), { ok: false, needsUpgrade: false });
});

test("seed password comes from env, otherwise random and stable per process", () => {
  process.env.SEED_TEST_PASSWORD = "from-env-password";
  assert.equal(resolveSeedPassword("SEED_TEST_PASSWORD", "test"), "from-env-password");
  delete process.env.SEED_TEST_PASSWORD;
  const generated = resolveSeedPassword("SEED_TEST_PASSWORD_2", "test");
  assert.ok(generated.length >= 16);
  assert.equal(resolveSeedPassword("SEED_TEST_PASSWORD_2", "test"), generated);
});
