import { requireAgent } from "@/lib/api/require-agent";
import { apiOk } from "@/lib/api/responses";
import { listCargoDeliveries } from "@/lib/cargo-delivery";

export async function GET(request: Request) {
  const auth = await requireAgent();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const search = searchParams.get("q") ?? undefined;

  const data = listCargoDeliveries({
    status: status === "active" || status === "completed" ? status : undefined,
    search,
  });

  return apiOk(data);
}
