import { nairobiKisumuRoute } from "@/lib/route";
import { normalizeKenyanPhone, validateIdNumber } from "@/lib/booking";

export const CARGO_CAPACITY_KG = 500;
export const CARGO_FARE_PER_KG = 50;
export const LAST_MILE_DELIVERY_FEE = 500;
export const CARGO_VEHICLE = "ET01 electric cargo van";

export type CargoDeliveryStatus =
  | "confirmed"
  | "received"
  | "loaded"
  | "in_transit"
  | "arrived"
  | "out_for_delivery"
  | "delivered"
  | "failed_delivery";

export const CARGO_DELIVERY_STAGES: {
  id: CargoDeliveryStatus;
  label: string;
  description: string;
}[] = [
  { id: "confirmed", label: "Confirmed", description: "Payment received — waybill issued" },
  { id: "received", label: "Received", description: "Cargo received at origin hub" },
  { id: "loaded", label: "Loaded", description: "Cargo loaded on vehicle" },
  { id: "in_transit", label: "In transit", description: "En route to destination" },
  { id: "arrived", label: "Arrived", description: "Arrived at destination hub" },
  { id: "out_for_delivery", label: "Out for delivery", description: "Courier en route (last mile)" },
  { id: "delivered", label: "Delivered", description: "Handed to receiver" },
  { id: "failed_delivery", label: "Failed delivery", description: "Delivery attempt unsuccessful" },
];

export function deliveryStagePath(lastMileDelivery: boolean): CargoDeliveryStatus[] {
  const base: CargoDeliveryStatus[] = [
    "confirmed",
    "received",
    "loaded",
    "in_transit",
    "arrived",
  ];
  if (lastMileDelivery) {
    return [...base, "out_for_delivery", "delivered"];
  }
  return [...base, "delivered"];
}

export function getNextDeliveryStage(
  current: CargoDeliveryStatus,
  lastMileDelivery: boolean
): CargoDeliveryStatus | null {
  const path = deliveryStagePath(lastMileDelivery);
  const idx = path.indexOf(current);
  if (idx === -1 || idx >= path.length - 1) return null;
  return path[idx + 1];
}

export function canAdvanceDeliveryStage(
  current: CargoDeliveryStatus,
  target: CargoDeliveryStatus,
  lastMileDelivery: boolean
): boolean {
  if (target === "failed_delivery") {
    return current === "out_for_delivery" || (current === "arrived" && lastMileDelivery);
  }
  const next = getNextDeliveryStage(current, lastMileDelivery);
  return next === target;
}

export function getDeliveryStageLabel(stage: string): string {
  return CARGO_DELIVERY_STAGES.find((s) => s.id === stage)?.label ?? stage;
}

export function getNextStageLabel(stage: CargoDeliveryStatus | null): string | null {
  if (!stage) return null;
  return getDeliveryStageLabel(stage);
}

export type DeliveryMessageRecipient = "sender" | "receiver";

export function formatDeliveryStageSms(params: {
  stage: CargoDeliveryStatus;
  recipient: DeliveryMessageRecipient;
  reference: string;
  from: string;
  to: string;
  date: string;
  time: string;
  weightKg: number;
  description: string;
  senderName: string;
  receiverName: string;
  deliveryAddress?: string;
  riderName?: string;
  riderPhone?: string;
  riderVehicle?: string;
}): string {
  const { stage, recipient, reference } = params;
  const name = recipient === "sender" ? params.senderName : params.receiverName;
  const track = `Track: precifarm.com/cargo/${reference}`;

  const intro = `Hi ${name.split(" ")[0]},`;

  switch (stage) {
    case "confirmed":
      return [
        `${intro} Precifarm Cargo waybill ${reference} is confirmed.`,
        `${params.from} → ${params.to} · ${params.date} ${params.time}`,
        `${params.weightKg} kg · ${params.description}`,
        recipient === "receiver"
          ? `Sender: ${params.senderName}. We will notify you when it arrives.`
          : `Receiver: ${params.receiverName}.`,
        track,
      ].join("\n");

    case "received":
      return [
        `${intro} Your cargo (${reference}) has been received at our ${params.from} hub.`,
        `${params.weightKg} kg · ${params.description}`,
        `Departure: ${params.date} at ${params.time}`,
        track,
      ].join("\n");

    case "loaded":
      return [
        `${intro} Cargo ${reference} is loaded and ready for departure.`,
        `${params.from} → ${params.to} · ${params.date} ${params.time}`,
        `${params.weightKg} kg · ${params.description}`,
        track,
      ].join("\n");

    case "in_transit":
      return [
        `${intro} Cargo ${reference} is now in transit.`,
        `${params.from} → ${params.to}`,
        `Expected arrival hub: ${params.to}`,
        track,
      ].join("\n");

    case "arrived":
      return [
        `${intro} Cargo ${reference} has arrived at ${params.to}.`,
        `${params.weightKg} kg · ${params.description}`,
        recipient === "receiver"
          ? params.deliveryAddress
            ? `Last mile delivery to: ${params.deliveryAddress}. We will notify you when it is on the way.`
            : "Please collect from the Precifarm hub with your ID."
          : `Receiver: ${params.receiverName}.`,
        track,
      ].join("\n");

    case "out_for_delivery": {
      const lines = [
        `${intro} Cargo ${reference} is out for delivery.`,
        params.deliveryAddress
          ? `Delivering to: ${params.deliveryAddress}`
          : `Delivering to ${params.receiverName}.`,
      ];
      if (params.riderName) {
        lines.push(
          `Rider: ${params.riderName}${params.riderVehicle ? ` (${params.riderVehicle})` : ""}${
            params.riderPhone ? ` · ${params.riderPhone}` : ""
          }`
        );
      }
      lines.push("Please have your ID ready. Questions: +254 794 702 768", track);
      return lines.join("\n");
    }

    case "delivered":
      return [
        `${intro} Cargo ${reference} has been delivered successfully.`,
        `${params.weightKg} kg · ${params.description}`,
        recipient === "sender"
          ? `Handed to ${params.receiverName}. Thank you for choosing Precifarm.`
          : "Thank you for choosing Precifarm Cargo.",
        track,
      ].join("\n");

    case "failed_delivery":
      return [
        `${intro} We could not complete delivery for cargo ${reference}.`,
        "Our team will contact you to reschedule.",
        `Questions: +254 794 702 768`,
        track,
      ].join("\n");
  }
}

export type CreateCargoBookingInput = {
  routeId: string;
  date: string;
  time: string;
  weightKg: number;
  description: string;
  senderName: string;
  senderPhone: string;
  senderIdNumber: string;
  receiverName: string;
  receiverPhone: string;
  receiverIdNumber: string;
  isFragile?: boolean;
  lastMileDelivery?: boolean;
  deliveryAddress?: string;
  channel?: "web" | "agent_walkin" | "agent_callin";
  agentId?: string;
  notes?: string;
};

export function normalizeIdNumber(idNumber: string): string {
  return idNumber.trim().replace(/\s/g, "").toUpperCase();
}

export function calculateCargoFare(
  weightKg: number,
  options?: { lastMileDelivery?: boolean }
): number {
  let total = Math.ceil(weightKg) * CARGO_FARE_PER_KG;
  if (options?.lastMileDelivery) {
    total += LAST_MILE_DELIVERY_FEE;
  }
  return total;
}

export function generateCargoReference(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `PF-C${code.slice(0, 5)}`;
}

export function validateCargoBookingInput(input: CreateCargoBookingInput): string | null {
  if (input.routeId !== nairobiKisumuRoute.id) {
    return "Route not available for cargo.";
  }
  if (!input.date) return "Travel date is required.";
  const today = new Date().toISOString().slice(0, 10);
  if (input.date < today) return "Travel date cannot be in the past.";
  if (
    !nairobiKisumuRoute.departures.includes(input.time as (typeof nairobiKisumuRoute.departures)[number])
  ) {
    return "Invalid departure time.";
  }
  if (!Number.isFinite(input.weightKg) || input.weightKg <= 0 || input.weightKg > CARGO_CAPACITY_KG) {
    return `Weight must be between 0.1 and ${CARGO_CAPACITY_KG} kg.`;
  }
  if (input.description.trim().length < 3) {
    return "Cargo description is required (min 3 characters).";
  }
  if (input.senderName.trim().length < 2) return "Sender name is required.";
  if (!normalizeKenyanPhone(input.senderPhone)) {
    return "Enter a valid sender phone number.";
  }
  if (!input.senderIdNumber?.trim()) {
    return "Sender National ID or passport number is required.";
  }
  if (!validateIdNumber(input.senderIdNumber)) {
    return "Enter a valid sender National ID or passport number (6–20 letters/numbers).";
  }
  if (input.receiverName.trim().length < 2) return "Receiver name is required.";
  if (!normalizeKenyanPhone(input.receiverPhone)) {
    return "Enter a valid receiver phone number.";
  }
  if (!input.receiverIdNumber?.trim()) {
    return "Receiver National ID or passport number is required.";
  }
  if (!validateIdNumber(input.receiverIdNumber)) {
    return "Enter a valid receiver National ID or passport number (6–20 letters/numbers).";
  }
  if (input.lastMileDelivery) {
    if (!input.deliveryAddress?.trim() || input.deliveryAddress.trim().length < 5) {
      return "Delivery address is required for last mile delivery (min 5 characters).";
    }
  }
  return null;
}

export function formatCargoWaybillSms(params: {
  reference: string;
  from: string;
  to: string;
  date: string;
  time: string;
  weightKg: number;
  description: string;
  total: number;
  receiverName: string;
  lastMileDelivery?: boolean;
  deliveryAddress?: string;
}): string {
  const lines = [
    `Precifarm Cargo: Waybill ${params.reference} confirmed.`,
    `${params.from} → ${params.to}`,
    `${params.date}, ${params.time}`,
    `${params.weightKg} kg · ${params.description}`,
    `Receiver: ${params.receiverName}`,
  ];

  if (params.lastMileDelivery && params.deliveryAddress) {
    lines.push(`Last mile delivery to: ${params.deliveryAddress}`);
  }

  lines.push(
    `Fare: KSh ${params.total.toLocaleString("en-KE")}`,
    `Track: precifarm.com/cargo/${params.reference}`,
    `Questions: +254 794 702 768`
  );

  return lines.join("\n");
}
