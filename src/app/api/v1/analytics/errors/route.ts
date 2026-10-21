import { NextResponse } from "next/server";
import { tokensMatch } from "@/lib/security/mpesa-callback";
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
import { readJsonBody } from "@/lib/api/read-json";

const ERROR_LIMIT = 60;
const ERROR_WINDOW_MS = 60_000;
/** A full batch of 20 reports fits comfortably; anything larger is refused before parsing. */
const ERRORS_MAX_BYTES = 128 * 1024;

function checkIngestAuth(request: Request): boolean {
  const requiredKey = getAnalyticsIngestKey();
  // Open when ANALYTICS_INGEST_KEY is unset, as the website and app send events without one today.
  // Set the key (and send it from those clients) to close ingest; comparison is constant-time.
  if (!requiredKey) return true;
  return tokensMatch(request.headers.get("x-analytics-key"), requiredKey);
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
  if (!checkRateLimit(`errors:${ip}`, ERROR_LIMIT, ERROR_WINDOW_MS)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many error reports." } },
      { status: 429 }
    );
  }

  const read = await readJsonBody(request, ERRORS_MAX_BYTES);
  if (!read.ok) return read.response;
  const body = read.body;

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
