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
  jsonb,
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

/** Single-row JSON document store — used when DATABASE_URL points at Supabase/PostgreSQL. */
export const appStore = pgTable("app_store", {
  id: varchar("id", { length: 32 }).primaryKey(),
  data: jsonb("data").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Behavioural analytics events (website, mobile, server). */
export const analyticsEvents = pgTable("analytics_events", {
  eventId: uuid("event_id").primaryKey(),
  eventName: varchar("event_name", { length: 64 }).notNull(),
  schemaVersion: integer("schema_version").notNull().default(1),
  eventTimestamp: timestamp("event_timestamp", { withTimezone: true }).notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  anonymousId: uuid("anonymous_id"),
  customerId: uuid("customer_id"),
  sessionId: uuid("session_id"),
  platform: varchar("platform", { length: 16 }).notNull(),
  environment: varchar("environment", { length: 16 }).notNull(),
  appVersion: varchar("app_version", { length: 32 }),
  deviceId: varchar("device_id", { length: 64 }),
  pageUrl: text("page_url"),
  screenName: varchar("screen_name", { length: 128 }),
  feature: varchar("feature", { length: 64 }),
  objectType: varchar("object_type", { length: 64 }),
  objectId: varchar("object_id", { length: 64 }),
  requestId: uuid("request_id"),
  bookingId: uuid("booking_id"),
  bookingReference: varchar("booking_reference", { length: 32 }),
  eventProperties: jsonb("event_properties").notNull().default({}),
  metadata: jsonb("metadata"),
});

export const analyticsIdentity = pgTable("analytics_identity", {
  anonymousId: uuid("anonymous_id").primaryKey(),
  customerId: uuid("customer_id"),
  mergedAt: timestamp("merged_at", { withTimezone: true }),
  platform: varchar("platform", { length: 16 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const analyticsAcquisition = pgTable("analytics_acquisition", {
  anonymousId: uuid("anonymous_id").primaryKey(),
  firstTouchSource: varchar("first_touch_source", { length: 128 }),
  firstTouchMedium: varchar("first_touch_medium", { length: 128 }),
  firstTouchCampaign: varchar("first_touch_campaign", { length: 128 }),
  firstTouchTerm: varchar("first_touch_term", { length: 128 }),
  firstTouchContent: varchar("first_touch_content", { length: 128 }),
  firstTouchAt: timestamp("first_touch_at", { withTimezone: true }),
  lastTouchSource: varchar("last_touch_source", { length: 128 }),
  lastTouchMedium: varchar("last_touch_medium", { length: 128 }),
  lastTouchCampaign: varchar("last_touch_campaign", { length: 128 }),
  lastTouchAt: timestamp("last_touch_at", { withTimezone: true }),
});

export const analyticsDailyMetrics = pgTable(
  "analytics_daily_metrics",
  {
    metricDate: date("metric_date").notNull(),
    environment: varchar("environment", { length: 16 }).notNull(),
    metricName: varchar("metric_name", { length: 64 }).notNull(),
    metricValue: decimal("metric_value", { precision: 18, scale: 4 }).notNull(),
    dimensions: jsonb("dimensions").notNull().default({}),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("analytics_daily_metrics_unique").on(
      t.metricDate,
      t.environment,
      t.metricName,
      t.dimensions
    ),
  ]
);

export const analyticsErrors = pgTable("analytics_errors", {
  id: uuid("id").primaryKey().defaultRandom(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  environment: varchar("environment", { length: 16 }).notNull(),
  platform: varchar("platform", { length: 16 }),
  errorCategory: varchar("error_category", { length: 64 }),
  severity: varchar("severity", { length: 16 }),
  endpoint: varchar("endpoint", { length: 256 }),
  requestId: uuid("request_id"),
  anonymousId: uuid("anonymous_id"),
  message: text("message"),
  metadata: jsonb("metadata"),
});

/** CMS admin / operational audit (separate from product analytics events). */
export const analyticsAuditLog = pgTable("analytics_audit_log", {
  id: uuid("id").primaryKey().defaultRandom(),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  actorId: uuid("actor_id").notNull(),
  actorRole: varchar("actor_role", { length: 32 }),
  action: varchar("action", { length: 64 }).notNull(),
  objectType: varchar("object_type", { length: 64 }),
  objectId: varchar("object_id", { length: 64 }),
  success: boolean("success").notNull().default(true),
  metadata: jsonb("metadata"),
});

/** Website contact form submissions (operational — not duplicated in analytics events). */
export const contactSubmissions = pgTable("contact_submissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 128 }).notNull(),
  email: varchar("email", { length: 256 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  interest: varchar("interest", { length: 128 }).notNull(),
  message: text("message").notNull(),
  channel: varchar("channel", { length: 16 }).notNull().default("web"),
  anonymousId: uuid("anonymous_id"),
  environment: varchar("environment", { length: 16 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** SEO / AISO knowledge graph nodes (Phase 2). */
export const seoEntities = pgTable("seo_entities", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  type: varchar("type", { length: 64 }).notNull(),
  name: varchar("name", { length: 256 }).notNull(),
  description: text("description").notNull(),
  aliases: jsonb("aliases").notNull().default([]),
  metadata: jsonb("metadata").notNull().default({}),
  url: varchar("url", { length: 512 }),
  published: boolean("published").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Directed edges in the SEO knowledge graph. */
export const seoEntityRelations = pgTable(
  "seo_entity_relations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromEntityId: uuid("from_entity_id")
      .notNull()
      .references(() => seoEntities.id, { onDelete: "cascade" }),
    toEntityId: uuid("to_entity_id")
      .notNull()
      .references(() => seoEntities.id, { onDelete: "cascade" }),
    relationType: varchar("relation_type", { length: 64 }).notNull().default("related"),
    weight: decimal("weight", { precision: 5, scale: 2 }).notNull().default("1"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("seo_entity_relation_unique").on(t.fromEntityId, t.toEntityId, t.relationType),
  ]
);

/** CMS-managed SEO content: guides, FAQs, articles, how-tos, local pages. */
export const seoContent = pgTable(
  "seo_content",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 160 }).notNull(),
    locale: varchar("locale", { length: 16 }).notNull().default("en-KE"),
    title: varchar("title", { length: 256 }).notNull(),
    description: text("description").notNull(),
    bodyMd: text("body_md"),
    contentType: varchar("content_type", { length: 32 }).notNull(),
    entityIds: jsonb("entity_ids").notNull().default([]),
    schemaJson: jsonb("schema_json"),
    aisoBlocks: jsonb("aiso_blocks").notNull().default([]),
    status: varchar("status", { length: 16 }).notNull().default("draft"),
    authorName: varchar("author_name", { length: 128 }),
    reviewerName: varchar("reviewer_name", { length: 128 }),
    reviewStatus: varchar("review_status", { length: 32 }),
    reviewNotes: text("review_notes"),
    aiGenerated: boolean("ai_generated").notNull().default(false),
    generationMetadata: jsonb("generation_metadata"),
    sources: jsonb("sources").notNull().default([]),
    templateId: uuid("template_id"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("seo_content_slug_locale_unique").on(t.slug, t.locale)]
);

/** Reusable templates for local SEO page factory (Phase 3). */
export const seoPageTemplates = pgTable("seo_page_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: varchar("slug", { length: 128 }).notNull().unique(),
  name: varchar("name", { length: 256 }).notNull(),
  contentType: varchar("content_type", { length: 32 }).notNull().default("local_page"),
  slugPattern: varchar("slug_pattern", { length: 256 }).notNull(),
  titleTemplate: varchar("title_template", { length: 512 }).notNull(),
  descriptionTemplate: text("description_template").notNull(),
  bodyTemplate: text("body_template"),
  aisoTemplate: jsonb("aiso_template").notNull().default([]),
  entityType: varchar("entity_type", { length: 64 }).notNull().default("location"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** SEO performance snapshots (GSC / CWV / AI referrals). */
export const seoMetrics = pgTable(
  "seo_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    path: varchar("path", { length: 512 }).notNull(),
    metricDate: date("metric_date").notNull(),
    impressions: integer("impressions"),
    clicks: integer("clicks"),
    avgPosition: decimal("avg_position", { precision: 8, scale: 2 }),
    cwvLcp: decimal("cwv_lcp", { precision: 8, scale: 3 }),
    cwvInp: decimal("cwv_inp", { precision: 8, scale: 3 }),
    cwvCls: decimal("cwv_cls", { precision: 8, scale: 4 }),
    aiReferrals: integer("ai_referrals").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("seo_metrics_path_date_unique").on(t.path, t.metricDate)]
);

/** Vector embeddings for semantic search (JSON float array — pgvector optional upgrade). */
export const seoEmbeddings = pgTable("seo_embeddings", {
  contentId: uuid("content_id")
    .primaryKey()
    .references(() => seoContent.id, { onDelete: "cascade" }),
  model: varchar("model", { length: 64 }).notNull(),
  dimensions: integer("dimensions").notNull(),
  embedding: jsonb("embedding").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Search Console query snapshots for content gap analysis. */
export const seoSearchQueries = pgTable(
  "seo_search_queries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    query: varchar("query", { length: 512 }).notNull(),
    metricDate: date("metric_date").notNull(),
    impressions: integer("impressions").notNull().default(0),
    clicks: integer("clicks").notNull().default(0),
    avgPosition: decimal("avg_position", { precision: 8, scale: 2 }),
    landingPath: varchar("landing_path", { length: 512 }),
    source: varchar("source", { length: 32 }).notNull().default("gsc"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("seo_search_query_unique").on(t.query, t.metricDate, t.landingPath)]
);

/** Competitor SERP position snapshots (Phase 4). */
export const seoCompetitorSnapshots = pgTable(
  "seo_competitor_snapshots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    query: varchar("query", { length: 512 }).notNull(),
    competitorDomain: varchar("competitor_domain", { length: 256 }).notNull(),
    competitorUrl: varchar("competitor_url", { length: 512 }),
    position: integer("position").notNull(),
    ourPosition: integer("our_position"),
    ourUrl: varchar("our_url", { length: 512 }),
    capturedAt: date("captured_at").notNull(),
    source: varchar("source", { length: 32 }).notNull().default("manual"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("seo_competitor_snapshot_unique").on(
      t.query,
      t.competitorDomain,
      t.capturedAt
    ),
  ]
);

/** AI referrer / citation events aggregated by path (Phase 4). */
export const seoAiCitations = pgTable(
  "seo_ai_citations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    path: varchar("path", { length: 512 }).notNull(),
    referrerSource: varchar("referrer_source", { length: 64 }).notNull(),
    citationDate: date("citation_date").notNull(),
    sessions: integer("sessions").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("seo_ai_citation_unique").on(t.path, t.referrerSource, t.citationDate),
  ]
);
