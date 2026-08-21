import Link from "next/link";
import type { InstallStage } from "@/lib/ev-ops";
import { installStageLabels, summarizeInstallPipeline } from "@/lib/ev-ops";

type Props = {
  summary: ReturnType<typeof summarizeInstallPipeline>;
  activeStage?: InstallStage;
};

export default function InstallPipelineBar({ summary, activeStage }: Props) {
  const stages = Object.keys(installStageLabels) as InstallStage[];

  return (
    <div className="mb-6 space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="stat-card">
          <div className="label">Total orders</div>
          <div className="value">{summary.total}</div>
        </div>
        <div className="stat-card">
          <div className="label">Survey pipeline</div>
          <div className="value">{summary.pipeline}</div>
        </div>
        <div className="stat-card">
          <div className="label">Commissioned</div>
          <div className="value">{summary.byStage.commissioned}</div>
        </div>
        <div className="stat-card">
          <div className="label">Lipa Pole Pole</div>
          <div className="value">{summary.lipaPolePole}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href="/installs"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            !activeStage
              ? "bg-green-800 text-white border-green-800"
              : "bg-white text-gray-600 border-gray-200 hover:border-green-300"
          }`}
        >
          All ({summary.total})
        </Link>
        {stages.map((stage) => (
          <Link
            key={stage}
            href={activeStage === stage ? "/installs" : `/installs?stage=${stage}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              activeStage === stage
                ? "bg-green-800 text-white border-green-800"
                : "bg-white text-gray-600 border-gray-200 hover:border-green-300"
            }`}
          >
            {installStageLabels[stage]} ({summary.byStage[stage]})
          </Link>
        ))}
      </div>
    </div>
  );
}
