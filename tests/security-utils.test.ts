import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCallbackUrl, tokensMatch } from "../src/lib/security/mpesa-callback";
import { redactPhones } from "../src/lib/security/redact";

test("STK CallBackURL carries the callback token", () => {
  const url = buildCallbackUrl("https://api.example.com/api/v1/payments/mpesa/callback", "abc123");
  assert.equal(new URL(url).searchParams.get("token"), "abc123");
  assert.equal(tokensMatch("abc123", "abc123"), true);
  assert.equal(tokensMatch("abc124", "abc123"), false);
  assert.equal(tokensMatch(null, "abc123"), false);
});

test("phone numbers are redacted to the last 3 digits", () => {
  const out = redactPhones({
    a: 254708374149,
    b: "0712345678",
    c: "+254 712 345 678",
    receipt: "NLJ7RT61SV",
    checkout: "ws_CO_191220191020363925",
    amount: 1550,
    date: 20191219102115,
    nested: [{ Name: "PhoneNumber", Value: 254708374149 }],
  });
  assert.equal(out.a, "*********149");
  assert.equal(out.b, "*******678");
  assert.equal(out.c, "*********678");
  assert.equal(out.receipt, "NLJ7RT61SV");
  assert.equal(out.checkout, "ws_CO_191220191020363925");
  assert.equal(out.amount, 1550);
  assert.equal(out.date, 20191219102115);
  assert.equal(out.nested[0].Value, "*********149");
});
