import { envSummary, getPaymentMode } from "./env";

/** Log payment mode once on server startup (no secrets). */
export function logEnvOnStartup() {
  if (typeof window !== "undefined") return;
  const summary = envSummary();
  const mode = getPaymentMode();
  console.info("[cms] env", JSON.stringify(summary));
  if (mode === "misconfigured") {
    console.warn(
      "[cms] DEMO_PAYMENT=false but M-Pesa credentials incomplete — falling back to demo behaviour"
    );
  }
}
