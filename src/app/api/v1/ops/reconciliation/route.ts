import { requireAgent } from "@/lib/api/require-agent";
import { apiError, apiOk } from "@/lib/api/responses";
import { getReconciliationReport } from "@/lib/services";
import { getLocalDateString } from "@/lib/booking";

export async function GET(request: Request) {
  const auth = await requireAgent();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? getLocalDateString();
  // The report matches records by date prefix, so an empty or partial date would report all time.
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    return apiError("VALIDATION_ERROR", "date must be YYYY-MM-DD.", 400);
  }

  return apiOk(await getReconciliationReport(date));
}
