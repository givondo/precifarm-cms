import { NextResponse } from "next/server";
import { getSessionAgent } from "@/lib/auth";
import { getAnalyticsIngestStatus, isAnalyticsIngestEnabled } from "@/lib/analytics";
import { checkDatabaseConnection } from "@/lib/db-health";
import { envSummary } from "@/lib/env";
import { getStore } from "@/db";

/**
 * Health check. The public answer is only whether the CMS can read its data; an admin session also
 * gets the configuration summary (payment mode, storage, database and analytics status).
 */
export async function GET() {
  const summary = envSummary();
  let ok = true;
  let databaseError: string | null = null;
  try {
    if (summary.databaseConfigured) {
      const db = await checkDatabaseConnection();
      ok = db.ok;
      databaseError = db.error ?? null;
    } else {
      await getStore();
    }
  } catch (err) {
    ok = false;
    databaseError = err instanceof Error ? err.message : "storage unavailable";
  }

  const agent = await getSessionAgent().catch(() => null);
  if (agent?.role !== "admin") {
    return NextResponse.json({ data: { ok } }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  }
  const analytics = await getAnalyticsIngestStatus();
  return NextResponse.json(
    {
      data: {
        ok,
        ...summary,
        databaseError,
        analyticsIngestEnabled: isAnalyticsIngestEnabled(),
        analyticsPostgres: analytics.postgres,
        analyticsEnvironment: analytics.environment,
      },
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
