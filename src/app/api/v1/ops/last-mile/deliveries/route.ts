import { requireAgent } from "@/lib/api/require-agent";
import { apiOk } from "@/lib/api/responses";
import { listLastMileDeliveries } from "@/lib/cargo-delivery";

export async function GET(request: Request) {
  const auth = await requireAgent();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const bucket = searchParams.get("bucket");
  const search = searchParams.get("q") ?? undefined;

  const data = listLastMileDeliveries({
    bucket:
      bucket === "ready" ||
      bucket === "active" ||
      bucket === "upcoming" ||
      bucket === "completed"
        ? bucket
        : undefined,
    search,
  });

  return apiOk(data);
}
