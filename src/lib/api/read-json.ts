import { apiError } from "@/lib/api/responses";
import type { NextResponse } from "next/server";

/**
 * Reads a JSON request body of at most maxBytes. Public intake routes use this so an oversized body
 * is refused (413) without being buffered or parsed in full; malformed JSON gets the usual 400.
 */
export async function readJsonBody(
  request: Request,
  maxBytes: number,
): Promise<{ ok: true; body: unknown } | { ok: false; response: NextResponse }> {
  const tooLarge = () => ({
    ok: false as const,
    response: apiError("PAYLOAD_TOO_LARGE", "Request body is too large.", 413),
  });
  const invalid = () => ({ ok: false as const, response: apiError("INVALID_JSON", "Invalid JSON body.", 400) });

  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return tooLarge();
  if (!request.body) return invalid();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      return tooLarge();
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { ok: true, body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return invalid();
  }
}
