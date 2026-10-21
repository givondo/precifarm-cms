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
  // A stage or amount that is sent but not valid is refused, never silently dropped while the rest
  // of the change is saved.
  let stage: InstallStage | undefined;
  if (raw.stage !== undefined && raw.stage !== null) {
    const stageRaw = typeof raw.stage === "string" ? raw.stage.trim() : "";
    if (!STAGES.includes(stageRaw as InstallStage)) {
      return apiError("VALIDATION_ERROR", "Unknown stage.", 400);
    }
    stage = stageRaw as InstallStage;
  }

  const amount = (value: unknown): number | undefined | null => {
    if (value === undefined || value === null) return undefined;
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
  };
  const quoteAmount = amount(raw.quoteAmount);
  const depositAmount = amount(raw.depositAmount);
  if (quoteAmount === null || depositAmount === null) {
    return apiError("VALIDATION_ERROR", "Amounts must be numbers of zero or more.", 400);
  }

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
