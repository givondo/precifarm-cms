import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionAgent } from "@/lib/auth";
import { isPostgresEnabled } from "@/db/client";
import { competitorSummary, listCompetitorThreats } from "@/lib/seo/competitors";

export default async function SeoCompetitorsPage() {
  const agent = await getSessionAgent();
  if (!agent || agent.role !== "admin") redirect("/dashboard");

  const dbEnabled = isPostgresEnabled();
  const summary = dbEnabled ? await competitorSummary() : { snapshots: 0, threats: 0, highThreats: 0 };
  const threats = dbEnabled ? await listCompetitorThreats(30) : [];

  return (
    <div className="p-8 max-w-6xl">
      <Link href="/seo" className="text-sm text-gray-500 hover:text-gray-800">
        ← SEO
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">Competitor monitoring</h1>
      <p className="mt-2 text-sm text-gray-600">
        SERP snapshots where competitors outrank Precifarm. Ingest via{" "}
        <code className="font-mono text-xs">npm run seo:competitors</code>.
      </p>

      <dl className="mt-8 grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <dt className="text-xs font-semibold uppercase text-gray-500">Snapshots</dt>
          <dd className="mt-1 text-2xl font-bold text-gray-900">{summary.snapshots}</dd>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <dt className="text-xs font-semibold uppercase text-gray-500">Threats</dt>
          <dd className="mt-1 text-2xl font-bold text-gray-900">{summary.threats}</dd>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <dt className="text-xs font-semibold uppercase text-red-600">High</dt>
          <dd className="mt-1 text-2xl font-bold text-gray-900">{summary.highThreats}</dd>
        </div>
      </dl>

      <table className="mt-8 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
            <th className="py-2 pr-4">Query</th>
            <th className="py-2 pr-4">Competitor</th>
            <th className="py-2 pr-4">Their rank</th>
            <th className="py-2 pr-4">Our rank</th>
            <th className="py-2">Threat</th>
          </tr>
        </thead>
        <tbody>
          {threats.map((t) => (
            <tr key={`${t.query}-${t.competitorDomain}`} className="border-b border-gray-100">
              <td className="py-3 pr-4 font-medium text-gray-900">{t.query}</td>
              <td className="py-3 pr-4 text-gray-600">{t.competitorDomain}</td>
              <td className="py-3 pr-4">{t.position}</td>
              <td className="py-3 pr-4">{t.ourPosition ?? "—"}</td>
              <td className="py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    t.threatLevel === "high"
                      ? "bg-red-100 text-red-800"
                      : t.threatLevel === "medium"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {t.threatLevel}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
