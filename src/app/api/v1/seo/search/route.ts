import { isPostgresEnabled } from "@/db/client";
import { semanticSearchContent } from "@/lib/seo/analytics";
import { isEmbeddingConfigured } from "@/lib/seo/embeddings";
import { searchSeoContent, searchSeoEntities } from "@/lib/seo/queries";
import { apiError, apiOk } from "@/lib/api/responses";

export async function GET(request: Request) {
  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";
  const limit = Number(searchParams.get("limit") ?? "20");
  const mode = searchParams.get("mode") ?? "keyword";

  if (!q.trim()) {
    return apiError("VALIDATION_ERROR", "Query parameter q is required.", 400);
  }

  if (mode === "semantic") {
    if (!isEmbeddingConfigured()) {
      return apiError("EMBEDDINGS_UNAVAILABLE", "Semantic search requires OPENAI_API_KEY.", 503);
    }

    const semantic = await semanticSearchContent(q, limit);
    return apiOk({
      query: q,
      content: semantic.map((item) => ({ ...item.content, score: item.score })),
      entities: [],
      meta: { engine: "openai-embeddings", version: "2.0" },
    });
  }

  const [content, entities] = await Promise.all([
    searchSeoContent(q, limit),
    searchSeoEntities(q, limit),
  ]);

  return apiOk({
    query: q,
    content,
    entities,
    meta: { engine: "postgres-ilike", version: "2.0" },
  });
}
