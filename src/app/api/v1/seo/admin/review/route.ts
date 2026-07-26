import { isPostgresEnabled } from "@/db/client";
import { requireAdmin } from "@/lib/api/require-admin";
import { apiError, apiOk } from "@/lib/api/responses";
import { listPendingReviewContent } from "@/lib/seo/gaps";

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  if (!isPostgresEnabled()) {
    return apiError("SEO_UNAVAILABLE", "SEO requires PostgreSQL.", 503);
  }

  const items = await listPendingReviewContent(50);
  return apiOk({ items });
}
