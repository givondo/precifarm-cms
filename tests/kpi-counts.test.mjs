// node --experimental-strip-types --test tests/kpi-counts.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeKpiCounts, DEMO_INSTALL_REFERENCES } from "../src/lib/kpi-counts.ts";
import { seedEvOpsDemo } from "../src/lib/ev-ops.ts";

const AS_OF = "2026-10-20T12:00:00.000Z";
const ago = (d) => new Date(Date.parse(AS_OF) - d * 86400000).toISOString();
const order = (n, stage, created, extra = {}) => ({ id: "o" + n, reference: "PI-" + String(n).padStart(6, "0"), stage, createdAt: created, ...extra });
const ev = (n, to, prior, at) => ({ entityType: "install_order", entityId: "o" + n, action: "stage_" + to, payload: JSON.stringify({ priorStage: prior }), createdAt: at });

test("demo references match the seeded demo orders", () => {
  const seeded = seedEvOpsDemo(AS_OF).installOrders.map((o) => o.reference);
  assert.deepEqual([...DEMO_INSTALL_REFERENCES].sort(), seeded.sort());
});

test("seeded demo orders never count", () => {
  const demo = seedEvOpsDemo(ago(1)).installOrders;
  const c = computeKpiCounts({ installOrders: demo, auditEvents: [] }, AS_OF);
  assert.equal(c.excluded_demo_orders, 4);
  assert.deepEqual(c.counts, { survey_requests_30d: 0, quotes_issued_30d: 0, survey_to_quote_pct: null, survey_cohort_size: 0, commissioned_with_deposit: 0, lipa_requests_30d: 0 });
});

test("windows, quotes and conversion", () => {
  const orders = [
    order(45, "survey_requested", ago(2), { lipaPolePole: true }),
    order(46, "quoted", ago(10)),
    order(47, "deposit_paid", ago(20)),
    order(48, "commissioned", ago(60), { depositAmount: 25000 }),
    order(49, "survey_scheduled", ago(40)),
    order(50, "survey_requested", ago(120)),
  ];
  const auditEvents = [
    ev(46, "quoted", "survey_scheduled", ago(5)),
    ev(47, "deposit_paid", "survey_requested", ago(15)), // jumped past quoted: a quote was issued
    ev(48, "quoted", "survey_scheduled", ago(45)), // outside the 30-day window
    ev(48, "commissioned", "install_scheduled", ago(31)),
    { entityType: "booking", entityId: "o46", action: "stage_quoted", createdAt: ago(1) },
  ];
  const c = computeKpiCounts({ installOrders: orders, auditEvents }, AS_OF);
  assert.equal(c.counts.survey_requests_30d, 3);
  assert.equal(c.counts.quotes_issued_30d, 2);
  assert.equal(c.counts.survey_cohort_size, 5); // 90-day cohort excludes the 120-day order
  assert.equal(c.counts.survey_to_quote_pct, 60); // 46, 47, 48 of five
  assert.equal(c.counts.commissioned_with_deposit, 1);
  assert.equal(c.counts.lipa_requests_30d, 1);
  assert.equal(c.schema, "precifarm.kpi-counts/v1");
});

test("output carries no customer fields", () => {
  const c = computeKpiCounts({ installOrders: [order(45, "quoted", ago(1), { contactName: "X Y", contactPhone: "+254700000000", contactEmail: "a@b.c", notes: "n" })], auditEvents: [] }, AS_OF);
  const text = JSON.stringify(c);
  for (const s of ["X Y", "+2547", "a@b.c", "PI-000045"]) assert.ok(!text.includes(s), s);
});

test("bad date is refused", () => {
  assert.throws(() => computeKpiCounts({}, "not a date"));
});
