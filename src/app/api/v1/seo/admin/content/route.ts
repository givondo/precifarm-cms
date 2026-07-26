import { eq } from "drizzle-orm";
import { getDb, isPostgresEnabled } from "@/db/client";
import { seoContent } from "@/db/schema";
import { requireAdmin } from "@/lib/api/require-admin";
import { apiError, apiOk } from "@/lib/api/responses";
import { mapSeoContent, type SeoContentRow } from "@/lib/seo/types";
import { validateContentInput, validateReviewAction } from "@/lib/seo/validate";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body.", 400);
  }

  const validated = validateContentInput(body);
  if (!validated.ok) {
    return apiError("VALIDATION_ERROR", validated.error, 400);
  }

  const db = getDb();
  const { input } = validated;

  const [row] = await db
    .insert(seoContent)
    .values({
      slug: input.slug,
      locale: input.locale,
      title: input.title,
      description: input.description,
      bodyMd: input.bodyMd,
      contentType: input.contentType,
      status: input.status,
      entityIds: input.entityIds,
      aisoBlocks: input.aisoBlocks,
      authorName: input.authorName ?? auth.agent.name,
      reviewerName: input.reviewerName,
      reviewStatus: input.reviewStatus,
      reviewNotes: input.reviewNotes,
      aiGenerated: input.aiGenerated,
      generationMetadata: input.generationMetadata,
      sources: input.sources,
      publishedAt: input.publishedAt,
      reviewedAt: input.reviewStatus === "approved" ? new Date() : null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [seoContent.slug, seoContent.locale],
      set: {
        title: input.title,
        description: input.description,
        bodyMd: input.bodyMd,
        contentType: input.contentType,
        status: input.status,
        entityIds: input.entityIds,
        aisoBlocks: input.aisoBlocks,
        authorName: input.authorName ?? auth.agent.name,
        reviewerName: input.reviewerName,
        reviewStatus: input.reviewStatus,
        reviewNotes: input.reviewNotes,
        aiGenerated: input.aiGenerated,
        generationMetadata: input.generationMetadata,
        sources: input.sources,
        publishedAt: input.publishedAt,
        updatedAt: new Date(),
      },
    })
    .returning();

  return apiOk({ content: mapSeoContent(row as unknown as SeoContentRow) }, 201);
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body.", 400);
  }

  const b = body as Record<string, unknown>;
  const slug = String(b.slug ?? "").trim();
  if (!slug) return apiError("VALIDATION_ERROR", "slug required.", 400);

  const db = getDb();
  const updates: Record<string, unknown> = { updatedAt: new Date() };

  if (b.title) updates.title = String(b.title);
  if (b.description) updates.description = String(b.description);
  if (b.bodyMd !== undefined) updates.bodyMd = b.bodyMd ? String(b.bodyMd) : null;

  const action = b.action;
  if (action && validateReviewAction(action)) {
    if (action === "submit_review") {
      updates.reviewStatus = "pending_review";
      updates.status = "draft";
    }
    if (action === "approve") {
      updates.reviewStatus = "approved";
      updates.reviewerName = auth.agent.name;
      updates.reviewedAt = new Date();
      if (b.reviewNotes) updates.reviewNotes = String(b.reviewNotes);
    }
    if (action === "reject") {
      updates.reviewStatus = "rejected";
      updates.reviewerName = auth.agent.name;
      updates.reviewedAt = new Date();
      if (b.reviewNotes) updates.reviewNotes = String(b.reviewNotes);
    }
    if (action === "publish") {
      updates.reviewStatus = "approved";
      updates.reviewerName = auth.agent.name;
      updates.reviewedAt = new Date();
      updates.status = "published";
      updates.publishedAt = new Date();
    }
  } else if (b.status) {
    updates.status = String(b.status);
    if (b.status === "published") updates.publishedAt = new Date();
  }

  if (b.reviewStatus && !action) updates.reviewStatus = String(b.reviewStatus);
  if (b.reviewNotes !== undefined) updates.reviewNotes = b.reviewNotes ? String(b.reviewNotes) : null;

  const [row] = await db
    .update(seoContent)
    .set(updates)
    .where(eq(seoContent.slug, slug))
    .returning();

  if (!row) return apiError("NOT_FOUND", "Content not found.", 404);
  return apiOk({ content: mapSeoContent(row as unknown as SeoContentRow) });
}
