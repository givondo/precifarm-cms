import { isPostgresEnabled } from "@/db/client";
import { requireAdmin } from "@/lib/api/require-admin";
import { apiError, apiOk } from "@/lib/api/responses";
import { generateContentDraft, isContentGenerationConfigured } from "@/lib/seo/generate";
import { mapSeoContent, type SeoContentRow } from "@/lib/seo/types";
import type { SeoContentType } from "@/lib/seo/types";
import { getDb } from "@/db/client";
import { seoContent } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  if (!isContentGenerationConfigured()) {
    return apiError("GENERATION_UNAVAILABLE", "OPENAI_API_KEY is not configured.", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body.", 400);
  }

  const b = body as Record<string, unknown>;
  const topic = String(b.topic ?? "").trim();
  const contentType = String(b.contentType ?? "guide") as SeoContentType;
  const gapQuery = b.gapQuery ? String(b.gapQuery) : undefined;
  const save = b.save !== false;

  if (topic.length < 5) {
    return apiError("VALIDATION_ERROR", "topic must be at least 5 characters.", 400);
  }

  const draft = await generateContentDraft({ topic, contentType, gapQuery });

  if (!save) {
    return apiOk({ draft, saved: false });
  }

  const db = getDb();
  const [existing] = await db.select().from(seoContent).where(eq(seoContent.slug, draft.slug)).limit(1);
  const slug = existing ? `${draft.slug}-${Date.now().toString(36)}` : draft.slug;

  const [row] = await db
    .insert(seoContent)
    .values({
      slug,
      locale: "en-KE",
      title: draft.title,
      description: draft.description,
      bodyMd: draft.bodyMd,
      contentType,
      status: "draft",
      reviewStatus: "pending_review",
      aiGenerated: true,
      generationMetadata: draft.generationMetadata,
      sources: draft.sources,
      aisoBlocks: draft.aisoBlocks,
      authorName: "Precifarm AI",
      entityIds: [],
      updatedAt: new Date(),
    })
    .returning();

  return apiOk({ content: mapSeoContent(row as unknown as SeoContentRow), saved: true }, 201);
}
