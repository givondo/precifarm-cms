export function BookingStatusBadge({ status }: { status: string }) {
  const cls =
    status === "paid"
      ? "badge-paid"
      : status === "pending"
        ? "badge-pending"
        : status === "failed"
          ? "badge-failed"
          : "badge-cancelled";
  return <span className={`badge ${cls}`}>{status}</span>;
}
