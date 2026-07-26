import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { seoContent } from "@/db/schema";
import { generateContentDraft } from "@/lib/seo/generate";
import { mapSeoContent, type SeoContentRow } from "@/lib/seo/types";

const DEFAULT_STALE_DAYS = Number(process.env.SEO_STALE_DAYS ?? "90");

export type StaleContentItem = {
  slug: string;
  title: string;
  contentType: string;
  updatedAt: string;
  reviewedAt: string | null;
  daysSinceUpdate: number;
  reason: string;
};

export async function findStaleContent(maxAgeDays = DEFAULT_STALE_DAYS): Promise<StaleContentItem[]> {
  const db = getDb();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - maxAgeDays);

  const rows = await db
    .select()
    .from(seoContent)
    .where(
      and(
        eq(seoContent.status, "published"),
        eq(seoContent.locale, "en-KE"),
        or(
          lt(seoContent.updatedAt, cutoff),
          sql`${seoContent.reviewedAt} IS NULL`
        )
      )
    )
    .orderBy(seoContent.updatedAt)
    .limit(50);

  const now = Date.now();

  return rows.map((row) => {
    const updated = row.updatedAt.getTime();
    const daysSinceUpdate = Math.floor((now - updated) / (1000 * 60 * 60 * 24));
    const reason = !row.reviewedAt
      ? "Never reviewed"
      : daysSinceUpdate >= maxAgeDays
        ? `Not updated in ${daysSinceUpdate} days`
        : "Review overdue";

    return {
      slug: row.slug,
      title: row.title,
      contentType: row.contentType,
      updatedAt: row.updatedAt.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      daysSinceUpdate,
      reason,
    };
  });
}

export async function refreshStaleContent(slug: string, save = true) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(seoContent)
    .where(and(eq(seoContent.slug, slug), eq(seoContent.locale, "en-KE")))
    .limit(1);

  if (!row) throw new Error("Content not found.");

  const draft = await generateContentDraft({
    topic: row.title,
    contentType: row.contentType === "local_page" ? "guide" : (row.contentType as "guide" | "faq" | "article" | "howto"),
    context: row.bodyMd ?? row.description,
  });

  if (!save) {
    return { draft, saved: false };
  }

  const refreshSlug = `${slug}-refresh-${Date.now().toString(36)}`;

  const [created] = await db
    .insert(seoContent)
    .values({
      slug: refreshSlug,
      locale: row.locale,
      title: draft.title,
      description: draft.description,
      bodyMd: draft.bodyMd,
      contentType: row.contentType,
      status: "draft",
      reviewStatus: "pending_review",
      aiGenerated: true,
      generationMetadata: {
        ...draft.generationMetadata,
        refreshOf: slug,
        staleRefresh: true,
      },
      sources: draft.sources,
      aisoBlocks: draft.aisoBlocks,
      authorName: "Precifarm AI",
      entityIds: row.entityIds as string[],
      updatedAt: new Date(),
    })
    .returning();

  return { content: mapSeoContent(created as SeoContentRow), saved: true, refreshOf: slug };
}

export async function refreshAllStaleContent(maxItems = 5) {
  const stale = await findStaleContent();
  const results: { slug: string; ok: boolean; refreshSlug?: string; error?: string }[] = [];

  for (const item of stale.slice(0, maxItems)) {
    try {
      const result = await refreshStaleContent(item.slug, true);
      results.push({
        slug: item.slug,
        ok: true,
        refreshSlug: result.content?.slug,
      });
    } catch (err) {
      results.push({
        slug: item.slug,
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return results;
}

export async function staleContentSummary() {
  const stale = await findStaleContent();
  return {
    staleCount: stale.length,
    oldestDays: stale[0]?.daysSinceUpdate ?? 0,
  };
}
