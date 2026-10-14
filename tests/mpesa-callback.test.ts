import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

const TOKEN = "cb-token-test-0123456789abcdef";
const PHONE = "254708374149";
const AMOUNT = 1550;

type Db = typeof import("../src/db");
type Services = typeof import("../src/lib/services");
type CallbackRoute = typeof import("../src/app/api/v1/payments/mpesa/callback/route");

let db: Db;
let services: Services;
let route: CallbackRoute;
let workDir: string;
const originalCwd = process.cwd();

before(async () => {
  workDir = mkdtempSync(path.join(tmpdir(), "precifarm-cb-"));
  process.chdir(workDir);
  delete process.env.DATABASE_URL;
  delete process.env.SUPABASE_DB_PASSWORD;
  process.env.MPESA_CALLBACK_TOKEN = TOKEN;
  process.env.SEED_ADMIN_PASSWORD = "test-admin-password";
  process.env.SEED_AGENT_PASSWORD = "test-agent-password";
  db = await import("../src/db");
  services = await import("../src/lib/services");
  route = await import("../src/app/api/v1/payments/mpesa/callback/route");
});

after(() => {
  process.chdir(originalCwd);
  rmSync(workDir, { recursive: true, force: true });
});

async function createPendingPayment() {
  const trip = await services.getOrCreateTrip("nairobi-kisumu", "2030-01-15", "08:00");
  const bookingId = randomUUID();
  const paymentId = randomUUID();
  const checkoutId = `ws_CO_${randomUUID()}`;
  const now = new Date().toISOString();
  await db.mutateStore((s) => {
    s.bookings.push({
      id: bookingId,
      reference: `PF-T${Math.floor(Math.random() * 1e6)}`,
      tripId: trip.id,
      customerId: randomUUID(),
      bookingType: "passenger",
      channel: "web",
      passengerCount: 1,
      seats: JSON.stringify(["1A"]),
      farePerUnit: AMOUNT,
      totalAmount: AMOUNT,
      status: "pending",
      contactName: "Test Customer",
      contactPhone: PHONE,
      createdAt: now,
      updatedAt: now,
    } as never);
    s.payments.push({
      id: paymentId,
      bookingId,
      method: "mpesa",
      amount: AMOUNT,
      status: "pending",
      idempotencyKey: randomUUID(),
      mpesaCheckoutId: checkoutId,
      mpesaPhone: PHONE,
      isDemo: false,
      createdAt: now,
    });
  });
  return { bookingId, paymentId, checkoutId };
}

function callbackBody(checkoutId: string, opts: { amount?: number; phone?: number; receipt?: string } = {}) {
  return {
    Body: {
      stkCallback: {
        MerchantRequestID: "29115-34620561-1",
        CheckoutRequestID: checkoutId,
        ResultCode: 0,
        ResultDesc: "The service request is processed successfully.",
        CallbackMetadata: {
          Item: [
            { Name: "Amount", Value: opts.amount ?? AMOUNT },
            { Name: "MpesaReceiptNumber", Value: opts.receipt ?? `R${randomUUID().slice(0, 9).toUpperCase()}` },
            { Name: "TransactionDate", Value: 20261013102115 },
            { Name: "PhoneNumber", Value: opts.phone ?? Number(PHONE) },
          ],
        },
      },
    },
  };
}

function post(body: unknown, token?: string) {
  const url = new URL("http://localhost/api/v1/payments/mpesa/callback");
  if (token !== undefined) url.searchParams.set("token", token);
  return route.POST(
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

async function state(bookingId: string, paymentId: string) {
  const store = await db.getStore();
  return {
    booking: store.bookings.find((b) => b.id === bookingId)!,
    payment: store.payments.find((p) => p.id === paymentId)!,
    store,
  };
}

test("callback without token is rejected and nothing is marked paid", async () => {
  const { bookingId, paymentId, checkoutId } = await createPendingPayment();
  const res = await post(callbackBody(checkoutId));
  assert.equal(res.status, 401);
  const s = await state(bookingId, paymentId);
  assert.equal(s.booking.status, "pending");
  assert.equal(s.payment.status, "pending");
});

test("callback with wrong token is rejected", async () => {
  const { bookingId, paymentId, checkoutId } = await createPendingPayment();
  const res = await post(callbackBody(checkoutId), "not-the-token");
  assert.equal(res.status, 401);
  assert.equal((await state(bookingId, paymentId)).booking.status, "pending");
});

test("callback from an IP outside MPESA_CALLBACK_ALLOWED_IPS is rejected", async () => {
  const { bookingId, paymentId, checkoutId } = await createPendingPayment();
  process.env.MPESA_CALLBACK_ALLOWED_IPS = "196.201.214.200";
  try {
    const url = new URL("http://localhost/api/v1/payments/mpesa/callback");
    url.searchParams.set("token", TOKEN);
    const res = await route.POST(
      new Request(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "196.201.214.200, 10.0.0.9" },
        body: JSON.stringify(callbackBody(checkoutId)),
      })
    );
    assert.equal(res.status, 403);
    assert.equal((await state(bookingId, paymentId)).booking.status, "pending");
  } finally {
    delete process.env.MPESA_CALLBACK_ALLOWED_IPS;
  }
});

test("amount mismatch is flagged and the booking stays unpaid", async () => {
  const { bookingId, paymentId, checkoutId } = await createPendingPayment();
  const res = await post(callbackBody(checkoutId, { amount: 1 }), TOKEN);
  assert.equal(res.status, 200);
  const s = await state(bookingId, paymentId);
  assert.equal(s.booking.status, "pending");
  assert.equal(s.payment.status, "flagged");
  assert.match(s.payment.failureReason ?? "", /amount_mismatch/);
});

test("phone mismatch is flagged", async () => {
  const { bookingId, paymentId, checkoutId } = await createPendingPayment();
  await post(callbackBody(checkoutId, { phone: 254711111111 }), TOKEN);
  const s = await state(bookingId, paymentId);
  assert.equal(s.booking.status, "pending");
  assert.equal(s.payment.status, "flagged");
  assert.match(s.payment.failureReason ?? "", /phone_mismatch/);
});

test("valid callback marks the booking paid, redacts phone in audit, and replay is a no-op", async () => {
  const { bookingId, paymentId, checkoutId } = await createPendingPayment();
  const body = callbackBody(checkoutId, { receipt: "TESTRCPT01" });

  const first = await post(body, TOKEN);
  assert.equal(first.status, 200);
  assert.equal((await first.json()).ResultCode, 0);
  let s = await state(bookingId, paymentId);
  assert.equal(s.booking.status, "paid");
  assert.equal(s.payment.status, "completed");
  assert.equal(s.payment.mpesaReceipt, "TESTRCPT01");
  const ticketsAfterFirst = s.store.tickets.filter((t) => t.bookingId === bookingId).length;
  assert.equal(ticketsAfterFirst, 1);

  const audit = s.store.auditEvents.filter(
    (e) => e.entityId === paymentId && e.action === "mpesa_callback"
  );
  assert.ok(audit.length >= 1);
  for (const event of audit) {
    assert.ok(!event.payload?.includes(PHONE), "audit payload must not contain the full phone number");
    assert.ok(event.payload?.includes("*********149"));
  }

  const replay = await post(body, TOKEN);
  assert.equal(replay.status, 200);
  assert.equal((await replay.json()).ResultCode, 0);
  s = await state(bookingId, paymentId);
  assert.equal(s.booking.status, "paid");
  assert.equal(s.store.tickets.filter((t) => t.bookingId === bookingId).length, 1);
  assert.equal(
    s.store.payments.filter((p) => p.bookingId === bookingId && p.status === "completed").length,
    1
  );
});

function smsLogEntriesFor(bookingId: string): number {
  const file = path.join(process.cwd(), "data", "sms.log");
  if (!existsSync(file)) return 0;
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .filter((line) => JSON.parse(line).bookingId === bookingId).length;
}

test("two concurrent valid callbacks complete the payment exactly once", async () => {
  const { bookingId, paymentId, checkoutId } = await createPendingPayment();
  const body = callbackBody(checkoutId, { receipt: "RACERCPT01" });

  const [a, b] = await Promise.all([post(body, TOKEN), post(body, TOKEN)]);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);

  const s = await state(bookingId, paymentId);
  assert.equal(s.booking.status, "paid");
  assert.equal(s.payment.status, "completed");
  assert.equal(s.store.tickets.filter((t) => t.bookingId === bookingId).length, 1, "one ticket");
  assert.equal(
    s.store.auditEvents.filter((e) => e.entityId === paymentId && e.action === "completed").length,
    1,
    "one completion audit entry"
  );
  assert.equal(smsLogEntriesFor(bookingId), 1, "one SMS");
});
