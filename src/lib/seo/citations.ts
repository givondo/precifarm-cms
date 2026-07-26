import { desc, gte, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { analyticsEvents, seoAiCitations, seoMetrics } from "@/db/schema";
import { bulkUpsertMetrics } from "@/lib/seo/analytics";

const AI_REFERRER_EVENT = "website_referrer_captured";

export type CitationInput = {
  path: string;
  referrerSource: string;
  citationDate: string;
  sessions?: number;
};

/** Known AI referrer host → canonical source label */
export function normalizeAiReferrerSource(referrer: string): string | null {
  const lower = referrer.toLowerCase();
  if (!lower) return null;
  if (lower.includes("chatgpt.com") || lower.includes("chat.openai.com")) return "chatgpt";
  if (lower.includes("perplexity.ai")) return "perplexity";
  if (lower.includes("claude.ai") || lower.includes("anthropic.com")) return "claude";
  if (lower.includes("gemini.google.com") || lower.includes("bard.google.com")) return "gemini";
  if (lower.includes("copilot.microsoft.com") || lower.includes("bing.com/chat")) return "copilot";
  if (lower.includes("you.com")) return "youcom";
  if (lower.includes("phind.com")) return "phind";
  if (lower.includes("poe.com")) return "poe";
  return null;
}

export async function bulkUpsertAiCitations(rows: CitationInput[]) {
  const db = getDb();
  for (const row of rows) {
    await db
      .insert(seoAiCitations)
      .values({
        path: row.path,
        referrerSource: row.referrerSource,
        citationDate: row.citationDate,
        sessions: row.sessions ?? 1,
      })
      .onConflictDoUpdate({
        target: [seoAiCitations.path, seoAiCitations.referrerSource, seoAiCitations.citationDate],
        set: { sessions: row.sessions ?? 1 },
      });
  }
}

/** Aggregate AI referrer events from analytics_events into seo_ai_citations + seo_metrics. */
export async function ingestAiReferralsFromAnalytics(days = 7) {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await db
    .select({
      pageUrl: analyticsEvents.pageUrl,
      props: analyticsEvents.eventProperties,
      eventTimestamp: analyticsEvents.eventTimestamp,
    })
    .from(analyticsEvents)
    .where(
      sql`${analyticsEvents.eventName} = ${AI_REFERRER_EVENT} AND ${analyticsEvents.eventTimestamp} >= ${since}`
    );

  const aggregated = new Map<string, number>();

  for (const row of rows) {
    const props = row.props as Record<string, unknown>;
    const source = String(props.ai_source ?? props.source ?? "unknown");
    const path = normalizePath(row.pageUrl);
    const date = row.eventTimestamp.toISOString().slice(0, 10);
    const key = `${path}::${source}::${date}`;
    aggregated.set(key, (aggregated.get(key) ?? 0) + 1);
  }

  const citations: CitationInput[] = [];
  const metricsByPathDate = new Map<string, number>();

  for (const [key, sessions] of aggregated) {
    const [path, source, date] = key.split("::");
    citations.push({ path, referrerSource: source, citationDate: date, sessions });
    const mKey = `${path}::${date}`;
    metricsByPathDate.set(mKey, (metricsByPathDate.get(mKey) ?? 0) + sessions);
  }

  if (citations.length) await bulkUpsertAiCitations(citations);

  const metrics = [...metricsByPathDate.entries()].map(([key, aiReferrals]) => {
    const [path, metricDate] = key.split("::");
    return { path, metricDate, aiReferrals };
  });

  if (metrics.length) await bulkUpsertMetrics(metrics);

  return { citations: citations.length, metrics: metrics.length, eventRows: rows.length };
}

function normalizePath(pageUrl: string | null): string {
  if (!pageUrl) return "/";
  try {
    if (pageUrl.startsWith("http")) {
      return new URL(pageUrl).pathname || "/";
    }
    return pageUrl.split("?")[0] || "/";
  } catch {
    return "/";
  }
}

export async function getTopAiCitations(limit = 20) {
  const db = getDb();
  const rows = await db
    .select()
    .from(seoAiCitations)
    .orderBy(desc(seoAiCitations.sessions))
    .limit(limit);

  return rows.map((row) => ({
    path: row.path,
    referrerSource: row.referrerSource,
    citationDate: row.citationDate,
    sessions: row.sessions,
  }));
}

export async function aiCitationSummary(days = 7) {
  const db = getDb();
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const rows = await db
    .select()
    .from(seoAiCitations)
    .where(gte(seoAiCitations.citationDate, sinceStr));

  const totals = rows.reduce(
    (acc, row) => {
      acc.sessions += row.sessions;
      acc.bySource[row.referrerSource] = (acc.bySource[row.referrerSource] ?? 0) + row.sessions;
      return acc;
    },
    { sessions: 0, bySource: {} as Record<string, number> }
  );

  const [metricsTotal] = await db
    .select({ total: sql<number>`coalesce(sum(${seoMetrics.aiReferrals}), 0)::int` })
    .from(seoMetrics)
    .where(gte(seoMetrics.metricDate, sinceStr));

  return {
    days,
    sessions: totals.sessions,
    bySource: totals.bySource,
    metricsAiReferrals: metricsTotal?.total ?? 0,
  };
}
