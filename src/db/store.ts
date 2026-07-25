import fs from "fs";
import path from "path";
import crypto from "crypto";
import { nairobiKisumuRoute } from "@/lib/route";
import { CARGO_CAPACITY_KG } from "@/lib/cargo";

const DATA_DIR = serverlessDataDir();
const STORE_PATH = path.join(DATA_DIR, "store.json");

function serverlessDataDir(): string {
  // Netlify/Vercel/Lambda have a read-only app dir; /tmp is writable per invocation.
  if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL) {
    return path.join("/tmp", "precifarm-cms-data");
  }
  return path.join(process.cwd(), "data");
}

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
  password: string;
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
});

function readStore(): DataStore {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch {
    return seedStore();
  }

  if (!fs.existsSync(STORE_PATH)) {
    const store = seedStore();
    writeStore(store);
    return store;
  }

  const raw = fs.readFileSync(STORE_PATH, "utf-8").trim();
  if (!raw) {
    const store = seedStore();
    writeStore(store);
    return store;
  }

  let parsed: DataStore;
  try {
    parsed = JSON.parse(raw) as DataStore;
  } catch {
    const backup = `${STORE_PATH}.corrupt-${Date.now()}.json`;
    fs.copyFileSync(STORE_PATH, backup);
    const store = seedStore();
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

export function normalizeStore(store: DataStore): { store: DataStore; changed: boolean } {
  let changed = false;

  if (!store.cargoDetails) {
    store.cargoDetails = [];
    changed = true;
  }
  if (!store.deliveryMessages) {
    store.deliveryMessages = [];
    changed = true;
  }
  if (!store.riders) {
    store.riders = seedRiders(new Date().toISOString());
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
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmpPath = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(store, null, 2), "utf-8");
    fs.renameSync(tmpPath, STORE_PATH);
  } catch {
    // Read-only or ephemeral FS (e.g. Netlify serverless) — in-memory cache still works.
  }
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

  store.agents.push({
    id: crypto.randomUUID(),
    email: "agent@precifarm.com",
    password: "precifarm2026",
    name: "Jane Agent",
    role: "agent",
    branch: "Nairobi",
    isActive: true,
    createdAt: now,
  });

  store.agents.push({
    id: crypto.randomUUID(),
    email: "admin@precifarm.com",
    password: "precifarm2026",
    name: "System Admin",
    role: "admin",
    branch: "Nairobi",
    isActive: true,
    createdAt: now,
  });

  store.riders = seedRiders(now);

  return store;
}

let cache: DataStore | null = null;

export function getStore(): DataStore {
  if (!cache) cache = readStore();
  return cache;
}

export function saveStore(store: DataStore) {
  cache = store;
  writeStore(store);
}

export function mutateStore(fn: (store: DataStore) => void) {
  const store = readStore();
  fn(store);
  cache = store;
  writeStore(store);
}

export function ensureSeeded() {
  getStore();
}
