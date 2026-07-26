import Link from "next/link";
import { getSessionAgent } from "@/lib/auth";
import { redirect } from "next/navigation";
import { isPostgresEnabled } from "@/db/client";
import { buildWeeklySeoReport, embeddingStats } from "@/lib/seo/analytics";
import { isEmbeddingConfigured } from "@/lib/seo/embeddings";
import { listSeoContent, listSeoEntities, seoCounts } from "@/lib/seo/queries";
import { SeoEmbeddingActions } from "./SeoEmbeddingActions";

export default async function SeoDashboardPage() {
  const agent = await getSessionAgent();
  if (!agent || agent.role !== "admin") redirect("/dashboard");

  const dbEnabled = isPostgresEnabled();
  const counts = dbEnabled ? await seoCounts() : { entities: 0, content: 0, published: 0 };
  const recent = dbEnabled ? await listSeoContent({ limit: 5 }) : [];
  const entities = dbEnabled ? await listSeoEntities() : [];
  const embeddings = dbEnabled ? await embeddingStats() : { published: 0, embedded: 0 };
  const report = dbEnabled ? await buildWeeklySeoReport() : null;
  const embeddingConfigured = isEmbeddingConfigured();

  return (
    <div className="p-8 max-w-5xl">
      <h1 className="text-2xl font-bold text-gray-900">SEO / AISO</h1>
      <p className="mt-2 text-sm text-gray-600">
        Phase 2 — CMS-backed knowledge graph, guides, FAQs and search indexing.
      </p>

      {!dbEnabled && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          PostgreSQL required. Run <code className="font-mono">npm run db:push</code> then{" "}
          <code className="font-mono">npm run db:seed-seo</code>.
        </p>
      )}

      <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <dt className="text-xs font-semibold uppercase text-gray-500">Entities</dt>
          <dd className="mt-1 text-2xl font-bold text-gray-900">{counts.entities}</dd>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <dt className="text-xs font-semibold uppercase text-gray-500">Content</dt>
          <dd className="mt-1 text-2xl font-bold text-gray-900">{counts.content}</dd>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <dt className="text-xs font-semibold uppercase text-gray-500">Published</dt>
          <dd className="mt-1 text-2xl font-bold text-gray-900">{counts.published}</dd>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <dt className="text-xs font-semibold uppercase text-gray-500">Embedded</dt>
          <dd className="mt-1 text-2xl font-bold text-gray-900">
            {embeddings.embedded}
            <span className="text-sm font-normal text-gray-500"> / {embeddings.published}</span>
          </dd>
        </div>
      </dl>

      {dbEnabled && (
        <section className="mt-8 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">Semantic search</h2>
          <p className="mt-1 text-sm text-gray-600">
            OpenAI embeddings power <code className="font-mono text-xs">?mode=semantic</code> on the
            search API.
          </p>
          <SeoEmbeddingActions configured={embeddingConfigured} />
        </section>
      )}

      {report && (
        <section className="mt-8 rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">Weekly report ({report.period})</h2>
          <p className="mt-1 text-xs text-gray-500">
            Generated {new Date(report.generatedAt).toLocaleString()}
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-xs uppercase text-gray-500">Impressions</dt>
              <dd className="font-semibold text-gray-900">{report.metrics.totals.impressions}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">Clicks</dt>
              <dd className="font-semibold text-gray-900">{report.metrics.totals.clicks}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-gray-500">CTR</dt>
              <dd className="font-semibold text-gray-900">{report.metrics.ctr.toFixed(2)}%</dd>
            </div>
          </dl>
          {report.recommendations.length > 0 && (
            <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-gray-700">
              {report.recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
          {report.topQueries.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold text-gray-900">Top search queries</h3>
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                {report.topQueries.slice(0, 5).map((q) => (
                  <li key={`${q.query}-${q.metricDate}`}>
                    {q.query}{" "}
                    <span className="text-xs text-gray-400">
                      ({q.impressions} imp, {q.clicks} clicks)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/seo/content"
          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
        >
          Manage content
        </Link>
        <Link
          href="/seo/gaps"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
        >
          Content gaps
        </Link>
        <Link
          href="/seo/review"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
        >
          Review queue
        </Link>
        <Link
          href="/seo/local"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
        >
          Local pages
        </Link>
        <Link
          href="/seo/automation"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
        >
          Automation
        </Link>
        <Link
          href="/seo/competitors"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
        >
          Competitors
        </Link>
        <Link
          href="/seo/entities"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
        >
          View entities
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900">Recent content</h2>
        <ul className="mt-4 divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
          {recent.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">No content yet.</li>
          )}
          {recent.map((item) => (
            <li key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <div>
                <span className="font-medium text-gray-900">{item.title}</span>
                <span className="ml-2 text-xs text-gray-500">{item.contentType}</span>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  item.status === "published"
                    ? "bg-green-100 text-green-800"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {item.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold text-gray-900">Public API</h2>
        <ul className="mt-3 space-y-1 font-mono text-xs text-gray-600">
          <li>GET /api/v1/seo/content?status=published</li>
          <li>GET /api/v1/seo/content/[slug]</li>
          <li>GET /api/v1/seo/entities</li>
          <li>GET /api/v1/seo/search?q=...&amp;mode=semantic</li>
          <li>GET /api/v1/seo/report</li>
          <li>POST /api/v1/seo/metrics (X-SEO-Cron-Key)</li>
          <li>POST /api/v1/seo/embeddings</li>
        </ul>
      </section>

      <p className="mt-6 text-xs text-gray-500">
        {entities.length} entities in knowledge graph
      </p>
    </div>
  );
}
