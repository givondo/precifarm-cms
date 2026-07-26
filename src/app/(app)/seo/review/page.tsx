import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionAgent } from "@/lib/auth";
import { isPostgresEnabled } from "@/db/client";
import { listPendingReviewContent } from "@/lib/seo/gaps";
import { ReviewActions } from "./ReviewActions";

export default async function SeoReviewPage() {
  const agent = await getSessionAgent();
  if (!agent || agent.role !== "admin") redirect("/dashboard");

  const dbEnabled = isPostgresEnabled();
  const items = dbEnabled ? await listPendingReviewContent(50) : [];

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/seo" className="text-sm text-gray-500 hover:text-gray-800">
        ← SEO
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">Review queue</h1>
      <p className="mt-2 text-sm text-gray-600">
        AI-generated and template drafts awaiting human approval before publish.
      </p>

      <ul className="mt-8 divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
        {items.length === 0 && (
          <li className="px-4 py-6 text-sm text-gray-500">No items pending review.</li>
        )}
        {items.map((item) => (
          <li key={item.id} className="px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-medium text-gray-900">{item.title}</p>
                <p className="mt-1 font-mono text-xs text-gray-500">{item.slug}</p>
                <p className="mt-2 text-sm text-gray-600 line-clamp-2">{item.description}</p>
                <div className="mt-2 flex gap-2 text-xs text-gray-500">
                  <span>{item.contentType}</span>
                  {item.aiGenerated && (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-800">AI</span>
                  )}
                  {(item.generationMetadata as Record<string, unknown> | null)?.staleRefresh === true && (
                    <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-amber-800">Stale refresh</span>
                  )}
                </div>
              </div>
              <ReviewActions slug={item.slug} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
