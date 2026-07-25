import { requireAdmin } from "@/lib/api/require-admin";
import { apiOk } from "@/lib/api/responses";
import { getAnalyticsDashboard } from "@/lib/analytics/dashboard";

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const days = Math.min(90, Math.max(7, Number(url.searchParams.get("days") ?? 30) || 30));

  const data = await getAnalyticsDashboard(days);
  return apiOk(data);
}
