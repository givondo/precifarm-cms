// Live STK push request building in src/lib/mpesa.ts with fetch stubbed: the Daraja password and
// timestamp, the authenticated callback URL, and every failure path. No request leaves the process.
import { test, before, after, mock } from "node:test";
import assert from "node:assert/strict";

const SHORTCODE = "174379";
const PASSKEY = "test-passkey-bfb279f9aa9bdbcf158e97dd71a467cd";
const CALLBACK = "https://api.precifarm.com/api/v1/payments/mpesa/callback";
const TOKEN = "cb-token-test-0123456789abcdef";

let initiateStkPush: typeof import("../src/lib/mpesa").initiateStkPush;
const booking = { id: "b1", reference: "PF-LIVE01", total: 1550, phone: "254708374149", from: "Nairobi", to: "Kisumu" };

before(async () => {
  Object.assign(process.env, {
    DEMO_PAYMENT: "false",
    MPESA_CONSUMER_KEY: "consumer-key",
    MPESA_CONSUMER_SECRET: "consumer-secret",
    MPESA_PASSKEY: PASSKEY,
    MPESA_SHORTCODE: SHORTCODE,
    MPESA_CALLBACK_URL: CALLBACK,
    MPESA_ENVIRONMENT: "sandbox",
    MPESA_CALLBACK_TOKEN: TOKEN,
  });
  ({ initiateStkPush } = await import("../src/lib/mpesa"));
});

after(() => {
  mock.restoreAll();
});

type Call = { url: string; init?: RequestInit };

function stubFetch(responses: Array<{ status?: number; body: unknown }>) {
  const calls: Call[] = [];
  let i = 0;
  mock.method(globalThis, "fetch", async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    const r = responses[i++] ?? { status: 500, body: {} };
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: { "content-type": "application/json" } });
  });
  return calls;
}

test("a live STK push authenticates, then sends the Daraja password, timestamp and tokenised callback", async () => {
  const calls = stubFetch([{ body: { access_token: "access-123" } }, { body: { CheckoutRequestID: "ws_CO_123", ResponseDescription: "Success" } }]);
  const result = await initiateStkPush(booking);
  mock.restoreAll();

  assert.deepEqual(result, {
    mode: "live",
    status: "pending",
    reference: "PF-LIVE01",
    checkoutRequestId: "ws_CO_123",
    message: "STK push sent. Enter your M-Pesa PIN on 2547…",
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials");
  const basic = (calls[0].init?.headers as Record<string, string>).Authorization;
  assert.equal(basic, `Basic ${Buffer.from("consumer-key:consumer-secret").toString("base64")}`);

  assert.equal(calls[1].url, "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest");
  assert.equal((calls[1].init?.headers as Record<string, string>).Authorization, "Bearer access-123");
  const body = JSON.parse(String(calls[1].init?.body));
  assert.match(body.Timestamp, /^\d{14}$/);
  assert.equal(Buffer.from(body.Password, "base64").toString(), `${SHORTCODE}${PASSKEY}${body.Timestamp}`);
  assert.equal(body.BusinessShortCode, SHORTCODE);
  assert.equal(body.PartyB, SHORTCODE);
  assert.equal(body.PartyA, "254708374149");
  assert.equal(body.PhoneNumber, "254708374149");
  assert.equal(body.Amount, 1550);
  assert.equal(body.AccountReference, "PF-LIVE01");
  assert.equal(body.TransactionType, "CustomerPayBillOnline");
  const cb = new URL(body.CallBackURL);
  assert.equal(`${cb.origin}${cb.pathname}`, CALLBACK);
  assert.equal(cb.searchParams.get("token"), TOKEN);
});

test("an M-Pesa authentication failure is reported without trying the STK push", async () => {
  const calls = stubFetch([{ status: 401, body: { errorMessage: "Invalid credentials" } }]);
  const result = await initiateStkPush(booking);
  mock.restoreAll();
  assert.equal(result.status, "failed");
  assert.equal(result.message, "Could not authenticate with M-Pesa.");
  assert.equal(calls.length, 1);
});

test("a missing access token is reported", async () => {
  stubFetch([{ body: {} }]);
  const result = await initiateStkPush(booking);
  mock.restoreAll();
  assert.equal(result.status, "failed");
  assert.equal(result.message, "M-Pesa access token missing.");
});

test("a refused STK push is reported as failed", async () => {
  stubFetch([{ body: { access_token: "a" } }, { status: 400, body: { errorMessage: "Bad Request - Invalid PhoneNumber" } }]);
  const result = await initiateStkPush(booking);
  mock.restoreAll();
  assert.equal(result.status, "failed");
  assert.equal(result.reference, "PF-LIVE01");
});

test("in production a missing callback token stops the push before any request", async () => {
  const saved = { token: process.env.MPESA_CALLBACK_TOKEN, env: process.env.MPESA_ENVIRONMENT };
  delete process.env.MPESA_CALLBACK_TOKEN;
  process.env.MPESA_ENVIRONMENT = "production";
  try {
    const calls = stubFetch([]);
    const result = await initiateStkPush(booking);
    mock.restoreAll();
    assert.equal(result.status, "failed");
    assert.equal(result.message, "M-Pesa callback token is not configured.");
    assert.equal(calls.length, 0);
  } finally {
    process.env.MPESA_CALLBACK_TOKEN = saved.token;
    process.env.MPESA_ENVIRONMENT = saved.env;
  }
});
