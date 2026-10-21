import fs from "fs";
import path from "path";
import crypto from "crypto";
import { nairobiKisumuRoute } from "@/lib/route";
import { CARGO_CAPACITY_KG } from "@/lib/cargo";
import { hashPassword, isPasswordHash, resolveSeedPassword } from "@/lib/security/password";
import { isDatabaseConfigured } from "@/lib/database-url";
import {
  seedEvOpsDemo,
  type StoreChargingSession,
  type StoreInstallOrder,
} from "@/lib/ev-ops";

const isProduction = () => process.env.NODE_ENV === "production";

/** Demo installs, charging sessions and riders: never in production unless CMS_DEMO_DATA=true. */
export function demoDataEnabled(): boolean {
  const v = process.env.CMS_DEMO_DATA?.trim().toLowerCase();
  return isProduction() ? v === "true" : v !== "false";
}

/**
 * Where the JSON store lives. CMS_DATA_DIR in production (a Cloud Storage volume on Cloud Run).
 * Production with neither a database nor CMS_DATA_DIR refuses to run rather than write to a disk
 * that disappears with the container.
 */
export function dataDir(): string {
  const configured = process.env.CMS_DATA_DIR?.trim();
  if (configured) return configured;
  // Netlify/Vercel/Lambda have a read-only app dir; /tmp is writable per invocation.
  if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL) {
    return path.join("/tmp", "precifarm-cms-data");
  }
  if (isProduction() && !isDatabaseConfigured()) {
    throw new Error("No storage configured: set CMS_DATA_DIR to a persistent volume or configure a database.");
  }
  return path.join(process.cwd(), "data");
}
const storePath = () => path.join(dataDir(), "store.json");

/** SHA-256 of the demo password that shipped in earlier versions and was published in the docs. */
const PUBLISHED_DEMO_PASSWORD_SHA256 = "65a8082d70345a06b8f6dd279f725e8ee9b1ed83270212588b1a09ad83a02b56";

export type StoreRoute = {
  id: string;
  label: string;
  origin: string;
  destination: string;
  distanceKm: number;
  durationMinutes: number;
  vehicleModel: string;
  farePerSeat: number;
  status: string;
};

export type StoreTrip = {
  id: string;
  routeId: string;
  travelDate: string;
  departureTime: string;
  vehicleModel: string;
  seatCapacity: number;
  cargoCapacityKg: number;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type StoreCargoDetails = {
  id: string;
  bookingId: string;
  weightKg: number;
  description: string;
  senderName: string;
  senderPhone: string;
  senderIdNumber: string;
  receiverName: string;
  receiverPhone: string;
  receiverIdNumber: string;
  isFragile: boolean;
  lastMileDelivery: boolean;
  deliveryAddress?: string;
  deliveryStatus?: string;
  deliveryStatusUpdatedAt?: string;
  riderId?: string;
  riderAssignedAt?: string;
};

export type StoreRider = {
  id: string;
  name: string;
  phone: string;
  city: string;
  vehicle: string;
  status: string;
  isActive: boolean;
  createdAt: string;
};

export type StoreDeliveryMessage = {
  id: string;
  bookingId: string;
  reference: string;
  stage: string;
  recipient: "sender" | "receiver";
  phone: string;
  body: string;
  sentAt: string;
  agentId?: string;
};

export type StoreCustomer = {
  id: string;
  phoneE164: string;
  name?: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
};

export type StoreAgent = {
  id: string;
  email: string;
  /** scrypt hash (`scrypt$N$r$p$salt$hash`). Legacy rows may still hold plaintext. */
  password: string;
  /** Sessions issued before this time (ms) are refused: set on sign-out and password change. */
  sessionsNotBefore?: number;
  name: string;
  role: string;
  branch?: string;
  isActive: boolean;
  createdAt: string;
};

export type StoreCashSession = {
  id: string;
  agentId: string;
  openedAt: string;
  closedAt?: string;
  openingFloat: number;
  cashCollected: number;
  actualCash?: number;
  discrepancy?: number;
  status: string;
  notes?: string;
};

export type StoreBooking = {
  id: string;
  reference: string;
  tripId: string;
  customerId: string;
  agentId?: string;
  bookingType: string;
  channel: string;
  passengerCount?: number;
  seats: string;
  farePerUnit: number;
  totalAmount: number;
  status: string;
  contactName: string;
  contactPhone: string;
  contactIdNumber?: string;
  contactEmail?: string;
  notes?: string;
  paidAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type StorePayment = {
  id: string;
  bookingId: string;
  method: string;
  amount: number;
  status: string;
  idempotencyKey: string;
  mpesaCheckoutId?: string;
  mpesaReceipt?: string;
  mpesaPhone?: string;
  cashSessionId?: string;
  isDemo: boolean;
  failureReason?: string;
  completedAt?: string;
  createdAt: string;
};

export type StoreTicket = {
  id: string;
  bookingId: string;
  ticketCode: string;
  status: string;
  smsSentAt?: string;
  smsBody?: string;
  createdAt: string;
};

export type StoreAuditEvent = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  actorType: string;
  actorId?: string;
  payload?: string;
  createdAt: string;
};

export type DataStore = {
  routes: StoreRoute[];
  departures: { id: string; routeId: string; departureTime: string }[];
  trips: StoreTrip[];
  customers: StoreCustomer[];
  agents: StoreAgent[];
  cashSessions: StoreCashSession[];
  bookings: StoreBooking[];
  cargoDetails: StoreCargoDetails[];
  deliveryMessages: StoreDeliveryMessage[];
  riders: StoreRider[];
  payments: StorePayment[];
  tickets: StoreTicket[];
  auditEvents: StoreAuditEvent[];
  installOrders: StoreInstallOrder[];
  chargingSessions: StoreChargingSession[];
};

const emptyStore = (): DataStore => ({
  routes: [],
  departures: [],
  trips: [],
  customers: [],
  agents: [],
  cashSessions: [],
  bookings: [],
  cargoDetails: [],
  deliveryMessages: [],
  riders: [],
  payments: [],
  tickets: [],
  auditEvents: [],
  installOrders: [],
  chargingSessions: [],
});

function readStore(): DataStore {
  const dir = dataDir();
  const file = storePath();
  // Surfacing a write failure here is deliberate: the old fallback re-seeded on every request and
  // silently discarded data when the folder was not writable (as on Cloud Run).
  fs.mkdirSync(dir, { recursive: true });

  // Seed only when the file is genuinely absent. existsSync answers false on any error (permission,
  // a storage hiccup), which must never lead to writing a fresh store over real data.
  let missing = false;
  try {
    fs.statSync(file);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    missing = true;
  }
  if (missing) {
    const store = normalizeStore(seedStore()).store;
    writeStore(store);
    return store;
  }

  const raw = fs.readFileSync(file, "utf-8").trim();
  let parsed: DataStore | null = null;
  try {
    parsed = raw ? (JSON.parse(raw) as DataStore) : null;
  } catch {
    parsed = null;
  }
  if (!parsed) {
    // Never overwrite real data in production: stop and let someone restore the file.
    if (isProduction()) throw new Error(`The store at ${file} is empty or unreadable. Restore it from a backup version.`);
    if (raw) fs.copyFileSync(file, `${file}.corrupt-${Date.now()}.json`);
    const store = normalizeStore(seedStore()).store;
    writeStore(store);
    return store;
  }

  const normalized = normalizeStore(parsed);
  if (normalized.changed) {
    writeStore(normalized.store);
    return normalized.store;
  }
  return parsed;
}

/**
 * Accounts: in production retire any account still on the password published in earlier versions,
 * and create or update the admin from Secret Manager (CMS_ADMIN_EMAIL and CMS_ADMIN_PASSWORD_HASH).
 * A changed admin hash ends that admin's sessions.
 */
function normalizeAgents(store: DataStore, now = Date.now()): boolean {
  let changed = false;
  if (isProduction()) {
    for (const a of store.agents) {
      const published = !isPasswordHash(a.password) && crypto.createHash("sha256").update(String(a.password)).digest("hex") === PUBLISHED_DEMO_PASSWORD_SHA256;
      if (published && a.isActive) {
        a.isActive = false;
        a.password = "";
        a.sessionsNotBefore = now;
        changed = true;
      }
    }
  }
  const email = process.env.CMS_ADMIN_EMAIL?.trim().toLowerCase();
  const hash = process.env.CMS_ADMIN_PASSWORD_HASH?.trim();
  if (email && hash && isPasswordHash(hash)) {
    const admin = store.agents.find((a) => a.email.trim().toLowerCase() === email);
    if (!admin) {
      store.agents.push({
        id: crypto.randomUUID(),
        email,
        password: hash,
        name: process.env.CMS_ADMIN_NAME?.trim() || "Admin",
        role: "admin",
        branch: "Nairobi",
        isActive: true,
        createdAt: new Date(now).toISOString(),
      });
      changed = true;
    } else if (admin.password !== hash || admin.role !== "admin" || !admin.isActive) {
      if (admin.password !== hash) admin.sessionsNotBefore = now;
      admin.password = hash;
      admin.role = "admin";
      admin.isActive = true;
      changed = true;
    }
  }
  return changed;
}

export function normalizeStore(store: DataStore): { store: DataStore; changed: boolean } {
  let changed = normalizeAgents(store);

  if (!store.cargoDetails) {
    store.cargoDetails = [];
    changed = true;
  }
  if (!store.deliveryMessages) {
    store.deliveryMessages = [];
    changed = true;
  }
  if (!store.riders) {
    store.riders = demoDataEnabled() ? seedRiders(new Date().toISOString()) : [];
    changed = true;
  }
  if (!store.installOrders) {
    store.installOrders = [];
    changed = true;
  }
  if (!store.chargingSessions) {
    store.chargingSessions = [];
    changed = true;
  }

  if (demoDataEnabled() && store.installOrders.length === 0 && store.chargingSessions.length === 0) {
    const now = new Date().toISOString();
    const demo = seedEvOpsDemo(now);
    store.installOrders = demo.installOrders;
    store.chargingSessions = demo.chargingSessions;
    for (const customer of demo.customers) {
      if (!store.customers.some((c) => c.phoneE164 === customer.phoneE164)) {
        store.customers.push(customer);
        changed = true;
      }
    }
    changed = true;
  }

  for (const cargo of store.cargoDetails) {
    if (cargo.lastMileDelivery == null) {
      cargo.lastMileDelivery = false;
      changed = true;
    }
  }

  for (const booking of store.bookings ?? []) {
    if (booking.bookingType !== "cargo" || booking.status !== "paid") continue;
    const cargo = store.cargoDetails.find((c) => c.bookingId === booking.id);
    if (cargo && !cargo.deliveryStatus) {
      cargo.deliveryStatus = "confirmed";
      cargo.deliveryStatusUpdatedAt = booking.paidAt ?? booking.updatedAt;
      changed = true;
    }
  }

  for (const trip of store.trips ?? []) {
    if (trip.cargoCapacityKg == null) {
      trip.cargoCapacityKg = CARGO_CAPACITY_KG;
      changed = true;
    }
  }

  return { store, changed };
}

function writeStore(store: DataStore) {
  // A failed write throws, so the request that made the change reports the failure instead of
  // pretending to have saved it.
  const file = storePath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmpPath = `${file}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), "utf-8");
  fs.renameSync(tmpPath, file);
}

function seedRiders(now: string): StoreRider[] {
  return [
    {
      id: crypto.randomUUID(),
      name: "James Ochieng",
      phone: "+254712345001",
      city: "Nairobi",
      vehicle: "E-bike",
      status: "available",
      isActive: true,
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      name: "Mary Wanjiku",
      phone: "+254712345002",
      city: "Nairobi",
      vehicle: "E-bike",
      status: "available",
      isActive: true,
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      name: "Peter Kamau",
      phone: "+254712345003",
      city: "Nairobi",
      vehicle: "Electric van",
      status: "available",
      isActive: true,
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      name: "David Otieno",
      phone: "+254712345004",
      city: "Kisumu",
      vehicle: "E-bike",
      status: "available",
      isActive: true,
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      name: "Grace Akinyi",
      phone: "+254712345005",
      city: "Kisumu",
      vehicle: "E-bike",
      status: "available",
      isActive: true,
      createdAt: now,
    },
  ];
}

export function seedStore(): DataStore {
  const now = new Date().toISOString();
  const store = emptyStore();

  store.routes.push({
    id: "nairobi-kisumu",
    label: "Nairobi – Kisumu",
    origin: "Nairobi",
    destination: "Kisumu",
    distanceKm: 345,
    durationMinutes: 285,
    vehicleModel: "Yutong U18",
    farePerSeat: 1550,
    status: "current",
  });

  for (const time of nairobiKisumuRoute.departures) {
    store.departures.push({
      id: crypto.randomUUID(),
      routeId: "nairobi-kisumu",
      departureTime: time,
    });
  }

  // Local development only. Production starts with no accounts; the admin comes from Secret Manager
  // (CMS_ADMIN_EMAIL and CMS_ADMIN_PASSWORD_HASH, see normalizeAgents).
  if (!isProduction()) {
    store.agents.push({
      id: crypto.randomUUID(),
      email: "agent@precifarm.com",
      password: hashPassword(resolveSeedPassword("SEED_AGENT_PASSWORD", "agent@precifarm.com")),
      name: "Jane Agent",
      role: "agent",
      branch: "Nairobi",
      isActive: true,
      createdAt: now,
    });

    store.agents.push({
      id: crypto.randomUUID(),
      email: "admin@precifarm.com",
      password: hashPassword(resolveSeedPassword("SEED_ADMIN_PASSWORD", "admin@precifarm.com")),
      name: "System Admin",
      role: "admin",
      branch: "Nairobi",
      isActive: true,
      createdAt: now,
    });
  }

  if (demoDataEnabled()) {
    store.riders = seedRiders(now);
    const demo = seedEvOpsDemo(now);
    store.installOrders = demo.installOrders;
    store.chargingSessions = demo.chargingSessions;
    store.customers.push(...demo.customers);
  }

  return store;
}

// Short-lived cache: re-read when the file changed or after CACHE_MS, so a second instance during a
// rollout, a restore from a backup version, a sign-out or a deactivated agent is seen within seconds.
const CACHE_MS = 2000;
let cache: { store: DataStore; at: number; mtimeMs: number } | null = null;

function fileMtime(): number {
  try {
    return fs.statSync(storePath()).mtimeMs;
  } catch {
    return -1;
  }
}

export function getStore(): DataStore {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_MS) return cache.store;
  const mtime = fileMtime();
  if (cache && mtime === cache.mtimeMs) {
    cache.at = now;
    return cache.store;
  }
  const store = readStore();
  cache = { store, at: now, mtimeMs: fileMtime() };
  return store;
}

export function saveStore(store: DataStore) {
  writeStore(store);
  cache = { store, at: Date.now(), mtimeMs: fileMtime() };
}

export function mutateStore(fn: (store: DataStore) => void) {
  const store = readStore();
  fn(store);
  writeStore(store);
  cache = { store, at: Date.now(), mtimeMs: fileMtime() };
}

export function ensureSeeded() {
  getStore();
}
