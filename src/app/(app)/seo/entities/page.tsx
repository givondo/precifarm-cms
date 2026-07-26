import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionAgent } from "@/lib/auth";
import { isPostgresEnabled } from "@/db/client";
import { listSeoEntities } from "@/lib/seo/queries";

export default async function SeoEntitiesPage() {
  const agent = await getSessionAgent();
  if (!agent || agent.role !== "admin") redirect("/dashboard");

  const entities = isPostgresEnabled() ? await listSeoEntities() : [];

  return (
    <div className="p-8 max-w-5xl">
      <Link href="/seo" className="text-sm text-gray-500 hover:text-gray-800">
        ← SEO
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-gray-900">Knowledge graph entities</h1>
      <p className="mt-2 text-sm text-gray-600">
        Equipment, routes, services and locations linked for SEO and AI search.
      </p>

      <ul className="mt-8 divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
        {entities.map((entity) => (
          <li key={entity.id} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-900">{entity.name}</span>
              <span className="text-xs uppercase text-gray-500">{entity.type}</span>
            </div>
            <p className="mt-1 text-sm text-gray-600">{entity.description}</p>
            <p className="mt-1 font-mono text-xs text-gray-400">{entity.slug}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
