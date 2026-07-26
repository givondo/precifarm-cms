import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { seoCompetitorSnapshots } from "@/db/schema";

export type CompetitorSnapshotInput = {
  query: string;
  competitorDomain: string;
  competitorUrl?: string;
  position: number;
  ourPosition?: number;
  ourUrl?: string;
  capturedAt: string;
  source?: string;
};

export type CompetitorThreat = {
  query: string;
  competitorDomain: string;
  competitorUrl: string | null;
  position: number;
  ourPosition: number | null;
  positionGap: number;
  capturedAt: string;
  threatLevel: "high" | "medium" | "low";
};

export async function bulkUpsertCompetitorSnapshots(rows: CompetitorSnapshotInput[]) {
  const db = getDb();
  for (const row of rows) {
    await db
      .insert(seoCompetitorSnapshots)
      .values({
        query: row.query,
        competitorDomain: row.competitorDomain,
        competitorUrl: row.competitorUrl ?? null,
        position: row.position,
        ourPosition: row.ourPosition ?? null,
        ourUrl: row.ourUrl ?? null,
        capturedAt: row.capturedAt,
        source: row.source ?? "manual",
      })
      .onConflictDoUpdate({
        target: [
          seoCompetitorSnapshots.query,
          seoCompetitorSnapshots.competitorDomain,
          seoCompetitorSnapshots.capturedAt,
        ],
        set: {
          position: row.position,
          ourPosition: row.ourPosition ?? null,
          ourUrl: row.ourUrl ?? null,
          competitorUrl: row.competitorUrl ?? null,
        },
      });
  }
}

export async function listCompetitorThreats(limit = 30): Promise<CompetitorThreat[]> {
  const db = getDb();

  const rows = await db
    .select()
    .from(seoCompetitorSnapshots)
    .orderBy(desc(seoCompetitorSnapshots.capturedAt))
    .limit(limit * 3);

  const latestByQuery = new Map<string, (typeof rows)[0]>();
  for (const row of rows) {
    const key = `${row.query}::${row.competitorDomain}`;
    if (!latestByQuery.has(key)) latestByQuery.set(key, row);
  }

  return [...latestByQuery.values()]
    .filter((row) => {
      if (row.ourPosition == null) return row.position <= 10;
      return row.position < row.ourPosition;
    })
    .map((row) => {
      const gap =
        row.ourPosition != null ? row.ourPosition - row.position : row.position;
      return {
        query: row.query,
        competitorDomain: row.competitorDomain,
        competitorUrl: row.competitorUrl,
        position: row.position,
        ourPosition: row.ourPosition,
        positionGap: gap,
        capturedAt: row.capturedAt,
        threatLevel: (gap >= 5 ? "high" : gap >= 2 ? "medium" : "low") as CompetitorThreat["threatLevel"],
      };
    })
    .sort((a, b) => b.positionGap - a.positionGap)
    .slice(0, limit);
}

export async function competitorSummary() {
  const db = getDb();
  const [total] = await db.select({ count: sql<number>`count(*)::int` }).from(seoCompetitorSnapshots);
  const threats = await listCompetitorThreats(100);
  return {
    snapshots: total?.count ?? 0,
    threats: threats.length,
    highThreats: threats.filter((t) => t.threatLevel === "high").length,
  };
}
