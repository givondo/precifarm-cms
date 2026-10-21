// src/lib/env.ts reads its settings when first loaded, so each case runs in a fresh Node process.
// Also covers the demo data flag (src/db/store.ts) and the booking switch.
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { demoDataEnabled } from "../src/db/store";
import { isBookingEnabled } from "../src/lib/api/booking-gate";

const ROOT = path.resolve(import.meta.dirname, "..");
const LIVE = {
  DEMO_PAYMENT: "false",
  MPESA_CONSUMER_KEY: "key",
  MPESA_CONSUMER_SECRET: "secret-value",
  MPESA_PASSKEY: "passkey-value",
  MPESA_SHORTCODE: "174379",
  MPESA_CALLBACK_URL: "https://api.precifarm.com/api/v1/payments/mpesa/callback",
};
const CLEAR = Object.fromEntries(
  ["DEMO_PAYMENT", "MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_PASSKEY", "MPESA_SHORTCODE", "MPESA_CALLBACK_URL", "MPESA_ENVIRONMENT", "DATABASE_URL", "SUPABASE_DB_PASSWORD"].map((k) => [k, undefined]),
);

type EnvReport = { mode: string; demo: boolean; base: string; summary: Record<string, unknown> };

function loadEnv(vars: Record<string, string | undefined>): EnvReport {
  const env = {} as NodeJS.ProcessEnv;
  for (const [k, v] of Object.entries({ ...process.env, ...CLEAR, ...vars })) if (v !== undefined) env[k] = v;
  const script = `const m = await import("./src/lib/env.ts");
console.log(JSON.stringify({ mode: m.getPaymentMode(), demo: m.isDemoPayment(), base: m.mpesaApiBaseUrl(), summary: m.envSummary() }));`;
  const out = execFileSync(process.execPath, ["--import", "./tests/setup/register.mjs", "--input-type=module", "-e", script], { cwd: ROOT, env, encoding: "utf8" });
  return JSON.parse(out.trim().split("\n").pop()!);
}

test("payments are simulated unless DEMO_PAYMENT=false and every credential is present", () => {
  assert.equal(loadEnv({}).mode, "demo");
  assert.equal(loadEnv({ ...LIVE, DEMO_PAYMENT: undefined }).mode, "demo", "demo is the default");
  assert.equal(loadEnv({ ...LIVE, DEMO_PAYMENT: "true" }).mode, "demo");
  for (const missing of ["MPESA_CONSUMER_KEY", "MPESA_CONSUMER_SECRET", "MPESA_PASSKEY", "MPESA_SHORTCODE", "MPESA_CALLBACK_URL"]) {
    const r = loadEnv({ ...LIVE, [missing]: "  " });
    assert.equal(r.mode, "demo", `${missing} blank`);
    assert.equal(r.demo, true);
  }
});

test("live mode follows MPESA_ENVIRONMENT, defaulting to the sandbox", () => {
  const sandbox = loadEnv(LIVE);
  assert.equal(sandbox.mode, "live-sandbox");
  assert.equal(sandbox.demo, false);
  assert.equal(sandbox.base, "https://sandbox.safaricom.co.ke");

  const prod = loadEnv({ ...LIVE, MPESA_ENVIRONMENT: "production" });
  assert.equal(prod.mode, "live-production");
  assert.equal(prod.base, "https://api.safaricom.co.ke");
});

test("MPESA_ENVIRONMENT is read regardless of case and spacing, like the callback guard", () => {
  // The callback guard already treats " Production " as production; the API host and badge must agree.
  for (const value of ["Production", " PRODUCTION ", "production "]) {
    const r = loadEnv({ ...LIVE, MPESA_ENVIRONMENT: value });
    assert.equal(r.mode, "live-production", JSON.stringify(value));
    assert.equal(r.base, "https://api.safaricom.co.ke", JSON.stringify(value));
    assert.equal(r.summary.mpesaEnvironment, "production");
  }
  assert.equal(loadEnv({ ...LIVE, MPESA_ENVIRONMENT: "staging" }).base, "https://sandbox.safaricom.co.ke", "anything else is the sandbox");
});

test("the environment summary never contains a credential", () => {
  const r = loadEnv({ ...LIVE, MPESA_ENVIRONMENT: "production", DATABASE_URL: "postgresql://u:db-password-123@db.example.com/x" });
  const text = JSON.stringify(r.summary);
  for (const secret of ["secret-value", "passkey-value", "db-password-123", "/payments/mpesa/callback"]) {
    assert.ok(!text.includes(secret), secret);
  }
  assert.equal(r.summary.callbackHost, "api.precifarm.com");
  assert.equal(r.summary.hasPasskey, true);
  assert.equal(r.summary.storageBackend, "postgresql");
  assert.equal(loadEnv({ ...LIVE, MPESA_CALLBACK_URL: "not a url" }).summary.callbackHost, null);
});

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const env = process.env as Record<string, string | undefined>;
  const saved = Object.fromEntries(Object.keys(vars).map((k) => [k, env[k]]));
  for (const [k, v] of Object.entries(vars)) v === undefined ? delete env[k] : (env[k] = v);
  try {
    fn();
  } finally {
    for (const [k, v] of Object.entries(saved)) v === undefined ? delete env[k] : (env[k] = v);
  }
}

test("demo data: on by default in development, off in production unless CMS_DEMO_DATA=true", () => {
  withEnv({ NODE_ENV: "development", CMS_DEMO_DATA: undefined }, () => assert.equal(demoDataEnabled(), true));
  withEnv({ NODE_ENV: "development", CMS_DEMO_DATA: " FALSE " }, () => assert.equal(demoDataEnabled(), false));
  withEnv({ NODE_ENV: "production", CMS_DEMO_DATA: undefined }, () => assert.equal(demoDataEnabled(), false));
  withEnv({ NODE_ENV: "production", CMS_DEMO_DATA: "yes" }, () => assert.equal(demoDataEnabled(), false));
  withEnv({ NODE_ENV: "production", CMS_DEMO_DATA: "True" }, () => assert.equal(demoDataEnabled(), true));
});

test("booking stays retired unless BOOKING_ENABLED is exactly true", () => {
  for (const [value, expected] of [[undefined, false], ["", false], ["1", false], ["yes", false], ["false", false], ["true", true], [" TRUE ", true]] as const) {
    withEnv({ BOOKING_ENABLED: value }, () => assert.equal(isBookingEnabled(), expected, String(value)));
  }
});
