/** EV charging ops — install pipeline, public sessions, Lipa Pole Pole */

import crypto from "crypto";

export type InstallProduct = "pulse" | "pod" | "spark";
export type InstallStage =
  | "survey_requested"
  | "survey_scheduled"
  | "quoted"
  | "deposit_paid"
  | "install_scheduled"
  | "commissioned";

export type ChargingSiteType = "home" | "depot" | "corridor" | "boda_hub";

export const installProductLabels: Record<InstallProduct, string> = {
  pulse: "Pulse (7 kW home)",
  pod: "Pod (storage + solar)",
  spark: "Spark (portable)",
};

export const installStageLabels: Record<InstallStage, string> = {
  survey_requested: "Survey requested",
  survey_scheduled: "Survey scheduled",
  quoted: "Quote sent",
  deposit_paid: "Deposit paid",
  install_scheduled: "Install scheduled",
  commissioned: "Commissioned",
};

export const installStageBadgeClass: Record<InstallStage, string> = {
  survey_requested: "bg-amber-50 text-amber-800 border-amber-200",
  survey_scheduled: "bg-sky-50 text-sky-800 border-sky-200",
  quoted: "bg-violet-50 text-violet-800 border-violet-200",
  deposit_paid: "bg-emerald-50 text-emerald-800 border-emerald-200",
  install_scheduled: "bg-indigo-50 text-indigo-800 border-indigo-200",
  commissioned: "bg-green-50 text-green-800 border-green-200",
};

export const chargingSiteLabels: Record<ChargingSiteType, string> = {
  home: "Home",
  depot: "Depot",
  corridor: "Corridor DC",
  boda_hub: "Boda Hub",
};

export type StoreInstallOrder = {
  id: string;
  reference: string;
  customerId: string;
  product: InstallProduct;
  city: string;
  county: string;
  stage: InstallStage;
  quoteAmount?: number;
  depositAmount?: number;
  lipaPolePole: boolean;
  channel: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  notes?: string;
  agentId?: string;
  scheduledAt?: string;
  commissionedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export function summarizeInstallPipeline(orders: StoreInstallOrder[]) {
  const stages = Object.keys(installStageLabels) as InstallStage[];
  const byStage = Object.fromEntries(
    stages.map((stage) => [stage, orders.filter((o) => o.stage === stage).length]),
  ) as Record<InstallStage, number>;

  return {
    total: orders.length,
    byStage,
    pipeline: orders.filter((o) =>
      ["survey_requested", "survey_scheduled", "quoted"].includes(o.stage),
    ).length,
    lipaPolePole: orders.filter((o) => o.lipaPolePole).length,
  };
}

export type StoreChargingSession = {
  id: string;
  reference: string;
  siteType: ChargingSiteType;
  siteName: string;
  city: string;
  kwhDelivered?: number;
  amountKes: number;
  paymentMethod: string;
  status: "pending" | "active" | "completed" | "failed";
  contactPhone?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
};

export function formatInstallReference(n: number): string {
  return `PI-${String(n).padStart(6, "0")}`;
}

export function formatSessionReference(n: number): string {
  return `CS-${String(n).padStart(6, "0")}`;
}

/** Demo EV pipeline data for agent desk (replaces bus-first dashboard KPIs). */
export function seedEvOpsDemo(now: string): {
  installOrders: StoreInstallOrder[];
  chargingSessions: StoreChargingSession[];
  customers: { id: string; phoneE164: string; name?: string; createdAt: string; updatedAt: string }[];
} {
  const c1 = crypto.randomUUID();
  const c2 = crypto.randomUUID();
  const c3 = crypto.randomUUID();
  const c4 = crypto.randomUUID();

  const customers = [
    { id: c1, phoneE164: "+254712000101", name: "Samuel Kariuki", createdAt: now, updatedAt: now },
    { id: c2, phoneE164: "+254733000202", name: "Amina Hassan", createdAt: now, updatedAt: now },
    { id: c3, phoneE164: "+254722000303", name: "Brian Omondi", createdAt: now, updatedAt: now },
    { id: c4, phoneE164: "+254701000404", name: "Faith Wanjiru", createdAt: now, updatedAt: now },
  ];

  const installOrders: StoreInstallOrder[] = [
    {
      id: crypto.randomUUID(),
      reference: "PI-000041",
      customerId: c1,
      product: "pulse",
      city: "Nairobi",
      county: "Nairobi County",
      stage: "commissioned",
      quoteAmount: 89000,
      depositAmount: 25000,
      lipaPolePole: true,
      channel: "website",
      contactName: "Samuel Kariuki",
      contactPhone: "+254712000101",
      commissionedAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      reference: "PI-000042",
      customerId: c2,
      product: "pod",
      city: "Nairobi",
      county: "Nairobi County",
      stage: "deposit_paid",
      quoteAmount: 320000,
      depositAmount: 50000,
      lipaPolePole: true,
      channel: "agent_desk",
      contactName: "Amina Hassan",
      contactPhone: "+254733000202",
      scheduledAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      reference: "PI-000043",
      customerId: c3,
      product: "pulse",
      city: "Kisumu",
      county: "Kisumu County",
      stage: "survey_scheduled",
      lipaPolePole: false,
      channel: "android_app",
      contactName: "Brian Omondi",
      contactPhone: "+254722000303",
      scheduledAt: now,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: crypto.randomUUID(),
      reference: "PI-000044",
      customerId: c4,
      product: "spark",
      city: "Nakuru",
      county: "Nakuru County",
      stage: "survey_requested",
      lipaPolePole: false,
      channel: "website",
      contactName: "Faith Wanjiru",
      contactPhone: "+254701000404",
      createdAt: now,
      updatedAt: now,
    },
  ];

  const chargingSessions: StoreChargingSession[] = [
    {
      id: crypto.randomUUID(),
      reference: "CS-000891",
      siteType: "corridor",
      siteName: "Naivasha Corridor DC",
      city: "Naivasha",
      kwhDelivered: 42.5,
      amountKes: 1658,
      paymentMethod: "mpesa",
      status: "completed",
      contactPhone: "+254712000101",
      startedAt: now,
      completedAt: now,
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      reference: "CS-000892",
      siteType: "depot",
      siteName: "Westlands Depot",
      city: "Nairobi",
      kwhDelivered: 28.0,
      amountKes: 1092,
      paymentMethod: "mpesa",
      status: "completed",
      contactPhone: "+254733000202",
      startedAt: now,
      completedAt: now,
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      reference: "CS-000893",
      siteType: "boda_hub",
      siteName: "Kisumu Boda Hub",
      city: "Kisumu",
      amountKes: 350,
      paymentMethod: "mpesa",
      status: "completed",
      contactPhone: "+254722000303",
      startedAt: now,
      completedAt: now,
      createdAt: now,
    },
  ];

  return { installOrders, chargingSessions, customers };
}
