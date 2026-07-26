import { isPostgresEnabled } from "@/db/client";
import { listSeoContent } from "@/lib/seo/queries";
import { apiError, apiOk } from "@/lib/api/responses";

export async function GET(request: Request) {
  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  const { searchParams } = new URL(request.url);
  const contentType = searchParams.get("type") ?? undefined;
  const status = searchParams.get("status") ?? "published";
  const locale = searchParams.get("locale") ?? undefined;
  const limit = Number(searchParams.get("limit") ?? "100");

  const items = await listSeoContent({ contentType, status, locale, limit });
  return apiOk({ count: items.length, items });
}
