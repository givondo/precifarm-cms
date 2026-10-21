import { listInstallOrders } from "@/lib/services";
import { formatCurrency, formatPhoneDisplay } from "@/lib/booking";
import {
  installProductLabels,
  installStageLabels,
  summarizeInstallPipeline,
  type InstallStage,
} from "@/lib/ev-ops";
import InstallOrderEditor from "@/components/InstallOrderEditor";
import InstallPipelineBar from "@/components/InstallPipelineBar";
import { requirePageAgent } from "@/lib/auth";

function truncate(text: string | undefined, max = 72): string {
  if (!text) return "—";
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
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-900">Home install orders</h1>
        <p className="text-sm text-gray-500 mt-1">
          Pulse, Pod and Spark — survey intake through commissioning and Lipa Pole Pole
        </p>
      </div>

      <InstallPipelineBar summary={summary} activeStage={stageFilter} />

      {stageFilter ? (
        <p className="text-sm text-gray-500 mb-4">
          Showing {orders.length} order{orders.length === 1 ? "" : "s"} at stage{" "}
          <span className="font-medium text-gray-700">{installStageLabels[stageFilter]}</span>
        </p>
      ) : null}

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
