import { NextResponse } from "next/server";
import {
  getAnalyticsIngestKey,
  getAnalyticsIngestStatus,
  isAnalyticsIngestEnabled,
} from "@/lib/analytics";
import { insertAnalyticsError, insertAnalyticsErrors } from "@/lib/analytics/errors";
import {
  validateAnalyticsError,
  validateAnalyticsErrorBatch,
} from "@/lib/analytics/error-validate";
import { getClientIp, checkRateLimit } from "@/lib/api/rate-limit";

const ERROR_LIMIT = 60;
const ERROR_WINDOW_MS = 60_000;

function checkIngestAuth(request: Request): boolean {
  const requiredKey = getAnalyticsIngestKey();
  if (!requiredKey) return true;
  return request.headers.get("x-analytics-key") === requiredKey;
}

export async function POST(request: Request) {
  if (!isAnalyticsIngestEnabled()) {
    return NextResponse.json(
      { error: { code: "ANALYTICS_DISABLED", message: "Error ingest is disabled." } },
      { status: 503 }
    );
  }

  const status = await getAnalyticsIngestStatus();
  if (!status.postgres) {
    return NextResponse.json(
      {
        error: {
          code: "ANALYTICS_UNAVAILABLE",
          message: "Error ingest requires PostgreSQL.",
        },
      },
      { status: 503 }
    );
  }

  if (!checkIngestAuth(request)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid analytics ingest key." } },
      { status: 401 }
    );
  }

  const ip = getClientIp(request);
  if (!checkRateLimit(ip, ERROR_LIMIT, ERROR_WINDOW_MS)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many error reports." } },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Invalid JSON body." } },
      { status: 400 }
    );
  }

  if (body && typeof body === "object" && Array.isArray((body as { errors?: unknown }).errors)) {
    const batch = validateAnalyticsErrorBatch(body);
    if (!batch.ok) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: batch.error } },
        { status: 400 }
      );
    }
    const accepted = await insertAnalyticsErrors(batch.errors);
    return NextResponse.json({ data: { accepted, total: batch.errors.length } });
  }

  const result = validateAnalyticsError(body);
  if (!result.ok) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: result.error } },
      { status: 400 }
    );
  }

  const accepted = await insertAnalyticsError(result.error);
  return NextResponse.json({ data: { accepted: accepted ? 1 : 0, total: 1 } });
}

export async function GET() {
  const status = await getAnalyticsIngestStatus();
  return NextResponse.json({
    data: {
      ok: status.postgres,
      ingestEnabled: isAnalyticsIngestEnabled(),
      environment: status.environment,
    },
  });
}
