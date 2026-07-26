import { NextResponse } from "next/server";
import { isPostgresEnabled } from "@/db/client";
import { listSeoEntities } from "@/lib/seo/queries";
import { apiError, apiOk } from "@/lib/api/responses";

export async function GET(request: Request) {
  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? undefined;

  const entities = await listSeoEntities({ type, published: true });
  return apiOk({ count: entities.length, entities });
}
