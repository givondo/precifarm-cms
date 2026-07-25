import { requireAgent } from "@/lib/api/require-agent";
import { apiOk, apiError } from "@/lib/api/responses";
import { refundBooking } from "@/lib/services";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  const auth = await requireAgent();
  if (!auth.ok) return auth.response;

  const { reference } = await params;
  const result = await refundBooking(reference, auth.agent.id);

  if ("error" in result && result.error) {
    return apiError("REFUND_ERROR", result.error, result.status);
  }

  return apiOk(result.data);
}
