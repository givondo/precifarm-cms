export type RiderStatus = "available" | "on_delivery" | "off_duty";

export type RiderVehicle = "E-bike" | "Electric van";

export const RIDER_STATUS_LABELS: Record<RiderStatus, string> = {
  available: "Available",
  on_delivery: "On delivery",
  off_duty: "Off duty",
};

export function riderStatusBadgeClass(status: RiderStatus): string {
  switch (status) {
    case "available":
      return "badge-paid";
    case "on_delivery":
      return "badge-pending";
    case "off_duty":
      return "badge-cancelled";
  }
}
