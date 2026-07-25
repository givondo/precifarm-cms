import postgres from "postgres";
import { getDatabaseUrl } from "@/lib/database-url";

/** Server-only — ping Supabase/PostgreSQL for /api/v1/health. */
export async function checkDatabaseConnection(): Promise<{
  ok: boolean;
  error?: string;
}> {
  const url = getDatabaseUrl();
  if (!url) {
    return { ok: false, error: "Database not configured" };
  }

  const sql = postgres(url, {
    max: 1,
    prepare: false,
    connect_timeout: 15,
    ssl: url.includes("supabase") ? "require" : undefined,
  });

  try {
    await sql`select 1 as ok`;
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Database connection failed";
    return { ok: false, error: message };
  } finally {
    await sql.end({ timeout: 2 }).catch(() => {});
  }
}
