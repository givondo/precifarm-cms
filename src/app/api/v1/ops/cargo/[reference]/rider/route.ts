import { requireAgent } from "@/lib/api/require-agent";
import { apiOk, apiError } from "@/lib/api/responses";
import { assignRiderToCargo } from "@/lib/cargo-delivery";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  const auth = await requireAgent();
  if (!auth.ok) return auth.response;

  const { reference } = await params;
  let body: { riderId?: string; dispatch?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    return apiError("VALIDATION_ERROR", "Request body is required.", 400);
  }

  if (!body.riderId) {
    return apiError("VALIDATION_ERROR", "riderId is required.", 400);
  }

  const result = assignRiderToCargo(reference, body.riderId, auth.agent.id, {
    dispatch: body.dispatch,
  });

  if ("error" in result && result.error) {
    return apiError("RIDER_ASSIGN_ERROR", result.error, result.status);
  }

  return apiOk(result.data);
}
