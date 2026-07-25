export type ContactSubmissionInput = {
  name: string;
  email: string;
  phone?: string;
  interest: string;
  message: string;
  channel?: string;
  anonymousId?: string;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContactInput(body: unknown):
  | { ok: true; input: ContactSubmissionInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Request body is required." };
  }

  const raw = body as Record<string, unknown>;
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : "";
  const phone = typeof raw.phone === "string" ? raw.phone.trim() : undefined;
  const interest = typeof raw.interest === "string" ? raw.interest.trim() : "";
  const message = typeof raw.message === "string" ? raw.message.trim() : "";
  const channel = typeof raw.channel === "string" ? raw.channel.trim() : "web";
  const anonymousId =
    typeof raw.anonymousId === "string" && raw.anonymousId.trim()
      ? raw.anonymousId.trim()
      : undefined;

  if (name.length < 2 || name.length > 128) {
    return { ok: false, error: "Name must be 2–128 characters." };
  }
  if (!EMAIL_RE.test(email) || email.length > 256) {
    return { ok: false, error: "Valid email is required." };
  }
  if (phone && phone.length > 32) {
    return { ok: false, error: "Phone is too long." };
  }
  if (interest.length < 2 || interest.length > 128) {
    return { ok: false, error: "Interest is required." };
  }
  if (message.length < 10 || message.length > 5000) {
    return { ok: false, error: "Message must be 10–5000 characters." };
  }

  return {
    ok: true,
    input: { name, email, phone: phone || undefined, interest, message, channel, anonymousId },
  };
}
