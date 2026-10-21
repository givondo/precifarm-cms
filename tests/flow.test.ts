import { test } from "node:test";
import assert from "node:assert/strict";
import { chargingFlow, installFlow, INSTALL_STAGES, stageIndex } from "../src/lib/flow";

const order = (ref: string, stage: string, product: string, lipa = false): any => ({ id: ref, reference: ref, stage, product, lipaPolePole: lipa });
const orders = [order("A", "survey_requested", "pulse"), order("B", "survey_requested", "spark", true), order("C", "deposit_paid", "pod", true), order("D", "commissioned", "pulse")];

test("install flow: one station per stage, in order, with a dot per order coloured by product", () => {
  const st = installFlow(orders);
  assert.deepEqual(st.map((s) => s.key), INSTALL_STAGES);
  assert.equal(st[0].value, "2");
  assert.deepEqual(st[0].dots, ["you", "agent"]);
  assert.equal(st[0].sub, "1 Lipa");
  assert.equal(st[3].dots[0], "landed");
  assert.equal(st.reduce((t, s) => t + s.dots.length, 0), orders.length);
});

test("install flow: the active stage links back to all orders", () => {
  const st = installFlow(orders, "deposit_paid");
  const a = st.find((s) => s.key === "deposit_paid")!;
  assert.ok(a.active);
  assert.equal(a.href, "/installs");
  assert.equal(st[0].href, "/installs?stage=survey_requested");
});

test("charging flow: failed sessions stay on the first station in red; paid sums completed amounts", () => {
  const s = (status: string, siteType: string, amountKes: number, kwhDelivered?: number): any => ({ status, siteType, amountKes, kwhDelivered });
  const st = chargingFlow([s("completed", "corridor", 1658, 42.5), s("completed", "depot", 1092, 28), s("active", "boda_hub", 0), s("failed", "depot", 0)]);
  assert.deepEqual(st.map((x) => x.key), ["started", "charging", "completed", "paid"]);
  assert.equal(st[0].value, "4");
  assert.ok(st[0].dots.includes("warn"));
  assert.equal(st[1].value, "1");
  assert.equal(st[2].sub, "70.5 kWh");
  assert.equal(st[3].value, "KSh 2,750");
});

test("stage index follows the pipeline order", () => {
  assert.equal(stageIndex("survey_requested"), 0);
  assert.equal(stageIndex("commissioned"), 5);
});
