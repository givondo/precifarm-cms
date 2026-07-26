import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionAgent } from "@/lib/auth";
import { isPostgresEnabled } from "@/db/client";
import { analyzeContentGaps } from "@/lib/seo/gaps";
import { GapDraftButton } from "./GapDraftButton";

export default async function SeoGapsPage() {
  const agent = await getSessionAgent();
  if (!agent || agent.role !== "admin") redirect("/dashboard");

  const dbEnabled = isPostgresEnabled();
  const gaps = dbEnabled ? await analyzeContentGaps(50) : [];
  const uncovered = gaps.filter((g) => g.gapStatus === "uncovered");
  const partial = gaps.filter((g) => g.gapStatus === "partial");

  return (
    <div className="p-8 max-w-6xl">
      <Link href="/seo" className="text-sm text-gray-500 hover:text-gray-800">
        ← SEO
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">Content gap analysis</h1>
      <p className="mt-2 text-sm text-gray-600">
        GSC queries scored against published content and knowledge graph entities.
      </p>

      {!dbEnabled && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          PostgreSQL required. Ingest search queries via POST /api/v1/seo/metrics.
        </p>
      )}

      <dl className="mt-8 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <dt className="text-xs font-semibold uppercase text-red-600">Uncovered</dt>
          <dd className="mt-1 text-2xl font-bold text-gray-900">{uncovered.length}</dd>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <dt className="text-xs font-semibold uppercase text-amber-600">Partial</dt>
          <dd className="mt-1 text-2xl font-bold text-gray-900">{partial.length}</dd>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <dt className="text-xs font-semibold uppercase text-green-600">Covered</dt>
          <dd className="mt-1 text-2xl font-bold text-gray-900">
            {gaps.filter((g) => g.gapStatus === "covered").length}
          </dd>
        </div>
      </dl>

      <table className="mt-8 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
            <th className="py-2 pr-4">Query</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Impressions</th>
            <th className="py-2 pr-4">CTR</th>
            <th className="py-2 pr-4">Match</th>
            <th className="py-2">Action</th>
          </tr>
        </thead>
        <tbody>
          {gaps.map((gap) => (
            <tr key={gap.query} className="border-b border-gray-100 align-top">
              <td className="py-3 pr-4">
                <p className="font-medium text-gray-900">{gap.query}</p>
                <p className="mt-1 text-xs text-gray-500">{gap.suggestedAction}</p>
              </td>
              <td className="py-3 pr-4">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    gap.gapStatus === "uncovered"
                      ? "bg-red-100 text-red-800"
                      : gap.gapStatus === "partial"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-green-100 text-green-800"
                  }`}
                >
                  {gap.gapStatus}
                </span>
                <p className="mt-1 text-xs text-gray-400">{gap.intent}</p>
              </td>
              <td className="py-3 pr-4 text-gray-700">{gap.impressions}</td>
              <td className="py-3 pr-4 text-gray-700">{gap.ctr}%</td>
              <td className="py-3 pr-4 text-xs text-gray-600">
                {gap.matchedContentTitle ?? gap.matchedEntitySlug ?? "—"}
              </td>
              <td className="py-3">
                {gap.gapStatus !== "covered" && <GapDraftButton query={gap.query} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {gaps.length === 0 && dbEnabled && (
        <p className="mt-6 text-sm text-gray-500">
          No search query data yet. Ingest GSC snapshots via the metrics API.
        </p>
      )}
    </div>
  );
}
