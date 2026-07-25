"use client";

import { useEffect } from "react";
import { MPESA_POLL_MS, MPESA_POLL_TIMEOUT_MS } from "@/lib/payment-ui";

type PendingPayment = {
  bookingId: string;
  reference: string;
  total: number;
};

type PollHandlers = {
  onPaid: (data: { reference: string; total: number; mpesaReceipt?: string; demo?: boolean }) => void;
  onFailed: (message: string) => void;
  onTimeout: (message: string) => void;
};

export function useMpesaPaymentPoll(
  pending: PendingPayment | null,
  handlers: PollHandlers
) {
  useEffect(() => {
    if (!pending) return;

    let cancelled = false;
    const started = Date.now();
    const { onPaid, onFailed, onTimeout } = handlers;

    const poll = async () => {
      while (!cancelled && Date.now() - started < MPESA_POLL_TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, MPESA_POLL_MS));
        try {
          const res = await fetch(
            `/api/v1/payments/${encodeURIComponent(pending.bookingId)}/status`
          );
          const json = await res.json();
          if (cancelled) return;
          if (json.data?.bookingStatus === "paid") {
            onPaid({
              reference: json.data.reference ?? pending.reference,
              total: pending.total,
              mpesaReceipt: json.data.mpesaReceipt,
              demo: false,
            });
            return;
          }
          if (json.data?.paymentStatus === "failed") {
            onFailed("M-Pesa payment was declined or timed out. Try again.");
            return;
          }
        } catch {
          /* keep polling */
        }
      }
      if (!cancelled) {
        onTimeout("Payment timed out. If you entered your PIN, check Lookup or try again.");
      }
    };

    poll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handlers recreated per page; pending drives poll
  }, [pending?.bookingId]);
}
