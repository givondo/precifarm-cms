import { isPostgresEnabled } from "@/db/client";
import { requireAdmin } from "@/lib/api/require-admin";
import { apiError, apiOk } from "@/lib/api/responses";
import { aiCitationSummary, getTopAiCitations, ingestAiReferralsFromAnalytics } from "@/lib/seo/citations";

function authorizeCron(request: Request): boolean {
  const key = process.env.SEO_CRON_KEY?.trim();
  if (!key) return false;
  return request.headers.get("x-seo-cron-key") === key;
}

export async function GET(request: Request) {
  const auth = await requireAdmin();
  const cronOk = authorizeCron(request);
  if (!auth.ok && !cronOk) return auth.response;

  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  const summary = await aiCitationSummary(7);
  const topCitations = await getTopAiCitations(15);

  return apiOk({ summary, topCitations });
}

export async function POST(request: Request) {
  if (!authorizeCron(request)) {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
  }

  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  const result = await ingestAiReferralsFromAnalytics(7);
  return apiOk({ ingested: result });
}
