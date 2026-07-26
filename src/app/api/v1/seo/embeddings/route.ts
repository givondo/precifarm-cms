import { isPostgresEnabled } from "@/db/client";
import { generateAllEmbeddings, embeddingStats } from "@/lib/seo/analytics";
import { isEmbeddingConfigured } from "@/lib/seo/embeddings";
import { requireAdmin } from "@/lib/api/require-admin";
import { apiError, apiOk } from "@/lib/api/responses";

export async function GET() {
  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  const stats = await embeddingStats();
  return apiOk({
    configured: isEmbeddingConfigured(),
    ...stats,
  });
}

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  if (!isEmbeddingConfigured()) {
    return apiError("EMBEDDINGS_UNAVAILABLE", "OPENAI_API_KEY is not configured.", 503);
  }

  const results = await generateAllEmbeddings();
  const stats = await embeddingStats();

  return apiOk({ results, stats });
}
