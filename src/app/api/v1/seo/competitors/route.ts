import { isPostgresEnabled } from "@/db/client";
import { requireAdmin } from "@/lib/api/require-admin";
import { apiError, apiOk } from "@/lib/api/responses";
import { competitorSummary, listCompetitorThreats } from "@/lib/seo/competitors";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  const summary = await competitorSummary();
  const threats = await listCompetitorThreats(30);

  return apiOk({ summary, threats });
}
