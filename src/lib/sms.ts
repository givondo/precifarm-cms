import fs from "fs";
import path from "path";

const SMS_LOG = path.join(process.cwd(), "data", "sms.log");

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

  const dir = path.dirname(SMS_LOG);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.appendFileSync(SMS_LOG, JSON.stringify(entry) + "\n", "utf-8");

  if (process.env.NODE_ENV !== "production") {
    const who = params.recipient ? ` (${params.recipient})` : "";
    const stage = params.stage ? ` [${params.stage}]` : "";
    console.log(`[SMS]${stage} ${params.reference} → ${params.phone}${who}`);
  }
}

export function listSmsLog(limit = 50): SmsLogEntry[] {
  if (!fs.existsSync(SMS_LOG)) return [];
  const lines = fs.readFileSync(SMS_LOG, "utf-8").trim().split("\n").filter(Boolean);
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
