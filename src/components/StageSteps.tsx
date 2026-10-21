import type { InstallStage } from "@/lib/ev-ops";
import { installStageLabels } from "@/lib/ev-ops";
import { INSTALL_STAGES, stageIndex } from "@/lib/flow";

/** Where an order sits in the install pipeline: one segment per stage, filled up to the current one. */
export default function StageSteps({ stage, showLabel = true }: { stage: InstallStage; showLabel?: boolean }) {
  const at = stageIndex(stage);
  return (
    <span className="steps" title={`${installStageLabels[stage]} (${at + 1} of ${INSTALL_STAGES.length})`}>
      <span className="steps-bar" aria-hidden="true">
        {INSTALL_STAGES.map((s, i) => (
          <i key={s} className={i < at ? "done" : i === at ? (stage === "commissioned" ? "done" : "now") : ""} />
        ))}
      </span>
      {showLabel ? <span className="steps-label">{installStageLabels[stage]}</span> : <span className="sr-only">{installStageLabels[stage]}</span>}
    </span>
  );
}
