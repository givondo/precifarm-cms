/** Kenyan MSISDN shapes: 2547XXXXXXXX, +2547..., 07XXXXXXXX, 7XXXXXXXX (and 01/1 prefixes). */
const PHONE_PATTERN = /^(?:\+?254|0)?[17]\d{8}$/;

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  return `${"*".repeat(Math.max(digits.length - 3, 0))}${digits.slice(-3)}`;
}

function looksLikePhone(value: string): boolean {
  const compact = value.replace(/[\s-]/g, "");
  return PHONE_PATTERN.test(compact);
}

/**
 * Deep-copies a JSON-like value and masks anything shaped like a Kenyan phone
 * number (keeps the last 3 digits). Used before writing payloads to the audit log.
 */
export function redactPhones<T>(value: T): T {
  if (typeof value === "string") {
    return (looksLikePhone(value) ? maskPhone(value) : value) as T;
  }
  if (typeof value === "number") {
    return (Number.isInteger(value) && looksLikePhone(String(value)) ? maskPhone(String(value)) : value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactPhones(item)) as T;
  }
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = redactPhones(item);
    }
    return out as T;
  }
  return value;
}
