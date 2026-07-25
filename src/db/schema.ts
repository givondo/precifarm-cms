import {
  pgTable,
  varchar,
  integer,
  boolean,
  timestamp,
  text,
  uuid,
  date,
  time,
  decimal,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const routes = pgTable("routes", {
  id: varchar("id", { length: 64 }).primaryKey(),
  label: varchar("label", { length: 128 }).notNull(),
  origin: varchar("origin", { length: 64 }).notNull(),
  destination: varchar("destination", { length: 64 }).notNull(),
  distanceKm: integer("distance_km"),
  durationMinutes: integer("duration_minutes"),
  vehicleModel: varchar("vehicle_model", { length: 64 }).notNull(),
  farePerSeat: integer("fare_per_seat").notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const routeDepartures = pgTable(
  "route_departures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routeId: varchar("route_id", { length: 64 })
      .notNull()
      .references(() => routes.id),
    departureTime: time("departure_time").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("route_departure_unique").on(t.routeId, t.departureTime)]
);

export const trips = pgTable(
  "trips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    routeId: varchar("route_id", { length: 64 })
      .notNull()
      .references(() => routes.id),
    travelDate: date("travel_date").notNull(),
    departureTime: time("departure_time").notNull(),
    vehicleModel: varchar("vehicle_model", { length: 64 }).notNull(),
    seatCapacity: integer("seat_capacity").notNull().default(48),
    cargoCapacityKg: integer("cargo_capacity_kg").default(500),
    status: varchar("status", { length: 32 }).notNull().default("scheduled"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("trip_unique").on(t.routeId, t.travelDate, t.departureTime)]
);

export const customers = pgTable("customers", {
  id: uuid("id").primaryKey().defaultRandom(),
  phoneE164: varchar("phone_e164", { length: 16 }).notNull().unique(),
  name: varchar("name", { length: 128 }),
  email: varchar("email", { length: 256 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 256 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 256 }).notNull(),
  name: varchar("name", { length: 128 }).notNull(),
  role: varchar("role", { length: 32 }).notNull(),
  branch: varchar("branch", { length: 64 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cashSessions = pgTable("cash_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id),
  openedAt: timestamp("opened_at", { withTimezone: true }).notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  openingFloat: integer("opening_float").notNull(),
  cashCollected: integer("cash_collected").notNull().default(0),
  actualCash: integer("actual_cash"),
  discrepancy: integer("discrepancy"),
  status: varchar("status", { length: 32 }).notNull(),
  notes: text("notes"),
});

export const bookings = pgTable("bookings", {
  id: uuid("id").primaryKey().defaultRandom(),
  reference: varchar("reference", { length: 16 }).notNull().unique(),
  tripId: uuid("trip_id")
    .notNull()
    .references(() => trips.id),
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),
  agentId: uuid("agent_id").references(() => agents.id),
  bookingType: varchar("booking_type", { length: 16 }).notNull(),
  channel: varchar("channel", { length: 32 }).notNull(),
  passengerCount: integer("passenger_count"),
  seats: text("seats").notNull(),
  farePerUnit: integer("fare_per_unit").notNull(),
  totalAmount: integer("total_amount").notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  contactName: varchar("contact_name", { length: 128 }).notNull(),
  contactPhone: varchar("contact_phone", { length: 16 }).notNull(),
  contactEmail: varchar("contact_email", { length: 256 }),
  notes: text("notes"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cargoDetails = pgTable("cargo_details", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .unique()
    .references(() => bookings.id),
  weightKg: decimal("weight_kg", { precision: 8, scale: 2 }).notNull(),
  description: text("description").notNull(),
  senderName: varchar("sender_name", { length: 128 }).notNull(),
  senderPhone: varchar("sender_phone", { length: 16 }).notNull(),
  senderIdNumber: varchar("sender_id_number", { length: 32 }).notNull(),
  receiverName: varchar("receiver_name", { length: 128 }).notNull(),
  receiverPhone: varchar("receiver_phone", { length: 16 }).notNull(),
  receiverIdNumber: varchar("receiver_id_number", { length: 32 }).notNull(),
  isFragile: boolean("is_fragile").notNull().default(false),
  lastMileDelivery: boolean("last_mile_delivery").notNull().default(false),
  deliveryAddress: text("delivery_address"),
});

export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .references(() => bookings.id),
  method: varchar("method", { length: 16 }).notNull(),
  amount: integer("amount").notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 64 }).notNull().unique(),
  mpesaCheckoutId: varchar("mpesa_checkout_id", { length: 64 }),
  mpesaReceipt: varchar("mpesa_receipt", { length: 32 }),
  mpesaPhone: varchar("mpesa_phone", { length: 16 }),
  cashSessionId: uuid("cash_session_id").references(() => cashSessions.id),
  isDemo: boolean("is_demo").notNull().default(false),
  failureReason: text("failure_reason"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const tickets = pgTable("tickets", {
  id: uuid("id").primaryKey().defaultRandom(),
  bookingId: uuid("booking_id")
    .notNull()
    .unique()
    .references(() => bookings.id),
  ticketCode: varchar("ticket_code", { length: 16 }).notNull().unique(),
  qrPayload: text("qr_payload"),
  status: varchar("status", { length: 32 }).notNull(),
  smsSentAt: timestamp("sms_sent_at", { withTimezone: true }),
  smsBody: text("sms_body"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  entityType: varchar("entity_type", { length: 32 }).notNull(),
  entityId: varchar("entity_id", { length: 64 }).notNull(),
  action: varchar("action", { length: 64 }).notNull(),
  actorType: varchar("actor_type", { length: 16 }).notNull(),
  actorId: uuid("actor_id"),
  payload: text("payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
