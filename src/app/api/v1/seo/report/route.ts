import { isPostgresEnabled } from "@/db/client";
import { buildWeeklySeoReport } from "@/lib/seo/analytics";
import { requireAdmin } from "@/lib/api/require-admin";
import { apiError, apiOk } from "@/lib/api/responses";

function authorizeCron(request: Request): boolean {
  const key = process.env.SEO_CRON_KEY?.trim();
  if (!key) return false;
  return request.headers.get("x-seo-cron-key") === key;
}

export async function GET(request: Request) {
  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  const cronOk = authorizeCron(request);
  if (!cronOk) {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
  }

  const report = await buildWeeklySeoReport();
  return apiOk({ report });
}
