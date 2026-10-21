import { isPostgresEnabled } from "@/db/client";
import { listSeoContent } from "@/lib/seo/queries";
import { apiError, apiOk } from "@/lib/api/responses";
import { requireAdmin } from "@/lib/api/require-admin";

export async function GET(request: Request) {
  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  const { searchParams } = new URL(request.url);
  const contentType = searchParams.get("type") ?? undefined;
  const status = searchParams.get("status") ?? "published";
  // Drafts and other unpublished content are for admins only.
  if (status !== "published") {
    const admin = await requireAdmin();
    if (!admin.ok) return admin.response;
  }
  const locale = searchParams.get("locale") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? "100");

  const items = await listSeoContent({ contentType, status, locale, limit });
  return apiOk({ count: items.length, items });
}
