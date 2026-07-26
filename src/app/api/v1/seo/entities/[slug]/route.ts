import { isPostgresEnabled } from "@/db/client";
import { getRelatedSeoEntities, getSeoEntityBySlug } from "@/lib/seo/queries";
import { apiError, apiOk } from "@/lib/api/responses";

type Params = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: Params) {
  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  const { slug } = await params;
  const entity = await getSeoEntityBySlug(slug);
  if (!entity) {
    return apiError("NOT_FOUND", "Entity not found.", 404);
  }

  const related = await getRelatedSeoEntities(entity.id);
  return apiOk({ entity, related });
}
