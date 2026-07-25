"use client";

import { paymentModeDisplay } from "@/lib/payment-ui";
import { usePaymentMode } from "@/hooks/usePaymentMode";

export default function PaymentModeBadge() {
  const mode = usePaymentMode();
  const { label, detail, tone } = paymentModeDisplay(mode);

  const toneClass =
    tone === "live"
      ? "bg-green-50 border-green-200 text-green-800"
      : tone === "warn"
        ? "bg-amber-50 border-amber-200 text-amber-900"
        : "bg-gray-50 border-gray-200 text-gray-700";

  const dotClass =
    tone === "live" ? "bg-green-500" : tone === "warn" ? "bg-amber-500" : "bg-gray-400";

  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass}`} />
        <span className="text-xs font-semibold">{label}</span>
      </div>
      <p className="text-[11px] mt-0.5 opacity-80 pl-4">{detail}</p>
    </div>
  );
}
