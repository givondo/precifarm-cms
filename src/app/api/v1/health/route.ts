import { NextResponse } from "next/server";
import { checkDatabaseConnection } from "@/lib/db-health";
import { envSummary } from "@/lib/env";

/** Public health check — no secrets, safe for ops monitoring. */
export async function GET() {
  const summary = envSummary();
  const database = summary.databaseConfigured
    ? await checkDatabaseConnection()
    : { ok: false, error: "DATABASE_URL not set" };

  return NextResponse.json({
    data: {
      ok: summary.databaseConfigured ? database.ok : true,
      ...summary,
      databaseOk: database.ok,
      databaseError: database.error ?? null,
    },
  });
}
