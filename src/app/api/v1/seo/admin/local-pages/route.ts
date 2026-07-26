import { isPostgresEnabled } from "@/db/client";
import { requireAdmin } from "@/lib/api/require-admin";
import { apiError, apiOk } from "@/lib/api/responses";
import { generateLocalPagesFromTemplate, listPageTemplates, upsertDefaultLocalTemplate } from "@/lib/seo/local-pages";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  const templates = await listPageTemplates();
  return apiOk({ templates });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  let body: unknown = {};
  try {
    if (request.headers.get("content-length")) {
      body = await request.json();
    }
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body.", 400);
  }

  const templateSlug = String((body as Record<string, unknown>).templateSlug ?? "ev-charging-city");

  await upsertDefaultLocalTemplate();
  const result = await generateLocalPagesFromTemplate(templateSlug);

  return apiOk(result, 201);
}
