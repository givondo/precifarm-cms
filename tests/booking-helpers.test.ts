// Formatting and phone helpers in src/lib/booking.ts, and the pure M-Pesa helpers in src/lib/mpesa.ts
// in demo mode (no credentials in this process, so nothing can reach Safaricom).
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import {
  calculateFare,
  formatCurrency,
  formatPhoneDisplay,
  formatTicketSms,
  generateBookingReference,
  getLocalDateString,
  isOnLocalDate,
  normalizeKenyanPhone,
  validateBookingInput,
  validateIdNumber,
} from "../src/lib/booking";
import { initiateStkPush, parseMpesaCallback } from "../src/lib/mpesa";

test("Kenyan mobile numbers normalise to 2547/2541 form from every common spelling", () => {
  const cases: [string, string][] = [
    ["0712345678", "254712345678"],
    ["0712 345 678", "254712345678"],
    ["0712-345-678", "254712345678"],
    ["+254712345678", "254712345678"],
    ["+254 712 345 678", "254712345678"],
    ["254712345678", "254712345678"],
    ["0110345678", "254110345678"],
    ["+254 110 345 678", "254110345678"],
    ["(0712) 345678", "254712345678"],
  ];
  for (const [input, expected] of cases) assert.equal(normalizeKenyanPhone(input), expected, input);
});

test("numbers that are not Kenyan mobiles are refused", () => {
  for (const input of ["", "0712", "071234567", "07123456789", "0212345678", "0812345678", "+255712345678", "2540712345678", "+44 20 7946 0958", "abcdefghij", "712345678"]) {
    assert.equal(normalizeKenyanPhone(input), null, input);
  }
});

test("phone display uses the local 07xx xxx xxx form and leaves unknown input alone", () => {
  assert.equal(formatPhoneDisplay("254712345678"), "0712 345 678");
  assert.equal(formatPhoneDisplay("+254110345678"), "0110 345 678");
  assert.equal(formatPhoneDisplay("not a phone"), "not a phone");
});

test("currency is shown as KSh with Kenyan grouping", () => {
  assert.equal(formatCurrency(0), "KSh 0");
  assert.equal(formatCurrency(1550), "KSh 1,550");
  assert.equal(formatCurrency(320000), "KSh 320,000");
  assert.equal(formatCurrency(1234567), "KSh 1,234,567");
});

test("local date string and same-day check agree whatever the time zone", () => {
  const d = new Date(2026, 0, 5, 1, 30); // 01:30 local time on 5 January
  assert.equal(getLocalDateString(d), "2026-01-05");
  assert.equal(isOnLocalDate(d.toISOString(), "2026-01-05"), true, "the UTC string may carry another date");
  assert.equal(isOnLocalDate(d.toISOString(), "2026-01-04"), false);
  assert.equal(isOnLocalDate(undefined, "2026-01-05"), false);
  assert.equal(isOnLocalDate("garbage", "2026-01-05"), false);
});

test("ID numbers: 6 to 20 letters or digits", () => {
  assert.equal(validateIdNumber("12345678"), true);
  assert.equal(validateIdNumber(" A1234567 "), true);
  assert.equal(validateIdNumber("12345"), false);
  assert.equal(validateIdNumber("1".repeat(21)), false);
  assert.equal(validateIdNumber("1234-5678"), false);
});

test("fares, references and ticket SMS", () => {
  assert.equal(calculateFare(3), 4650);
  assert.equal(calculateFare(2), 3100);
  for (let i = 0; i < 50; i++) assert.match(generateBookingReference(), /^PF-[A-HJ-NP-Z2-9]{6}$/);
  const sms = formatTicketSms({ reference: "PF-ABC234", from: "Nairobi", to: "Kisumu", date: "2030-01-15", time: "08:00", seats: ["1A", "1B"], total: 3100 });
  assert.match(sms, /PF-ABC234/);
  assert.match(sms, /Seats: 1A, 1B/);
  assert.match(sms, /KSh 3,100/);
});

test("booking validation refuses a bad phone, past date and seat mismatches", () => {
  const ok = {
    routeId: "nairobi-kisumu",
    date: "2099-01-01",
    time: "08:00",
    passengers: 1,
    seats: ["1A"],
    name: "Jane Doe",
    phone: "0712345678",
    idNumber: "12345678",
  };
  assert.equal(validateBookingInput(ok), null);
  assert.match(validateBookingInput({ ...ok, phone: "12345" }) ?? "", /phone/i);
  assert.match(validateBookingInput({ ...ok, date: "2000-01-01" }) ?? "", /past/);
  assert.match(validateBookingInput({ ...ok, passengers: 2 }) ?? "", /exactly 2 seats/);
  assert.match(validateBookingInput({ ...ok, passengers: 2, seats: ["1A", "1A"] }) ?? "", /only be selected once/);
  assert.match(validateBookingInput({ ...ok, seats: ["99Z"] }) ?? "", /Invalid seat/);
  assert.match(validateBookingInput({ ...ok, time: "03:00" }) ?? "", /departure time/);
  assert.match(validateBookingInput({ ...ok, email: "nope" }) ?? "", /email/);
  assert.match(validateBookingInput({ ...ok, routeId: "mombasa" }) ?? "", /Route/);
});

test("M-Pesa callback parsing: success with metadata, failure without, junk refused", () => {
  const success = parseMpesaCallback({
    Body: {
      stkCallback: {
        CheckoutRequestID: "ws_CO_1",
        ResultCode: 0,
        ResultDesc: "ok",
        CallbackMetadata: {
          Item: [
            { Name: "Amount", Value: "1550.00" },
            { Name: "MpesaReceiptNumber", Value: "NLJ7RT61SV" },
            { Name: "PhoneNumber", Value: 254708374149 },
          ],
        },
      },
    },
  });
  assert.deepEqual(success, {
    checkoutRequestId: "ws_CO_1",
    success: true,
    resultDesc: "ok",
    mpesaReceipt: "NLJ7RT61SV",
    amount: 1550,
    phone: "254708374149",
  });

  const cancelled = parseMpesaCallback({ Body: { stkCallback: { CheckoutRequestID: "ws_CO_2", ResultCode: 1032, CallbackMetadata: { Item: [{ Name: "Amount", Value: 1 }] } } } });
  assert.equal(cancelled?.success, false);
  assert.equal(cancelled?.amount, undefined, "metadata on a failed callback is ignored");
  assert.equal(cancelled?.resultDesc, "Unknown");

  assert.equal(parseMpesaCallback({}), null);
  assert.equal(parseMpesaCallback({ Body: { stkCallback: {} } }), null);
});

test("demo mode: STK push succeeds without any network call", async (t) => {
  const fetchSpy = mock.method(globalThis, "fetch", async () => {
    throw new Error("no network in demo mode");
  });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const pending = initiateStkPush({ id: "b1", reference: "PF-DEMO01", total: 1550, phone: "254712345678", from: "Nairobi", to: "Kisumu" });
  t.mock.timers.tick(2500);
  const result = await pending;
  assert.equal(result.status, "success");
  assert.ok(result.status === "success" && result.demo);
  if (result.status === "success") assert.match(result.mpesaReceipt, /^DEMO\d{8}$/);
  assert.equal(fetchSpy.mock.callCount(), 0);
  fetchSpy.mock.restore();
});
