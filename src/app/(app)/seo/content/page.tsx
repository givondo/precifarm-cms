import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionAgent } from "@/lib/auth";
import { isPostgresEnabled } from "@/db/client";
import { listSeoContent } from "@/lib/seo/queries";

export default async function SeoContentPage() {
  const agent = await getSessionAgent();
  if (!agent || agent.role !== "admin") redirect("/dashboard");

  const items = isPostgresEnabled() ? await listSeoContent({ limit: 100 }) : [];

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/seo" className="text-sm text-gray-500 hover:text-gray-800">
            ← SEO
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">Content</h1>
        </div>
      </div>

      <p className="mt-2 text-sm text-gray-600">
        Guides and FAQs published to precifarm.com/guides and /faq via ISR.
      </p>

      <table className="mt-8 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
            <th className="py-2 pr-4">Title</th>
            <th className="py-2 pr-4">Slug</th>
            <th className="py-2 pr-4">Type</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2">Review</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-gray-100">
              <td className="py-3 pr-4 font-medium text-gray-900">{item.title}</td>
              <td className="py-3 pr-4 font-mono text-xs text-gray-600">{item.slug}</td>
              <td className="py-3 pr-4 text-gray-600">{item.contentType}</td>
              <td className="py-3 pr-4 text-gray-600">{item.status}</td>
              <td className="py-3 text-xs text-gray-500">
                {item.reviewStatus ?? "—"}
                {item.aiGenerated && (
                  <span className="ml-1 rounded bg-blue-100 px-1 text-blue-800">AI</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {items.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">
          Run <code className="font-mono">npm run db:seed-seo</code> to load sample guides and FAQs.
        </p>
      )}
    </div>
  );
}
