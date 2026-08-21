import { requireAgent } from "@/lib/api/require-agent";
import { apiOk } from "@/lib/api/responses";
import { listInstallOrders } from "@/lib/services";

export async function GET() {
  const auth = await requireAgent();
  if (!auth.ok) return auth.response;

  return apiOk(await listInstallOrders());
}
