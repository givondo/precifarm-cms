import fs from "fs";
import path from "path";
import { maskPhone } from "@/lib/security/redact";

import { dataDir } from "@/db/store";

/** Message log beside the store. There is no SMS provider yet: messages are recorded, not sent. */
function smsLog(): string {
  try {
    return path.join(dataDir(), "sms.log");
  } catch {
    return path.join(process.cwd(), "data", "sms.log");
  }
}

export type SmsLogEntry = {
  at: string;
  phone: string;
  reference: string;
  bookingId?: string;
  body: string;
  status: "logged";
  stage?: string;
  recipient?: "sender" | "receiver";
};

export function logSms(params: {
  phone: string;
  body: string;
  reference: string;
  bookingId?: string;
  stage?: string;
  recipient?: "sender" | "receiver";
}): void {
  const entry: SmsLogEntry = {
    at: new Date().toISOString(),
    phone: params.phone,
    reference: params.reference,
    bookingId: params.bookingId,
    body: params.body,
    status: "logged",
    stage: params.stage,
    recipient: params.recipient,
  };

  // Never let the log break the work that triggered it (a payment, a delivery update).
  try {
    const file = smsLog();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(entry) + "\n", "utf-8");
  } catch (err) {
    console.error("[SMS] could not write the message log:", err instanceof Error ? err.message : err);
  }

  if (process.env.NODE_ENV !== "production") {
    const who = params.recipient ? ` (${params.recipient})` : "";
    const stage = params.stage ? ` [${params.stage}]` : "";
    console.log(`[SMS]${stage} ${params.reference} to ${maskPhone(params.phone)}${who}`);
  }
}

export function listSmsLog(limit = 50): SmsLogEntry[] {
  const file = smsLog();
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf-8").trim().split("\n").filter(Boolean);
  return lines
    .slice(-limit)
    .reverse()
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as SmsLogEntry];
      } catch {
        return [];
      }
    });
}
