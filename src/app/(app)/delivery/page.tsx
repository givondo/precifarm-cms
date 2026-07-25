import { listCargoDeliveries } from "@/lib/cargo-delivery";
import DeliveryDesk from "./DeliveryDesk";

export default async function DeliveryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const params = await searchParams;
  const filter = params.status === "completed" ? "completed" : "active";
  const rows = listCargoDeliveries({
    status: filter,
    search: params.q,
  });

  return (
    <DeliveryDesk
      initialRows={rows}
      initialFilter={filter}
      initialSearch={params.q ?? ""}
    />
  );
}
