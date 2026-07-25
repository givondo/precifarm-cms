import { requireAgent } from "@/lib/api/require-agent";
import { apiOk, apiError } from "@/lib/api/responses";
import { getBookingByReference } from "@/lib/services";
import {
  getDeliveryMessagesForBooking,
  updateCargoDeliveryStatus,
} from "@/lib/cargo-delivery";
import type { CargoDeliveryStatus } from "@/lib/cargo";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  const auth = await requireAgent();
  if (!auth.ok) return auth.response;

  const { reference } = await params;
  const result = await getBookingByReference(reference);
  if ("error" in result && result.error) {
    return apiError("NOT_FOUND", result.error, result.status);
  }

  if (!result.data || result.data.bookingType !== "cargo") {
    return apiError("NOT_CARGO", "Delivery tracking applies to cargo only.", 400);
  }

  return apiOk({
    ...result.data,
    deliveryMessages: await getDeliveryMessagesForBooking(result.data.id),
  });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ reference: string }> }
) {
  const auth = await requireAgent();
  if (!auth.ok) return auth.response;

  const { reference } = await params;
  let body: { stage?: CargoDeliveryStatus } = {};
  try {
    body = await request.json();
  } catch {
    // Advance to next stage when body is empty.
  }

  const result = await updateCargoDeliveryStatus(reference, auth.agent.id, body.stage);
  if ("error" in result && result.error) {
    return apiError("DELIVERY_ERROR", result.error, result.status);
  }

  return apiOk(result.data);
}
