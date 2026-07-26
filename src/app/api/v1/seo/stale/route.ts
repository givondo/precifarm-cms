import { isPostgresEnabled } from "@/db/client";
import { requireAdmin } from "@/lib/api/require-admin";
import { apiError, apiOk } from "@/lib/api/responses";
import { findStaleContent, refreshAllStaleContent, refreshStaleContent, staleContentSummary } from "@/lib/seo/stale";

function authorizeCron(request: Request): boolean {
  const key = process.env.SEO_CRON_KEY?.trim();
  if (!key) return false;
  return request.headers.get("x-seo-cron-key") === key;
}

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  const summary = await staleContentSummary();
  const items = await findStaleContent();

  return apiOk({ summary, items });
}

export async function POST(request: Request) {
  const cronOk = authorizeCron(request);
  if (!cronOk) {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
  }

  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  let body: unknown = {};
  try {
    if (request.headers.get("content-length")) body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body.", 400);
  }

  const b = body as { slug?: string; maxItems?: number };
  if (b.slug) {
    const result = await refreshStaleContent(b.slug, true);
    return apiOk(result, 201);
  }

  const results = await refreshAllStaleContent(b.maxItems ?? 5);
  return apiOk({ results }, 201);
}
