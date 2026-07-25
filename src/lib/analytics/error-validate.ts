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
      error_id: typeof raw.error_id === "string" ? raw.error_id : undefined,
      occurred_at: typeof raw.occurred_at === "string" ? raw.occurred_at : undefined,
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
      request_id: typeof raw.request_id === "string" ? raw.request_id : undefined,
      anonymous_id: typeof raw.anonymous_id === "string" ? raw.anonymous_id : undefined,
      message,
      metadata:
        raw.metadata && typeof raw.metadata === "object" && !Array.isArray(raw.metadata)
          ? (raw.metadata as Record<string, unknown>)
          : undefined,
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
