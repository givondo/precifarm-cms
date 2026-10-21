import type { AnalyticsEnvironment, AnalyticsPlatform } from "@/lib/analytics/types";

export type AnalyticsErrorInput = {
  error_id?: string;
  occurred_at?: string;
  environment?: AnalyticsEnvironment;
  platform?: AnalyticsPlatform;
  error_category?: string;
  severity?: "debug" | "info" | "warning" | "error" | "fatal";
  endpoint?: string;
  request_id?: string;
  anonymous_id?: string;
  message?: string;
  metadata?: Record<string, unknown>;
};

const SEVERITIES = new Set(["debug", "info", "warning", "error", "fatal"]);
const PLATFORMS = new Set(["web", "mobile", "cms", "server"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_METADATA_KEYS = 50;
const MAX_METADATA_KEY_LENGTH = 64;
const MAX_METADATA_STRING = 500;

/** Ids go into uuid columns: anything else is dropped rather than failing the insert. */
function uuidOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && UUID_RE.test(value) ? value : undefined;
}

function timestampOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.length <= 64 && !Number.isNaN(Date.parse(value)) ? value : undefined;
}

/** Public input: keep at most 50 short keys with primitive values, strings cut to 500 characters. */
function boundedMetadata(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (count >= MAX_METADATA_KEYS) break;
    if (key.length > MAX_METADATA_KEY_LENGTH) continue;
    if (typeof v === "string") out[key] = v.slice(0, MAX_METADATA_STRING);
    else if (typeof v === "number" || typeof v === "boolean") out[key] = v;
    else continue;
    count++;
  }
  return out;
}

export function validateAnalyticsError(body: unknown):
  | { ok: true; error: AnalyticsErrorInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body is required." };
  }

  const raw = body as Record<string, unknown>;
  const message = typeof raw.message === "string" ? raw.message.trim().slice(0, 2000) : "";
  if (!message) {
    return { ok: false, error: "message is required." };
  }

  const severity =
    typeof raw.severity === "string" && SEVERITIES.has(raw.severity)
      ? (raw.severity as AnalyticsErrorInput["severity"])
      : "error";

  const platform =
    typeof raw.platform === "string" && PLATFORMS.has(raw.platform)
      ? (raw.platform as AnalyticsPlatform)
      : undefined;

  return {
    ok: true,
    error: {
      error_id: uuidOrUndefined(raw.error_id),
      occurred_at: timestampOrUndefined(raw.occurred_at),
      environment:
        raw.environment === "production" ||
        raw.environment === "staging" ||
        raw.environment === "development"
          ? raw.environment
          : undefined,
      platform,
      error_category:
        typeof raw.error_category === "string"
          ? raw.error_category.trim().slice(0, 64)
          : undefined,
      severity,
      endpoint:
        typeof raw.endpoint === "string" ? raw.endpoint.trim().slice(0, 256) : undefined,
      request_id: uuidOrUndefined(raw.request_id),
      anonymous_id: uuidOrUndefined(raw.anonymous_id),
      message,
      metadata: boundedMetadata(raw.metadata),
    },
  };
}

export function validateAnalyticsErrorBatch(body: unknown): {
  ok: true;
  errors: AnalyticsErrorInput[];
} | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body is required." };
  }

  const errorsRaw = (body as { errors?: unknown }).errors;
  if (!Array.isArray(errorsRaw)) {
    return { ok: false, error: "errors array is required." };
  }
  if (errorsRaw.length === 0 || errorsRaw.length > 20) {
    return { ok: false, error: "Batch must contain 1–20 errors." };
  }

  const errors: AnalyticsErrorInput[] = [];
  for (const item of errorsRaw) {
    const result = validateAnalyticsError(item);
    if (!result.ok) return result;
    errors.push(result.error);
  }

  return { ok: true, errors };
}
