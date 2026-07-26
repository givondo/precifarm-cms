import { desc, eq, gte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { seoContent, seoEmbeddings, seoMetrics, seoSearchQueries } from "@/db/schema";
import { cosineSimilarity, embeddingText, generateEmbedding } from "@/lib/seo/embeddings";
import { seoCounts } from "@/lib/seo/queries";
import { aiCitationSummary } from "@/lib/seo/citations";
import { competitorSummary } from "@/lib/seo/competitors";
import { staleContentSummary } from "@/lib/seo/stale";
import { mapSeoContent, type SeoContentRow } from "@/lib/seo/types";

export async function upsertContentEmbedding(contentId: string) {
  const db = getDb();
  const [row] = await db.select().from(seoContent).where(eq(seoContent.id, contentId)).limit(1);
  if (!row) throw new Error("Content not found.");

  const text = embeddingText({
    title: row.title,
    description: row.description,
    bodyMd: row.bodyMd,
  });

  const { model, dimensions, vector } = await generateEmbedding(text);

  await db
    .insert(seoEmbeddings)
    .values({
      contentId,
      model,
      dimensions,
      embedding: vector,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: seoEmbeddings.contentId,
      set: { model, dimensions, embedding: vector, updatedAt: new Date() },
    });

  return { contentId, model, dimensions };
}

export async function generateAllEmbeddings() {
  const db = getDb();
  const rows = await db
    .select()
    .from(seoContent)
    .where(eq(seoContent.status, "published"));

  const results: { slug: string; ok: boolean; error?: string }[] = [];

  for (const row of rows) {
    try {
      await upsertContentEmbedding(row.id);
      results.push({ slug: row.slug, ok: true });
    } catch (err) {
      results.push({
        slug: row.slug,
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return results;
}

export async function semanticSearchContent(query: string, limit = 10) {
  const db = getDb();
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { vector: queryVector } = await generateEmbedding(trimmed);

  const rows = await db
    .select({ content: seoContent, embedding: seoEmbeddings })
    .from(seoEmbeddings)
    .innerJoin(seoContent, eq(seoEmbeddings.contentId, seoContent.id))
    .where(eq(seoContent.status, "published"));

  const scored = rows
    .map((row) => {
      const vector = row.embedding.embedding as number[];
      const score = cosineSimilarity(queryVector, vector);
      return {
        score,
        content: mapSeoContent(row.content as SeoContentRow),
      };
    })
    .filter((item) => item.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}

export async function embeddingStats() {
  const db = getDb();
  const [published] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(seoContent)
    .where(eq(seoContent.status, "published"));
  const [embedded] = await db.select({ count: sql<number>`count(*)::int` }).from(seoEmbeddings);

  return {
    published: published?.count ?? 0,
    embedded: embedded?.count ?? 0,
  };
}

export type MetricsInput = {
  path: string;
  metricDate: string;
  impressions?: number;
  clicks?: number;
  avgPosition?: number;
  cwvLcp?: number;
  cwvInp?: number;
  cwvCls?: number;
  aiReferrals?: number;
};

export type SearchQueryInput = {
  query: string;
  metricDate: string;
  impressions: number;
  clicks: number;
  avgPosition?: number;
  landingPath?: string;
  source?: string;
};

export async function bulkUpsertMetrics(rows: MetricsInput[]) {
  for (const row of rows) {
    const db = getDb();
    await db
      .insert(seoMetrics)
      .values({
        path: row.path,
        metricDate: row.metricDate,
        impressions: row.impressions,
        clicks: row.clicks,
        avgPosition: row.avgPosition?.toString(),
        cwvLcp: row.cwvLcp?.toString(),
        cwvInp: row.cwvInp?.toString(),
        cwvCls: row.cwvCls?.toString(),
        aiReferrals: row.aiReferrals ?? 0,
      })
      .onConflictDoUpdate({
        target: [seoMetrics.path, seoMetrics.metricDate],
        set: {
          impressions: row.impressions,
          clicks: row.clicks,
          avgPosition: row.avgPosition?.toString(),
          cwvLcp: row.cwvLcp?.toString(),
          cwvInp: row.cwvInp?.toString(),
          cwvCls: row.cwvCls?.toString(),
          aiReferrals: row.aiReferrals ?? 0,
        },
      });
  }
}

export async function bulkUpsertSearchQueries(rows: SearchQueryInput[]) {
  const db = getDb();
  for (const row of rows) {
    await db
      .insert(seoSearchQueries)
      .values({
        query: row.query,
        metricDate: row.metricDate,
        impressions: row.impressions,
        clicks: row.clicks,
        avgPosition: row.avgPosition?.toString(),
        landingPath: row.landingPath ?? null,
        source: row.source ?? "gsc",
      })
      .onConflictDoUpdate({
        target: [seoSearchQueries.query, seoSearchQueries.metricDate, seoSearchQueries.landingPath],
        set: {
          impressions: row.impressions,
          clicks: row.clicks,
          avgPosition: row.avgPosition?.toString(),
        },
      });
  }
}

export async function getMetricsSummary(days = 7) {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const rows = await db
    .select()
    .from(seoMetrics)
    .where(gte(seoMetrics.metricDate, sinceStr))
    .orderBy(desc(seoMetrics.metricDate));

  const totals = rows.reduce(
    (acc, row) => {
      acc.impressions += row.impressions ?? 0;
      acc.clicks += row.clicks ?? 0;
      acc.aiReferrals += row.aiReferrals ?? 0;
      return acc;
    },
    { impressions: 0, clicks: 0, aiReferrals: 0 }
  );

  const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;

  const topPaths = Object.entries(
    rows.reduce<Record<string, { clicks: number; impressions: number }>>((acc, row) => {
      acc[row.path] ??= { clicks: 0, impressions: 0 };
      acc[row.path].clicks += row.clicks ?? 0;
      acc[row.path].impressions += row.impressions ?? 0;
      return acc;
    }, {})
  )
    .map(([path, stats]) => ({ path, ...stats }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 10);

  return { days, totals, ctr, topPaths, rowCount: rows.length };
}

export async function getTopSearchQueries(limit = 20) {
  const db = getDb();
  const rows = await db
    .select()
    .from(seoSearchQueries)
    .orderBy(desc(seoSearchQueries.impressions))
    .limit(limit);

  return rows.map((row) => ({
    query: row.query,
    metricDate: row.metricDate,
    impressions: row.impressions,
    clicks: row.clicks,
    avgPosition: row.avgPosition,
    landingPath: row.landingPath,
    source: row.source,
  }));
}

export async function buildWeeklySeoReport() {
  const counts = await seoCounts();
  const metrics = await getMetricsSummary(7);
  const queries = await getTopSearchQueries(15);
  const embeddings = await embeddingStats();
  const aiCitations = await aiCitationSummary(7);
  const competitors = await competitorSummary();
  const stale = await staleContentSummary();

  const recommendations: string[] = [];

  if (counts.published < 10) {
    recommendations.push("Publish more guides and FAQs to expand topical authority.");
  }
  if (embeddings.embedded < embeddings.published) {
    recommendations.push("Run embedding generation for semantic search coverage.");
  }
  if (metrics.totals.impressions > 0 && metrics.ctr < 2) {
    recommendations.push("Improve titles and meta descriptions — CTR is below 2%.");
  }
  if (queries.some((q) => q.clicks === 0 && q.impressions > 50)) {
    recommendations.push("Create content targeting high-impression zero-click GSC queries.");
  }
  if (aiCitations.sessions > 0) {
    recommendations.push(
      `AI referrers drove ${aiCitations.sessions} sessions — expand cited pages with FAQ blocks.`
    );
  }
  if (competitors.highThreats > 0) {
    recommendations.push(`${competitors.highThreats} high-threat competitor SERP gaps detected.`);
  }
  if (stale.staleCount > 0) {
    recommendations.push(`${stale.staleCount} published pages are stale — run seo:refresh-stale.`);
  }

  return {
    generatedAt: new Date().toISOString(),
    period: "7d",
    counts,
    metrics,
    topQueries: queries,
    embeddings,
    aiCitations,
    competitors,
    stale,
    recommendations,
  };
}
