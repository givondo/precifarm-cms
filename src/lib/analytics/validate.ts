import { CURRENT_SCHEMA_VERSION, isAllowedEventName } from "@/lib/analytics/catalog";
import type { AnalyticsEventInput, AnalyticsPlatform } from "@/lib/analytics/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PLATFORMS = new Set<AnalyticsPlatform>(["web", "mobile", "cms", "server"]);

const PII_BLOCKLIST = new Set([
  "phone",
  "email",
  "password",
  "idnumber",
  "id_number",
  "national_id",
  "mpesa_pin",
  "card_number",
  "cvv",
  "token",
  "sms_body",
  "prompt",
  "message_content",
  "contact_phone",
  "contact_name",
  "idNumber",
]);

const MAX_PROPERTIES = 50;
const MAX_STRING_LENGTH = 512;
const TIMESTAMP_SKEW_MS = 7 * 24 * 60 * 60 * 1000;

export type ValidationResult =
  | { ok: true; event: AnalyticsEventInput }
  | { ok: false; error: string };

function isUuid(value: string | undefined): boolean {
  return !!value && UUID_RE.test(value);
}

function sanitizeProperties(
  props: Record<string, unknown> | undefined
): Record<string, string | number | boolean | null> {
  if (!props || typeof props !== "object") return {};
  const out: Record<string, string | number | boolean | null> = {};
  let count = 0;
  for (const [key, value] of Object.entries(props)) {
    if (count >= MAX_PROPERTIES) break;
    const lower = key.toLowerCase();
    if (PII_BLOCKLIST.has(lower) || PII_BLOCKLIST.has(key)) continue;
    if (value === null) {
      out[key] = null;
      count++;
      continue;
    }
    if (typeof value === "boolean" || typeof value === "number") {
      out[key] = value;
      count++;
      continue;
    }
    if (typeof value === "string") {
      out[key] = value.slice(0, MAX_STRING_LENGTH);
      count++;
    }
  }
  return out;
}

export function validateAnalyticsEvent(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: "Event body must be an object." };
  }

  const input = raw as Record<string, unknown>;
  const eventId = String(input.event_id ?? "");
  const eventName = String(input.event_name ?? "");
  const eventTimestamp = String(input.event_timestamp ?? "");
  const platform = String(input.platform ?? "") as AnalyticsPlatform;

  if (!isUuid(eventId)) return { ok: false, error: "Invalid event_id (UUID required)." };
  if (!isAllowedEventName(eventName)) return { ok: false, error: `Unknown event_name: ${eventName}` };
  if (!PLATFORMS.has(platform)) return { ok: false, error: "Invalid platform." };

  const schemaVersion = Number(input.schema_version ?? CURRENT_SCHEMA_VERSION);
  if (schemaVersion !== CURRENT_SCHEMA_VERSION) {
    return { ok: false, error: `Unsupported schema_version: ${schemaVersion}` };
  }

  const ts = Date.parse(eventTimestamp);
  if (Number.isNaN(ts)) return { ok: false, error: "Invalid event_timestamp." };
  if (Math.abs(ts - Date.now()) > TIMESTAMP_SKEW_MS) {
    return { ok: false, error: "event_timestamp outside allowed window." };
  }

  const anonymousId = input.anonymous_id ? String(input.anonymous_id) : undefined;
  const customerId = input.customer_id ? String(input.customer_id) : undefined;
  const sessionId = input.session_id ? String(input.session_id) : undefined;

  if (anonymousId && !isUuid(anonymousId)) return { ok: false, error: "Invalid anonymous_id." };
  if (customerId && !isUuid(customerId)) return { ok: false, error: "Invalid customer_id." };
  if (sessionId && !isUuid(sessionId)) return { ok: false, error: "Invalid session_id." };

  if (!anonymousId && !customerId && !sessionId) {
    return { ok: false, error: "At least one of anonymous_id, customer_id, or session_id is required." };
  }

  const event: AnalyticsEventInput = {
    event_id: eventId,
    event_name: eventName,
    schema_version: schemaVersion,
    event_timestamp: new Date(ts).toISOString(),
    anonymous_id: anonymousId,
    customer_id: customerId,
    session_id: sessionId,
    platform,
    environment: input.environment as AnalyticsEventInput["environment"],
    app_version: input.app_version ? String(input.app_version).slice(0, 32) : undefined,
    device_id: input.device_id ? String(input.device_id).slice(0, 64) : undefined,
    page_url: input.page_url ? String(input.page_url).slice(0, 2048) : undefined,
    screen_name: input.screen_name ? String(input.screen_name).slice(0, 128) : undefined,
    feature: input.feature ? String(input.feature).slice(0, 64) : undefined,
    object_type: input.object_type ? String(input.object_type).slice(0, 64) : undefined,
    object_id: input.object_id ? String(input.object_id).slice(0, 64) : undefined,
    request_id: input.request_id && isUuid(String(input.request_id)) ? String(input.request_id) : undefined,
    booking_id: input.booking_id && isUuid(String(input.booking_id)) ? String(input.booking_id) : undefined,
    booking_reference: input.booking_reference
      ? String(input.booking_reference).slice(0, 32)
      : undefined,
    event_properties: sanitizeProperties(
      input.event_properties as Record<string, unknown> | undefined
    ),
    metadata:
      input.metadata && typeof input.metadata === "object"
        ? sanitizeProperties(input.metadata as Record<string, unknown>)
        : undefined,
  };

  return { ok: true, event };
}

export function validateAnalyticsBatch(raw: unknown): ValidationResult[] {
  if (!Array.isArray(raw)) return [{ ok: false, error: "Batch must be an array." }];
  if (raw.length === 0) return [{ ok: false, error: "Batch cannot be empty." }];
  if (raw.length > 50) return [{ ok: false, error: "Batch limit is 50 events." }];
  return raw.map((item) => validateAnalyticsEvent(item));
}
