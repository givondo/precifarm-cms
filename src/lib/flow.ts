/**
 * Workflow strips for the desk: each stage is a station with a count and one dot per record, so the
 * shape of the work reads before any words. Pure functions, shared by the dashboard, installs and
 * charging sessions pages, and tested in tests/flow.test.ts.
 */
import {
  chargingSiteLabels,
  installStageLabels,
  type ChargingSiteType,
  type InstallProduct,
  type InstallStage,
  type StoreChargingSession,
  type StoreInstallOrder,
} from "./ev-ops";

export type Tone = "you" | "agent" | "landed" | "muted" | "warn";

export interface Station {
  key: string;
  label: string;
  value: string;
  sub?: string;
  tone: Tone;
  dots: Tone[];
  href?: string;
  active?: boolean;
}

/** The install stages in order, with the short label a station shows. */
export const INSTALL_STAGES = Object.keys(installStageLabels) as InstallStage[];
export const STAGE_SHORT: Record<InstallStage, string> = {
  survey_requested: "Requested",
  survey_scheduled: "Survey booked",
  quoted: "Quoted",
  deposit_paid: "Deposit paid",
  install_scheduled: "Install booked",
  commissioned: "Commissioned",
};

/** One colour per product, so a station's dots show the mix. */
export const PRODUCT_TONE: Record<InstallProduct, Tone> = { pulse: "you", pod: "landed", spark: "agent" };
export const PRODUCT_KEY: Array<[Tone, string]> = [
  ["you", "Pulse"],
  ["landed", "Pod"],
  ["agent", "Spark"],
];
export const SITE_TONE: Record<ChargingSiteType, Tone> = { corridor: "landed", depot: "you", boda_hub: "agent", home: "muted" };
export const SITE_KEY: Array<[Tone, string]> = (Object.keys(SITE_TONE) as ChargingSiteType[]).map((s) => [SITE_TONE[s], chargingSiteLabels[s]]);

export function stageIndex(stage: InstallStage): number {
  return INSTALL_STAGES.indexOf(stage);
}

/** Install pipeline: one station per stage; a station links to the table filtered to it. */
export function installFlow(orders: StoreInstallOrder[], active?: InstallStage): Station[] {
  return INSTALL_STAGES.map((stage, i) => {
    const at = orders.filter((o) => o.stage === stage);
    const lipa = at.filter((o) => o.lipaPolePole).length;
    return {
      key: stage,
      label: STAGE_SHORT[stage],
      value: String(at.length),
      sub: lipa ? `${lipa} Lipa` : undefined,
      tone: stage === "commissioned" ? "landed" : i < 3 ? "agent" : "you",
      dots: at.map((o) => PRODUCT_TONE[o.product] ?? "muted"),
      href: active === stage ? "/installs" : `/installs?stage=${stage}`,
      active: active === stage,
    };
  });
}

const kwh = (xs: StoreChargingSession[]) => Math.round(xs.reduce((t, s) => t + (s.kwhDelivered ?? 0), 0) * 10) / 10;
const kes = (n: number) => "KSh " + Math.round(n).toLocaleString("en-GB");

/** Public charging: plugged in, charging, completed, paid. Failed sessions stay on the first station in red. */
export function chargingFlow(sessions: StoreChargingSession[]): Station[] {
  const live = sessions.filter((s) => s.status === "pending" || s.status === "active");
  const done = sessions.filter((s) => s.status === "completed");
  const paid = done.filter((s) => s.amountKes > 0);
  const failed = sessions.filter((s) => s.status === "failed");
  const site = (s: StoreChargingSession): Tone => SITE_TONE[s.siteType] ?? "muted";
  return [
    { key: "started", label: "Plugged in", value: String(sessions.length), sub: failed.length ? `${failed.length} failed` : undefined, tone: "agent", dots: sessions.map((s) => (s.status === "failed" ? "warn" : site(s))), href: "/charging-sessions" },
    { key: "charging", label: "Charging now", value: String(live.length), tone: "you", dots: live.map(site), href: "/charging-sessions" },
    { key: "completed", label: "Completed", value: String(done.length), sub: `${kwh(done)} kWh`, tone: "you", dots: done.map(site), href: "/charging-sessions" },
    { key: "paid", label: "Paid", value: kes(paid.reduce((t, s) => t + s.amountKes, 0)), sub: `${paid.length} by M-Pesa`, tone: "landed", dots: paid.map(site), href: "/reconciliation" },
  ];
}
