import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionAgent } from "@/lib/auth";
import { isPostgresEnabled } from "@/db/client";
import { listLocalPages, listPageTemplates } from "@/lib/seo/local-pages";
import { GenerateLocalPagesButton } from "./GenerateLocalPagesButton";

export default async function SeoLocalPage() {
  const agent = await getSessionAgent();
  if (!agent || agent.role !== "admin") redirect("/dashboard");

  const dbEnabled = isPostgresEnabled();
  const templates = dbEnabled ? await listPageTemplates() : [];
  const pages = dbEnabled ? await listLocalPages() : [];

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/seo" className="text-sm text-gray-500 hover:text-gray-800">
        ← SEO
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">Local SEO factory</h1>
      <p className="mt-2 text-sm text-gray-600">
        Batch-generate city/county landing pages from location entities and templates.
      </p>

      <section className="mt-8 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-gray-900">Templates</h2>
        <ul className="mt-3 space-y-2 text-sm text-gray-700">
          {templates.length === 0 && <li>No templates yet — run generate to seed default.</li>}
          {templates.map((t) => (
            <li key={t.id}>
              <span className="font-medium">{t.name}</span>
              <span className="ml-2 font-mono text-xs text-gray-500">{t.slugPattern}</span>
            </li>
          ))}
        </ul>
        {dbEnabled && (
          <div className="mt-4">
            <GenerateLocalPagesButton />
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">Local pages ({pages.length})</h2>
        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-xs uppercase text-gray-500">
              <th className="py-2 pr-4">Title</th>
              <th className="py-2 pr-4">Slug</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr key={page.id} className="border-b border-gray-100">
                <td className="py-3 pr-4 font-medium text-gray-900">{page.title}</td>
                <td className="py-3 pr-4 font-mono text-xs text-gray-600">{page.slug}</td>
                <td className="py-3 text-gray-600">{page.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
