import { NextResponse } from "next/server";
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

const rateLimit = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 120;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || entry.resetAt < now) {
    rateLimit.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  return request.headers.get("x-nf-client-connection-ip") ?? "unknown";
}

function checkIngestAuth(request: Request): boolean {
  const requiredKey = getAnalyticsIngestKey();
  if (!requiredKey) return true;
  return request.headers.get("x-analytics-key") === requiredKey;
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
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "Too many analytics events." } },
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
