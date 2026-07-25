import { getDb, isPostgresEnabled } from "@/db/client";
import { analyticsErrors } from "@/db/schema";
import { getAnalyticsEnvironment } from "@/lib/analytics/environment";
import type { AnalyticsErrorInput } from "@/lib/analytics/error-validate";

function scrubMetadata(meta?: Record<string, unknown>): Record<string, unknown> | null {
  if (!meta) return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    const lower = key.toLowerCase();
    if (
      lower.includes("password") ||
      lower.includes("token") ||
      lower.includes("secret") ||
      lower.includes("phone") ||
      lower.includes("email")
    ) {
      continue;
    }
    if (typeof value === "string" && value.length > 500) {
      out[key] = value.slice(0, 500);
    } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

export async function insertAnalyticsError(input: AnalyticsErrorInput): Promise<boolean> {
  if (!isPostgresEnabled()) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[analytics-error]", input.error_category, input.message);
    }
    return false;
  }

  try {
    const db = getDb();
    await db.insert(analyticsErrors).values({
      id: input.error_id,
      occurredAt: input.occurred_at ? new Date(input.occurred_at) : undefined,
      environment: input.environment ?? getAnalyticsEnvironment(),
      platform: input.platform,
      errorCategory: input.error_category,
      severity: input.severity ?? "error",
      endpoint: input.endpoint,
      requestId: input.request_id,
      anonymousId: input.anonymous_id,
      message: input.message,
      metadata: scrubMetadata(input.metadata),
    });
    return true;
  } catch (err) {
    console.error("[analytics-error] insert failed:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function insertAnalyticsErrors(inputs: AnalyticsErrorInput[]): Promise<number> {
  let inserted = 0;
  for (const input of inputs) {
    if (await insertAnalyticsError(input)) inserted++;
  }
  return inserted;
}
