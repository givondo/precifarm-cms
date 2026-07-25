import { requireAgent } from "@/lib/api/require-agent";
import { apiOk } from "@/lib/api/responses";
import { listRiders } from "@/lib/cargo-delivery";

export async function GET(request: Request) {
  const auth = await requireAgent();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const city = searchParams.get("city") ?? undefined;

  return apiOk(await listRiders(city));
}
