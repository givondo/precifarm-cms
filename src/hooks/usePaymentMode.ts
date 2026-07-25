"use client";

import { useEffect, useState } from "react";
import type { PaymentMode } from "@/lib/payment-ui";

export function usePaymentMode() {
  const [paymentMode, setPaymentMode] = useState<PaymentMode | null>(null);

  useEffect(() => {
    fetch("/api/v1/health")
      .then((r) => r.json())
      .then((json) => setPaymentMode(json.data?.paymentMode ?? null))
      .catch(() => setPaymentMode(null));
  }, []);

  return paymentMode;
}
