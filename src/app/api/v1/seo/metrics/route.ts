import { isPostgresEnabled } from "@/db/client";
import {
  bulkUpsertMetrics,
  bulkUpsertSearchQueries,
  type MetricsInput,
  type SearchQueryInput,
} from "@/lib/seo/analytics";
import { bulkUpsertCompetitorSnapshots, type CompetitorSnapshotInput } from "@/lib/seo/competitors";
import { bulkUpsertAiCitations, type CitationInput } from "@/lib/seo/citations";
import { apiError, apiOk } from "@/lib/api/responses";

function authorizeCron(request: Request): boolean {
  const key = process.env.SEO_CRON_KEY?.trim();
  if (!key) return false;
  return request.headers.get("x-seo-cron-key") === key;
}

export async function POST(request: Request) {
  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  if (!authorizeCron(request)) {
    return apiError("UNAUTHORIZED", "Valid X-SEO-Cron-Key required.", 401);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body.", 400);
  }

  const payload = body as {
    metrics?: MetricsInput[];
    searchQueries?: SearchQueryInput[];
    competitorSnapshots?: CompetitorSnapshotInput[];
    aiCitations?: CitationInput[];
    source?: string;
  };

  const metrics = payload.metrics ?? [];
  const searchQueries = (payload.searchQueries ?? []).map((row) => ({
    ...row,
    source: row.source ?? payload.source ?? "gsc",
  }));
  const competitorSnapshots = payload.competitorSnapshots ?? [];
  const aiCitations = payload.aiCitations ?? [];

  if (metrics.length) await bulkUpsertMetrics(metrics);
  if (searchQueries.length) await bulkUpsertSearchQueries(searchQueries);
  if (competitorSnapshots.length) await bulkUpsertCompetitorSnapshots(competitorSnapshots);
  if (aiCitations.length) await bulkUpsertAiCitations(aiCitations);

  return apiOk({
    ingested: {
      metrics: metrics.length,
      searchQueries: searchQueries.length,
      competitorSnapshots: competitorSnapshots.length,
      aiCitations: aiCitations.length,
    },
  });
}
