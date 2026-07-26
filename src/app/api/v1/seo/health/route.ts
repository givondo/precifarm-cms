import { isPostgresEnabled } from "@/db/client";
import { seoCounts } from "@/lib/seo/queries";
import { apiError, apiOk } from "@/lib/api/responses";

export async function GET() {
  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  const counts = await seoCounts();
  return apiOk({
    status: "ok",
    phase: 2,
    counts,
    checkedAt: new Date().toISOString(),
  });
}
