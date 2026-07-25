import { isDemoPayment, mpesaApiBaseUrl, mpesaEnv } from "@/lib/env";

export type StkBooking = {
  id: string;
  reference: string;
  total: number;
  phone: string;
  from: string;
  to: string;
};

export type StkInitResult =
  | {
      mode: "demo";
      status: "success";
      reference: string;
      mpesaReceipt: string;
      paidAt: string;
      demo: true;
      message: string;
    }
  | {
      mode: "live";
      status: "pending";
      reference: string;
      checkoutRequestId: string;
      message: string;
    }
  | {
      status: "failed";
      reference: string;
      message: string;
    };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function demoReceipt(): string {
  return `DEMO${Date.now().toString().slice(-8)}`;
}

export async function initiateStkPush(booking: StkBooking): Promise<StkInitResult> {
  if (isDemoPayment()) {
    await delay(2500);
    const paidAt = new Date().toISOString();
    return {
      mode: "demo",
      status: "success",
      reference: booking.reference,
      mpesaReceipt: demoReceipt(),
      paidAt,
      demo: true,
      message: "Demo payment successful. No M-Pesa charge was made.",
    };
  }

  const consumerKey = mpesaEnv.consumerKey;
  const consumerSecret = mpesaEnv.consumerSecret;
  const passkey = mpesaEnv.passkey;
  const shortcode = mpesaEnv.shortcode;
  const callbackUrl = mpesaEnv.callbackUrl;

  if (!consumerKey || !consumerSecret || !passkey || !shortcode || !callbackUrl) {
    return {
      status: "failed",
      reference: booking.reference,
      message: "M-Pesa credentials or callback URL are not configured.",
    };
  }

  const baseUrl = mpesaApiBaseUrl();

  const authResponse = await fetch(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    {
      headers: {
        Authorization: `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64")}`,
      },
    }
  );

  if (!authResponse.ok) {
    return {
      status: "failed",
      reference: booking.reference,
      message: "Could not authenticate with M-Pesa.",
    };
  }

  const { access_token: accessToken } = (await authResponse.json()) as {
    access_token?: string;
  };

  if (!accessToken) {
    return {
      status: "failed",
      reference: booking.reference,
      message: "M-Pesa access token missing.",
    };
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

  const stkResponse = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: booking.total,
      PartyA: booking.phone,
      PartyB: shortcode,
      PhoneNumber: booking.phone,
      CallBackURL: callbackUrl,
      AccountReference: booking.reference,
      TransactionDesc: `Precifarm ${booking.from}-${booking.to}`,
    }),
  });

  const stkData = (await stkResponse.json()) as {
    CheckoutRequestID?: string;
    ResponseDescription?: string;
    errorMessage?: string;
  };

  if (!stkResponse.ok || !stkData.CheckoutRequestID) {
    return {
      status: "failed",
      reference: booking.reference,
      message:
        stkData.errorMessage ||
        stkData.ResponseDescription ||
        "M-Pesa STK push could not be initiated.",
    };
  }

  return {
    mode: "live",
    status: "pending",
    reference: booking.reference,
    checkoutRequestId: stkData.CheckoutRequestID,
    message: `STK push sent. Enter your M-Pesa PIN on ${booking.phone.slice(0, 4)}…`,
  };
}

export type MpesaCallbackBody = {
  Body?: {
    stkCallback?: {
      CheckoutRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: {
        Item?: Array<{ Name?: string; Value?: string | number }>;
      };
    };
  };
};

export function parseMpesaCallback(body: MpesaCallbackBody): {
  checkoutRequestId: string;
  success: boolean;
  resultDesc: string;
  mpesaReceipt?: string;
  amount?: number;
  phone?: string;
} | null {
  const cb = body.Body?.stkCallback;
  if (!cb?.CheckoutRequestID) return null;

  const success = cb.ResultCode === 0;
  let mpesaReceipt: string | undefined;
  let amount: number | undefined;
  let phone: string | undefined;

  if (success && cb.CallbackMetadata?.Item) {
    for (const item of cb.CallbackMetadata.Item) {
      if (item.Name === "MpesaReceiptNumber") mpesaReceipt = String(item.Value);
      if (item.Name === "Amount") amount = Number(item.Value);
      if (item.Name === "PhoneNumber") phone = String(item.Value);
    }
  }

  return {
    checkoutRequestId: cb.CheckoutRequestID,
    success,
    resultDesc: cb.ResultDesc ?? "Unknown",
    mpesaReceipt,
    amount,
    phone,
  };
}
