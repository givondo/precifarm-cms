import { requireAdmin } from "@/lib/api/require-admin";
import { apiOk, apiError } from "@/lib/api/responses";
import { aggregateDailyRange, persistDailyMetrics } from "@/lib/analytics/aggregate-daily";
import { getLocalDateString } from "@/lib/booking";

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Admin-only manual aggregation. Optional cron via ANALYTICS_CRON_KEY header. */
export async function POST(request: Request) {
  const cronKey = process.env.ANALYTICS_CRON_KEY?.trim();
  const headerKey = request.headers.get("x-analytics-cron-key");

  if (cronKey && headerKey === cronKey) {
    const today = getLocalDateString();
    const result = await aggregateDailyRange(addDays(today, -1), today);
    return apiOk({ ...result, triggeredBy: "cron" });
  }

  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  let body: { date?: string; start?: string; end?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* empty body ok */
  }

  const today = getLocalDateString();
  const start = body.start ?? body.date ?? addDays(today, -1);
  const end = body.end ?? body.date ?? today;

  if (start > end) {
    return apiError("VALIDATION_ERROR", "start must be before end.", 400);
  }

  if (start === end) {
    const metricsWritten = await persistDailyMetrics(start);
    return apiOk({ days: 1, metricsWritten, start, end });
  }

  const result = await aggregateDailyRange(start, end);
  return apiOk({ ...result, start, end });
}
