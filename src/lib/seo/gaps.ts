import { desc, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { seoContent, seoEntities, seoSearchQueries } from "@/db/schema";
import { mapSeoContent, type SeoContentRow } from "@/lib/seo/types";

export type GapStatus = "uncovered" | "partial" | "covered";
export type GapIntent = "informational" | "transactional" | "navigational";

export type ContentGap = {
  query: string;
  impressions: number;
  clicks: number;
  ctr: number;
  avgPosition: number | null;
  gapStatus: GapStatus;
  intent: GapIntent;
  priority: number;
  matchedContentSlug: string | null;
  matchedContentTitle: string | null;
  matchedEntitySlug: string | null;
  suggestedAction: string;
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function overlapScore(query: string, haystack: string): number {
  const qTokens = tokenize(query);
  if (!qTokens.length) return 0;
  const hTokens = new Set(tokenize(haystack));
  const matches = qTokens.filter((t) => hTokens.has(t)).length;
  return matches / qTokens.length;
}

function classifyIntent(query: string): GapIntent {
  const q = query.toLowerCase();
  if (/(book|buy|price|ticket|fare|mpesa|near me|booking)/.test(q)) return "transactional";
  if (/(precifarm|login|app download)/.test(q)) return "navigational";
  return "informational";
}

function findBestContentMatch(
  query: string,
  content: ReturnType<typeof mapSeoContent>[],
): { slug: string; title: string; score: number } | null {
  let best: { slug: string; title: string; score: number } | null = null;

  for (const item of content) {
    const corpus = [item.title, item.description, item.slug, item.bodyMd ?? ""].join(" ");
    const score = overlapScore(query, corpus);
    if (!best || score > best.score) {
      best = { slug: item.slug, title: item.title, score };
    }
  }

  return best && best.score >= 0.35 ? best : null;
}

function findBestEntityMatch(
  query: string,
  entities: { slug: string; name: string; description: string; aliases: string[] }[],
): { slug: string; score: number } | null {
  let best: { slug: string; score: number } | null = null;

  for (const entity of entities) {
    const corpus = [entity.name, entity.description, entity.slug, ...entity.aliases].join(" ");
    const score = overlapScore(query, corpus);
    if (!best || score > best.score) {
      best = { slug: entity.slug, score };
    }
  }

  return best && best.score >= 0.35 ? best : null;
}

export async function analyzeContentGaps(limit = 50): Promise<ContentGap[]> {
  const db = getDb();

  const aggregated = await db
    .select({
      query: seoSearchQueries.query,
      impressions: sql<number>`sum(${seoSearchQueries.impressions})::int`,
      clicks: sql<number>`sum(${seoSearchQueries.clicks})::int`,
      avgPosition: sql<number>`avg(${seoSearchQueries.avgPosition})::float`,
    })
    .from(seoSearchQueries)
    .groupBy(seoSearchQueries.query)
    .orderBy(desc(sql`sum(${seoSearchQueries.impressions})`))
    .limit(limit);

  const [contentRows, entityRows] = await Promise.all([
    db.select().from(seoContent).where(sql`${seoContent.status} IN ('published', 'draft')`),
    db.select().from(seoEntities).where(sql`${seoEntities.published} = true`),
  ]);

  const content = contentRows.map((row) => mapSeoContent(row as SeoContentRow));
  const entities = entityRows.map((row) => ({
    slug: row.slug,
    name: row.name,
    description: row.description,
    aliases: (row.aliases as string[]) ?? [],
  }));

  return aggregated.map((row) => {
    const impressions = row.impressions ?? 0;
    const clicks = row.clicks ?? 0;
    const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
    const contentMatch = findBestContentMatch(row.query, content);
    const entityMatch = findBestEntityMatch(row.query, entities);

    let gapStatus: GapStatus = "uncovered";
    if (contentMatch && clicks > 0) gapStatus = "covered";
    else if (contentMatch || entityMatch) gapStatus = "partial";

    const intent = classifyIntent(row.query);
    const priority = Math.round(impressions * (gapStatus === "uncovered" ? 1.5 : gapStatus === "partial" ? 1 : 0.3));

    let suggestedAction = "Create a new guide or FAQ targeting this query.";
    if (gapStatus === "partial" && contentMatch) {
      suggestedAction = `Improve "${contentMatch.title}" title/meta and add FAQ blocks for "${row.query}".`;
    } else if (gapStatus === "covered") {
      suggestedAction = "Monitor — content exists with clicks. Consider expanding depth.";
    } else if (intent === "transactional") {
      suggestedAction = "Add conversion-focused landing copy and booking CTA for this query.";
    }

    return {
      query: row.query,
      impressions,
      clicks,
      ctr: Math.round(ctr * 100) / 100,
      avgPosition: row.avgPosition ? Math.round(row.avgPosition * 10) / 10 : null,
      gapStatus,
      intent,
      priority,
      matchedContentSlug: contentMatch?.slug ?? null,
      matchedContentTitle: contentMatch?.title ?? null,
      matchedEntitySlug: entityMatch?.slug ?? null,
      suggestedAction,
    };
  });
}

export async function listPendingReviewContent(limit = 20) {
  const db = getDb();
  const rows = await db
    .select()
    .from(seoContent)
    .where(sql`${seoContent.reviewStatus} = 'pending_review'`)
    .orderBy(desc(seoContent.updatedAt))
    .limit(limit);

  return rows.map((row) => mapSeoContent(row as SeoContentRow));
}
