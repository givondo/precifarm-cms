// Lead parsing for the home charging survey and the shared contact validation used by both public
// intake routes (/api/v1/installs/survey and /api/v1/contact).
import { test } from "node:test";
import assert from "node:assert/strict";
import { inferCityFromLead, inferProductFromLead, wantsLipaPolePole } from "../src/lib/ev-survey";
import { validateContactInput } from "../src/lib/contact";

// Exactly what precifarm.com sends (components/HomeSurveyForm.tsx and ContactForm.tsx).
const HOME_INTEREST = "Home charger installation (Pulse charger or Pod energy storage)";
const surveyMessage = (product: string, city = "Nairobi", extra: string[] = []) =>
  [`City: ${city}`, `Product interest: ${product}`, ...extra].join("\n");

test("product comes from the survey's product line", () => {
  assert.equal(inferProductFromLead(HOME_INTEREST, surveyMessage("Pulse charger, home charging")), "pulse");
  assert.equal(inferProductFromLead(HOME_INTEREST, surveyMessage("Pod energy storage, home charging plus backup")), "pod");
  assert.equal(inferProductFromLead(HOME_INTEREST, surveyMessage("Spark portable charger")), "spark");
  assert.equal(inferProductFromLead(HOME_INTEREST, surveyMessage("Not sure yet")), "pulse", "undecided defaults to Pulse");
});

test("a contact form home charger enquiry is not forced to Pod by the interest label", () => {
  // The interest label names both Pulse and Pod, so it must not decide the product.
  assert.equal(inferProductFromLead(HOME_INTEREST, "Hello, I would like a Pulse charger at my house in Karen."), "pulse");
  assert.equal(inferProductFromLead(HOME_INTEREST, "Please call me about charging at home, thanks."), "pulse");
  assert.equal(inferProductFromLead(HOME_INTEREST, "Interested in the Pod with backup for outages."), "pod");
  assert.equal(inferProductFromLead(HOME_INTEREST, "Could the Spark work for my flat?"), "spark");
});

test("general enquiries are not turned into install orders by words that merely contain a product name", () => {
  for (const [interest, message] of [
    ["General enquiry", "We run a podcast on clean energy and would love an interview."],
    ["General enquiry", "Your launch sparked a lot of interest in our office."],
    ["Fleet or depot charging", "We bought on impulse and now need depot charging for ten vans."],
    ["Host a charging hub site", "Our tripod-mounted cameras need power at the site."],
  ]) {
    assert.equal(inferProductFromLead(interest, message), null, message);
  }
});

test("general enquiries that do name a product, or home charging, are still picked up", () => {
  assert.equal(inferProductFromLead("General enquiry", "Do you install the Pulse in Nakuru?"), "pulse");
  assert.equal(inferProductFromLead("General enquiry", "Need home charging for my Leaf."), "pulse");
  assert.equal(inferProductFromLead("General enquiry", "What does a POD cost?"), "pod");
});

test("city comes from the City line, covering every service area on the website", () => {
  assert.deepEqual(inferCityFromLead(surveyMessage("Pulse", "Kisumu")), { city: "Kisumu", county: "Kisumu County" });
  assert.deepEqual(inferCityFromLead(surveyMessage("Pulse", "Mombasa")), { city: "Mombasa", county: "Mombasa County" });
  assert.deepEqual(inferCityFromLead(surveyMessage("Pulse", "Eldoret")), { city: "Eldoret", county: "Uasin Gishu County" });
  assert.deepEqual(inferCityFromLead(surveyMessage("Pulse", "Nakuru")), { city: "Nakuru", county: "Nakuru County" });
  // Kitui is offered on precifarm.com (lib/contact.ts hubs) and must not be filed as Nairobi.
  assert.deepEqual(inferCityFromLead(surveyMessage("Pulse", "Kitui")), { city: "Kitui", county: "Kitui County" });
});

test("a stated city that is not on the list is kept rather than filed as Nairobi", () => {
  assert.equal(inferCityFromLead(surveyMessage("Pulse", "Machakos")).city, "Machakos");
  assert.ok(inferCityFromLead(`City: ${"x".repeat(500)}`).city.length <= 64, "stored city is bounded");
});

test("city falls back to Nairobi when the lead gives none, and is read from free text otherwise", () => {
  assert.deepEqual(inferCityFromLead("Please call me."), { city: "Nairobi", county: "Nairobi County" });
  assert.equal(inferCityFromLead("I live in mombasa near Nyali.").city, "Mombasa");
});

test("Lipa Pole Pole is recognised in its usual spellings", () => {
  assert.equal(wantsLipaPolePole("Lipa Pole Pole: yes"), true);
  assert.equal(wantsLipaPolePole("Can I pay in instalments?"), true);
  assert.equal(wantsLipaPolePole("Installment plan please"), true);
  assert.equal(wantsLipaPolePole("Cash on completion."), false);
});

const valid = {
  name: "Faith Wanjiru",
  email: " Faith@Example.co.ke ",
  phone: "0712 345 678",
  interest: HOME_INTEREST,
  message: surveyMessage("Pulse charger, home charging"),
  channel: "web-private-house",
  anonymousId: "6f1c1f4e-8d0a-4b8e-9a51-1d2c3b4a5f60",
};

test("contact validation accepts the website payload and normalises it", () => {
  const r = validateContactInput(valid);
  assert.ok(r.ok);
  assert.equal(r.input.email, "faith@example.co.ke");
  assert.equal(r.input.name, "Faith Wanjiru");
  assert.equal(r.input.phone, "0712 345 678");
  assert.equal(r.input.channel, "web-private-house");
  assert.equal(r.input.anonymousId, valid.anonymousId);
});

test("contact validation refuses missing, malformed and oversized fields", () => {
  const cases: [string, unknown][] = [
    ["no body", null],
    ["array body", []],
    ["string body", "hello"],
    ["missing name", { ...valid, name: undefined }],
    ["one letter name", { ...valid, name: "A" }],
    ["oversized name", { ...valid, name: "N".repeat(129) }],
    ["missing email", { ...valid, email: undefined }],
    ["malformed email", { ...valid, email: "faith@example" }],
    ["email with spaces", { ...valid, email: "fa ith@example.com" }],
    ["oversized email", { ...valid, email: `${"a".repeat(250)}@example.com` }],
    ["oversized phone", { ...valid, phone: "0".repeat(33) }],
    ["missing interest", { ...valid, interest: "" }],
    ["oversized interest", { ...valid, interest: "I".repeat(129) }],
    ["short message", { ...valid, message: "Hi" }],
    ["oversized message", { ...valid, message: "m".repeat(5001) }],
    ["non string message", { ...valid, message: 12345678901 }],
    ["oversized channel", { ...valid, channel: "c".repeat(33) }],
    ["channel with markup", { ...valid, channel: "<script>" }],
  ];
  for (const [label, body] of cases) {
    const r = validateContactInput(body);
    assert.equal(r.ok, false, label);
  }
});

test("contact validation drops an anonymous id that is not a UUID instead of storing it", () => {
  // contact_submissions.anonymous_id is a uuid column: a tampered cookie used to make the insert fail.
  for (const anonymousId of ["not-a-uuid", "x".repeat(10_000), "'; drop table x; --"]) {
    const r = validateContactInput({ ...valid, anonymousId });
    assert.ok(r.ok, anonymousId.slice(0, 20));
    assert.equal(r.input.anonymousId, undefined);
  }
});

test("contact validation treats a blank phone as absent and defaults the channel to web", () => {
  const r = validateContactInput({ ...valid, phone: "   ", channel: undefined });
  assert.ok(r.ok);
  assert.equal(r.input.phone, undefined);
  assert.equal(r.input.channel, "web");
});
