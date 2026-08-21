import { requireAgent } from "@/lib/api/require-agent";
import { apiError, apiOk } from "@/lib/api/responses";
import type { InstallStage } from "@/lib/ev-ops";
import { installStageLabels } from "@/lib/ev-ops";
import { updateInstallStage } from "@/lib/services";

const STAGES = Object.keys(installStageLabels) as InstallStage[];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const auth = await requireAgent();
  if (!auth.ok) return auth.response;

  const { reference } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body.", 400);
  }

  if (!body || typeof body !== "object") {
    return apiError("VALIDATION_ERROR", "Request body is required.", 400);
  }

  const raw = body as Record<string, unknown>;
  const stageRaw = typeof raw.stage === "string" ? raw.stage.trim() : "";
  const stage = stageRaw && STAGES.includes(stageRaw as InstallStage) ? (stageRaw as InstallStage) : undefined;

  const quoteAmount =
    typeof raw.quoteAmount === "number" && raw.quoteAmount >= 0 ? raw.quoteAmount : undefined;
  const depositAmount =
    typeof raw.depositAmount === "number" && raw.depositAmount >= 0
      ? raw.depositAmount
      : undefined;

  if (!stage && quoteAmount === undefined && depositAmount === undefined) {
    return apiError("VALIDATION_ERROR", "Provide a stage and/or quote or deposit amount.", 400);
  }

  const result = await updateInstallStage(reference, stage, auth.agent.id, {
    quoteAmount,
    depositAmount,
  });

  if ("error" in result && result.error) {
    return apiError("NOT_FOUND", result.error, result.status);
  }

  return apiOk(result.data);
}
