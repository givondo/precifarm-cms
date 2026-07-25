import type { PaymentMode } from "@/lib/env";

export type { PaymentMode };

export const MPESA_POLL_MS = 3000;
export const MPESA_POLL_TIMEOUT_MS = 120_000;

export function mpesaLabel(mode: PaymentMode | null): string {
  if (mode === "live-production" || mode === "live-sandbox") {
    return "M-Pesa Express STK";
  }
  if (mode === "demo") return "M-Pesa STK (demo — no charge)";
  return "M-Pesa STK";
}

export function paymentModeDisplay(mode: PaymentMode | null): {
  label: string;
  detail: string;
  tone: "live" | "demo" | "warn";
} {
  switch (mode) {
    case "live-production":
      return {
        label: "M-Pesa live",
        detail: "Production STK push",
        tone: "live",
      };
    case "live-sandbox":
      return {
        label: "M-Pesa sandbox",
        detail: "Daraja sandbox STK",
        tone: "live",
      };
    case "misconfigured":
      return {
        label: "M-Pesa misconfigured",
        detail: "Check .env credentials",
        tone: "warn",
      };
    default:
      return {
        label: "Demo payments",
        detail: "No real M-Pesa charge",
        tone: "demo",
      };
  }
}
