import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionAgent } from "@/lib/auth";
import { isPostgresEnabled } from "@/db/client";
import { aiCitationSummary, getTopAiCitations } from "@/lib/seo/citations";
import { findStaleContent, staleContentSummary } from "@/lib/seo/stale";
import { StaleRefreshButton } from "./StaleRefreshButton";

export default async function SeoAutomationPage() {
  const agent = await getSessionAgent();
  if (!agent || agent.role !== "admin") redirect("/dashboard");

  const dbEnabled = isPostgresEnabled();
  const citations = dbEnabled ? await aiCitationSummary(7) : { sessions: 0, bySource: {}, metricsAiReferrals: 0, days: 7 };
  const topCitations = dbEnabled ? await getTopAiCitations(10) : [];
  const staleSummary = dbEnabled ? await staleContentSummary() : { staleCount: 0, oldestDays: 0 };
  const staleItems = dbEnabled ? await findStaleContent() : [];

  return (
    <div className="p-8 max-w-6xl">
      <Link href="/seo" className="text-sm text-gray-500 hover:text-gray-800">
        ← SEO
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">Autonomous optimization</h1>
      <p className="mt-2 text-sm text-gray-600">AI citation tracking and stale content refresh (Phase 4).</p>

      <section className="mt-8 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">AI citations (7d)</h2>
        <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
          <div>
            <dt className="text-xs uppercase text-gray-500">Sessions</dt>
            <dd className="text-xl font-bold text-gray-900">{citations.sessions}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-500">Metrics rollup</dt>
            <dd className="text-xl font-bold text-gray-900">{citations.metricsAiReferrals}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase text-gray-500">Sources</dt>
            <dd className="text-sm text-gray-700">
              {Object.entries(citations.bySource)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ") || "—"}
            </dd>
          </div>
        </dl>
        <ul className="mt-4 space-y-1 text-sm text-gray-600">
          {topCitations.map((c) => (
            <li key={`${c.path}-${c.referrerSource}`}>
              {c.path} ← {c.referrerSource} ({c.sessions})
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-gray-500">
          Cron: <code className="font-mono">npm run seo:ingest-citations</code>
        </p>
      </section>

      <section className="mt-8 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">Stale content</h2>
        <p className="mt-1 text-sm text-gray-600">
          {staleSummary.staleCount} published page(s) need refresh (90+ days or never reviewed).
        </p>
        {dbEnabled && (
          <div className="mt-4">
            <StaleRefreshButton />
          </div>
        )}
        <ul className="mt-4 divide-y divide-gray-100 text-sm">
          {staleItems.slice(0, 8).map((item) => (
            <li key={item.slug} className="flex justify-between py-2">
              <span className="font-medium text-gray-900">{item.title}</span>
              <span className="text-xs text-gray-500">{item.reason}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-8 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">Agent API</h2>
        <ul className="mt-3 space-y-1 font-mono text-xs text-gray-600">
          <li>GET /api/v1/seo/agent — MCP tool manifest</li>
          <li>POST /api/v1/seo/agent — RPC: search_content, get_content, list_entities</li>
        </ul>
      </section>
    </div>
  );
}
