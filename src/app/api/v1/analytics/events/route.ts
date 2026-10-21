import { NextResponse } from "next/server";
import { tokensMatch } from "@/lib/security/mpesa-callback";
import {
  getAnalyticsIngestKey,
  getAnalyticsIngestStatus,
  insertAnalyticsEvent,
  insertAnalyticsEvents,
  isAnalyticsIngestEnabled,
  validateAnalyticsBatch,
  validateAnalyticsEvent,
} from "@/lib/analytics";
import type { AnalyticsEventInput } from "@/lib/analytics/types";
import { checkRateLimit, getClientIp } from "@/lib/api/rate-limit";
import { readJsonBody } from "@/lib/api/read-json";

const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;
/** A full batch of 50 events fits comfortably; anything larger is refused before parsing. */
const EVENTS_MAX_BYTES = 512 * 1024;

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
      { error: { code: "ANALYTICS_DISABLED", message: "Analytics ingest is disabled." } },
      { status: 503 }
    );
  }

  const status = await getAnalyticsIngestStatus();
  if (!status.postgres) {
    return NextResponse.json(
      {
        error: {
          code: "ANALYTICS_UNAVAILABLE",
          message: "Analytics requires PostgreSQL (DATABASE_URL or SUPABASE_DB_PASSWORD).",
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
  if (!checkRateLimit(`events:${ip}`, RATE_LIMIT, RATE_WINDOW_MS)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many analytics events." } },
      { status: 429 }
    );
  }

  const read = await readJsonBody(request, EVENTS_MAX_BYTES);
  if (!read.ok) return read.response;
  const body = read.body;

  if (body && typeof body === "object" && Array.isArray((body as { events?: unknown }).events)) {
    const results = validateAnalyticsBatch((body as { events: unknown[] }).events);
    const firstError = results.find((r) => !r.ok);
    if (firstError && !firstError.ok) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: firstError.error } },
        { status: 400 }
      );
    }
    const events = results
      .filter((r): r is { ok: true; event: AnalyticsEventInput } => r.ok)
      .map((r) => r.event);
    const accepted = await insertAnalyticsEvents(events);
    return NextResponse.json({ data: { accepted, total: events.length } });
  }

  const result = validateAnalyticsEvent(body);
  if (!result.ok) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: result.error } },
      { status: 400 }
    );
  }

  const accepted = await insertAnalyticsEvent(result.event);
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
