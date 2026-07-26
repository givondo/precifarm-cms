import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb, isPostgresEnabled } from "@/db/client";
import { seoContent, seoEntities, seoEntityRelations, seoMetrics } from "@/db/schema";
import { mapSeoContent, mapSeoEntity, type SeoContentRow, type SeoEntityRow } from "@/lib/seo/types";

export function seoDbRequired() {
  return isPostgresEnabled();
}

export async function listSeoEntities(filters?: { type?: string; published?: boolean }) {
  const db = getDb();
  const conditions = [];
  if (filters?.type) conditions.push(eq(seoEntities.type, filters.type));
  if (filters?.published !== undefined) conditions.push(eq(seoEntities.published, filters.published));

  const rows = await db
    .select()
    .from(seoEntities)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(seoEntities.name);

  return rows.map((row) => mapSeoEntity(row as SeoEntityRow));
}

export async function getSeoEntityBySlug(slug: string) {
  const db = getDb();
  const [row] = await db.select().from(seoEntities).where(eq(seoEntities.slug, slug)).limit(1);
  return row ? mapSeoEntity(row as SeoEntityRow) : null;
}

export async function getRelatedSeoEntities(entityId: string) {
  const db = getDb();
  const relations = await db
    .select({ entity: seoEntities })
    .from(seoEntityRelations)
    .innerJoin(seoEntities, eq(seoEntityRelations.toEntityId, seoEntities.id))
    .where(eq(seoEntityRelations.fromEntityId, entityId));

  return relations.map((r) => mapSeoEntity(r.entity as SeoEntityRow));
}

export async function listSeoContent(filters?: {
  contentType?: string;
  status?: string;
  locale?: string;
  limit?: number;
}) {
  const db = getDb();
  const conditions = [];
  if (filters?.contentType) conditions.push(eq(seoContent.contentType, filters.contentType));
  if (filters?.status) conditions.push(eq(seoContent.status, filters.status));
  if (filters?.locale) conditions.push(eq(seoContent.locale, filters.locale));

  const rows = await db
    .select()
    .from(seoContent)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(seoContent.updatedAt))
    .limit(filters?.limit ?? 100);

  return rows.map((row) => mapSeoContent(row as SeoContentRow));
}

export async function getSeoContentBySlug(slug: string, publishedOnly = true, locale = "en-KE") {
  const db = getDb();
  const conditions = [eq(seoContent.slug, slug), eq(seoContent.locale, locale)];
  if (publishedOnly) conditions.push(eq(seoContent.status, "published"));

  const [row] = await db
    .select()
    .from(seoContent)
    .where(and(...conditions))
    .limit(1);

  return row ? mapSeoContent(row as SeoContentRow) : null;
}

export async function searchSeoContent(query: string, limit = 20) {
  const db = getDb();
  const pattern = `%${query.trim()}%`;
  if (!query.trim()) return [];

  const rows = await db
    .select()
    .from(seoContent)
    .where(
      and(
        eq(seoContent.status, "published"),
        or(
          ilike(seoContent.title, pattern),
          ilike(seoContent.description, pattern),
          ilike(seoContent.bodyMd, pattern),
          ilike(seoContent.slug, pattern)
        )
      )
    )
    .orderBy(desc(seoContent.updatedAt))
    .limit(limit);

  return rows.map((row) => mapSeoContent(row as SeoContentRow));
}

export async function searchSeoEntities(query: string, limit = 20) {
  const db = getDb();
  const pattern = `%${query.trim()}%`;
  if (!query.trim()) return [];

  const rows = await db
    .select()
    .from(seoEntities)
    .where(
      and(
        eq(seoEntities.published, true),
        or(
          ilike(seoEntities.name, pattern),
          ilike(seoEntities.description, pattern),
          ilike(seoEntities.slug, pattern)
        )
      )
    )
    .limit(limit);

  return rows.map((row) => mapSeoEntity(row as SeoEntityRow));
}

export async function upsertSeoMetrics(input: {
  path: string;
  metricDate: string;
  impressions?: number;
  clicks?: number;
  avgPosition?: number;
  cwvLcp?: number;
  cwvInp?: number;
  cwvCls?: number;
  aiReferrals?: number;
}) {
  const db = getDb();
  await db
    .insert(seoMetrics)
    .values({
      path: input.path,
      metricDate: input.metricDate,
      impressions: input.impressions,
      clicks: input.clicks,
      avgPosition: input.avgPosition?.toString(),
      cwvLcp: input.cwvLcp?.toString(),
      cwvInp: input.cwvInp?.toString(),
      cwvCls: input.cwvCls?.toString(),
      aiReferrals: input.aiReferrals ?? 0,
    })
    .onConflictDoUpdate({
      target: [seoMetrics.path, seoMetrics.metricDate],
      set: {
        impressions: input.impressions,
        clicks: input.clicks,
        avgPosition: input.avgPosition?.toString(),
        cwvLcp: input.cwvLcp?.toString(),
        cwvInp: input.cwvInp?.toString(),
        cwvCls: input.cwvCls?.toString(),
        aiReferrals: input.aiReferrals ?? 0,
      },
    });
}

export async function seoCounts() {
  const db = getDb();
  const [entityCount] = await db.select({ count: sql<number>`count(*)::int` }).from(seoEntities);
  const [contentCount] = await db.select({ count: sql<number>`count(*)::int` }).from(seoContent);
  const [publishedCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(seoContent)
    .where(eq(seoContent.status, "published"));

  return {
    entities: entityCount?.count ?? 0,
    content: contentCount?.count ?? 0,
    published: publishedCount?.count ?? 0,
  };
}
