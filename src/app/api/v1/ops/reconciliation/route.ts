import { requireAgent } from "@/lib/api/require-agent";
import { apiOk } from "@/lib/api/responses";
import { getReconciliationReport } from "@/lib/services";
import { getLocalDateString } from "@/lib/booking";

export async function GET(request: Request) {
  const auth = await requireAgent();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? getLocalDateString();

  return apiOk(await getReconciliationReport(date));
}
