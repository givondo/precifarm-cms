import { getDeliveryStageLabel, type CargoDeliveryStatus } from "@/lib/cargo";

export function DeliveryStatusBadge({ status }: { status: CargoDeliveryStatus | string }) {
  const done = status === "delivered";
  const failed = status === "failed_delivery";
  const cls = done
    ? "badge-paid"
    : failed
      ? "badge-failed"
      : status === "in_transit" || status === "out_for_delivery"
        ? "badge-pending"
        : "badge-cancelled";

  return <span className={`badge ${cls}`}>{getDeliveryStageLabel(status)}</span>;
}
