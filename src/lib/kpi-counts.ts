/**
 * Aggregate KPI counts from the install pipeline, for the Precifarm KPI register
 * (givondo/kenya-ebus-ecosystem ops/kpis.yaml). Counts only: no names, phones,
 * emails, notes or references leave this function.
 *
 * Demo orders seeded by seedEvOpsDemo() are excluded, so seeded rows never read as
 * traction. Dependency free so it can be tested with plain Node.
 */

export const KPI_COUNTS_SCHEMA = "precifarm.kpi-counts/v1";

/** References and phones created by seedEvOpsDemo() in src/lib/ev-ops.ts. Keep in step with it (a test checks).
 * An order is demo only when both match, so a real order that happens to get one of these references counts. */
export const DEMO_INSTALL_REFERENCES = new Set(["PI-000041", "PI-000042", "PI-000043", "PI-000044"]);
export const DEMO_CONTACT_PHONES = new Set(["+254712000101", "+254733000202", "+254722000303", "+254701000404"]);
const isDemo = (o: Order) => DEMO_INSTALL_REFERENCES.has(o.reference) && DEMO_CONTACT_PHONES.has(o.contactPhone ?? "");

const STAGES = ["survey_requested", "survey_scheduled", "quoted", "deposit_paid", "install_scheduled", "commissioned"] as const;
const QUOTED = STAGES.indexOf("quoted");
const PRE_QUOTE = new Set(["survey_requested", "survey_scheduled"]);

type Order = {
  id: string;
  reference: string;
  stage: string;
  contactPhone?: string;
  lipaPolePole?: boolean;
  depositAmount?: number;
  createdAt: string;
};
type AuditEvent = { entityType: string; entityId: string; action: string; payload?: string; createdAt: string };
export type KpiCountsInput = { installOrders?: Order[]; auditEvents?: AuditEvent[] };

export type KpiCounts = {
  schema: typeof KPI_COUNTS_SCHEMA;
  as_of: string;
  window_days: number;
  cohort_days: number;
  cohort_lag_days: number;
  counts: {
    survey_requests_30d: number;
    quotes_issued_30d: number;
    survey_to_quote_pct: number | null;
    survey_cohort_size: number;
    commissioned_with_deposit: number;
    lipa_requests_30d: number;
  };
  excluded_demo_orders: number;
};

const DAY = 86_400_000;

function within(iso: string | undefined, from: number, to: number): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return !Number.isNaN(t) && t > from && t <= to;
}

function priorStage(payload: string | undefined): string | null {
  if (!payload) return null;
  try {
    const p = JSON.parse(payload) as { priorStage?: unknown };
    return typeof p.priorStage === "string" ? p.priorStage : null;
  } catch {
    return null;
  }
}

/**
 * @param asOf end of the window (inclusive), ISO timestamp
 * Survey to quote uses a cohort by creation date, from 90 days ago up to 7 days ago so new requests have had
 * time to be quoted: orders that ever reached "quoted" or a later stage (now, or at any time in the audit
 * trail), over orders created in the cohort. A quote counts as issued when an order moves into "quoted", or
 * jumps from a survey stage straight to a later one.
 */
export function computeKpiCounts(store: KpiCountsInput, asOf: string, windowDays = 30, cohortDays = 90, cohortLagDays = 7): KpiCounts {
  const end = Date.parse(asOf);
  if (Number.isNaN(end)) throw new Error("asOf must be an ISO date");
  const all = store.installOrders ?? [];
  const real = all.filter((o) => !isDemo(o));
  const realIds = new Set(real.map((o) => o.id));
  const winStart = end - windowDays * DAY;
  const cohortStart = end - cohortDays * DAY;

  const quotedIds = new Set<string>();
  const everQuoted = new Set<string>();
  for (const e of store.auditEvents ?? []) {
    if (e.entityType !== "install_order" || !realIds.has(e.entityId)) continue;
    const to = e.action.startsWith("stage_") ? e.action.slice(6) : null;
    if (!to) continue;
    const toIdx = STAGES.indexOf(to as (typeof STAGES)[number]);
    if (toIdx < QUOTED) continue;
    if (Date.parse(e.createdAt) <= end) everQuoted.add(e.entityId);
    if (within(e.createdAt, winStart, end) && (to === "quoted" || PRE_QUOTE.has(priorStage(e.payload) ?? ""))) quotedIds.add(e.entityId);
  }

  const cohort = real.filter((o) => within(o.createdAt, cohortStart, end - cohortLagDays * DAY));
  const reached = cohort.filter((o) => everQuoted.has(o.id) || STAGES.indexOf(o.stage as (typeof STAGES)[number]) >= QUOTED).length;

  return {
    schema: KPI_COUNTS_SCHEMA,
    as_of: new Date(end).toISOString(),
    window_days: windowDays,
    cohort_days: cohortDays,
    cohort_lag_days: cohortLagDays,
    counts: {
      survey_requests_30d: real.filter((o) => within(o.createdAt, winStart, end)).length,
      quotes_issued_30d: quotedIds.size,
      survey_to_quote_pct: cohort.length ? Math.round((100 * reached) / cohort.length) : null,
      survey_cohort_size: cohort.length,
      commissioned_with_deposit: real.filter((o) => o.stage === "commissioned" && (o.depositAmount ?? 0) > 0).length,
      lipa_requests_30d: real.filter((o) => o.lipaPolePole && within(o.createdAt, winStart, end)).length,
    },
    excluded_demo_orders: all.length - real.length,
  };
}
