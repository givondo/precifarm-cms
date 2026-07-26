import { isPostgresEnabled } from "@/db/client";
import { getSeoContentBySlug } from "@/lib/seo/queries";
import { apiError, apiOk } from "@/lib/api/responses";

type Params = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Params) {
  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  const { slug } = await params;
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get("locale") ?? "en-KE";
  const content = await getSeoContentBySlug(slug, true, locale);
  if (!content) {
    return apiError("NOT_FOUND", "Content not found.", 404);
  }

  return apiOk({ content });
}
