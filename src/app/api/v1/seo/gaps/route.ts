import { isPostgresEnabled } from "@/db/client";
import { requireAdmin } from "@/lib/api/require-admin";
import { apiError, apiOk } from "@/lib/api/responses";
import { analyzeContentGaps } from "@/lib/seo/gaps";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? "50");
  const status = searchParams.get("status");

  let gaps = await analyzeContentGaps(limit);

  if (status === "uncovered" || status === "partial" || status === "covered") {
    gaps = gaps.filter((gap) => gap.gapStatus === status);
  }

  const summary = {
    total: gaps.length,
    uncovered: gaps.filter((g) => g.gapStatus === "uncovered").length,
    partial: gaps.filter((g) => g.gapStatus === "partial").length,
    covered: gaps.filter((g) => g.gapStatus === "covered").length,
  };

  return apiOk({ gaps, summary });
}
