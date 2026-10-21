import { listInstallOrders } from "@/lib/services";
import { formatCurrency, formatPhoneDisplay } from "@/lib/booking";
import {
  installProductLabels,
  installStageLabels,
  summarizeInstallPipeline,
  type InstallStage,
} from "@/lib/ev-ops";
import InstallOrderEditor from "@/components/InstallOrderEditor";
import FlowStrip from "@/components/FlowStrip";
import StageSteps from "@/components/StageSteps";
import { installFlow, PRODUCT_KEY } from "@/lib/flow";
import Link from "next/link";
import { requirePageAgent } from "@/lib/auth";

function truncate(text: string | undefined, max = 72): string {
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

export default async function InstallsPage({
  searchParams,
}: {
  searchParams: Promise<{ stage?: string }>;
}) {
  await requirePageAgent();
  const { stage: stageParam } = await searchParams;
  const stageFilter =
    stageParam && stageParam in installStageLabels ? (stageParam as InstallStage) : undefined;

  const allOrders = await listInstallOrders();
  const summary = summarizeInstallPipeline(allOrders);
  const orders = stageFilter
    ? allOrders.filter((o) => o.stage === stageFilter)
    : allOrders;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Home install orders</h1>
        <p className="text-sm text-gray-500 mt-1">From survey request to commissioning. Select a stage to see its orders.</p>
      </div>

      <div className="flow-head">
        <h2>
          {stageFilter ? (
            <>
              {installStageLabels[stageFilter]}: {orders.length} order{orders.length === 1 ? "" : "s"}{" "}
              <Link href="/installs" className="text-sm font-medium text-green-700 hover:underline ml-2">
                Show all
              </Link>
            </>
          ) : (
            <>{summary.total} orders</>
          )}
        </h2>
        <span className="flow-facts">
          <span>
            <b>{summary.pipeline}</b> before a deposit
          </span>
          <span>
            <b>{summary.lipaPolePole}</b> on Lipa Pole Pole
          </span>
        </span>
      </div>
      <FlowStrip label="Install pipeline by stage" stations={installFlow(allOrders, stageFilter)} legend={PRODUCT_KEY} />

      <div className="border border-gray-200 rounded-lg overflow-x-auto bg-white">
        <table className="data-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Product</th>
              <th>Customer</th>
              <th>City</th>
              <th>Pipeline</th>
              <th>Notes</th>
              <th>Lipa Pole Pole</th>
              <th>Channel</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center text-gray-400 py-8">
                  No install orders{stageFilter ? " at this stage" : ""}.
                </td>
              </tr>
            ) : (
              orders.map((order) => (
                <tr key={order.id}>
                  <td className="font-mono text-xs font-medium whitespace-nowrap">
                    {order.reference}
                    <div className="mt-1.5 font-sans">
                      <StageSteps stage={order.stage} showLabel={false} />
                    </div>
                    {(order.quoteAmount ?? order.depositAmount) ? (
                      <div className="text-[10px] text-gray-400 font-sans mt-0.5">
                        {order.quoteAmount ? formatCurrency(order.quoteAmount) : null}
                        {order.quoteAmount && order.depositAmount ? " · " : null}
                        {order.depositAmount ? `dep ${formatCurrency(order.depositAmount)}` : null}
                      </div>
                    ) : null}
                  </td>
                  <td className="text-sm whitespace-nowrap">
                    {installProductLabels[order.product]}
                  </td>
                  <td>
                    <div className="font-medium">{order.contactName}</div>
                    <div className="text-xs text-gray-500">
                      {order.contactEmail}
                      {order.contactPhone ? ` · ${formatPhoneDisplay(order.contactPhone)}` : null}
                    </div>
                  </td>
                  <td className="text-sm whitespace-nowrap">{order.city}</td>
                  <td>
                    <InstallOrderEditor
                      reference={order.reference}
                      stage={order.stage}
                      quoteAmount={order.quoteAmount}
                      depositAmount={order.depositAmount}
                    />
                  </td>
                  <td className="text-xs text-gray-600 max-w-[14rem]" title={order.notes}>
                    {truncate(order.notes)}
                  </td>
                  <td className="text-sm">{order.lipaPolePole ? "Yes" : "No"}</td>
                  <td className="text-xs text-gray-500 whitespace-nowrap">{order.channel}</td>
                  <td className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(order.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
