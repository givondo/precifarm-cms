import { getDb, isPostgresEnabled } from "@/db/client";
import { seoEntities } from "@/db/schema";
import { requireAdmin } from "@/lib/api/require-admin";
import { apiError, apiOk } from "@/lib/api/responses";
import { mapSeoEntity, type SeoEntityRow } from "@/lib/seo/types";
import { validateEntityInput } from "@/lib/seo/validate";

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body.", 400);
  }

  const validated = validateEntityInput(body);
  if (!validated.ok) {
    return apiError("VALIDATION_ERROR", validated.error, 400);
  }

  const db = getDb();
  const { input } = validated;

  const [row] = await db
    .insert(seoEntities)
    .values({
      slug: input.slug,
      name: input.name,
      type: input.type,
      description: input.description,
      url: input.url,
      aliases: input.aliases,
      metadata: input.metadata,
      published: input.published,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: seoEntities.slug,
      set: {
        name: input.name,
        type: input.type,
        description: input.description,
        url: input.url,
        aliases: input.aliases,
        metadata: input.metadata,
        published: input.published,
        updatedAt: new Date(),
      },
    })
    .returning();

  return apiOk({ entity: mapSeoEntity(row as unknown as SeoEntityRow) }, 201);
}
