import crypto from "crypto";
import { getStore, mutateStore, ensureSeeded } from "@/db";
import type {
  DataStore,
  StoreBooking,
  StoreCargoDetails,
  StoreRoute,
  StoreTrip,
} from "@/db/store";
import { logAudit } from "@/lib/audit";
import {
  formatDeliveryStageSms,
  getNextDeliveryStage,
  canAdvanceDeliveryStage,
  getDeliveryStageLabel,
  getNextStageLabel,
  type CargoDeliveryStatus,
} from "@/lib/cargo";
import { logSms } from "@/lib/sms";
import { RIDER_STATUS_LABELS, type RiderStatus } from "@/lib/riders";

type ResolvedShipment = {
  booking: StoreBooking;
  trip: StoreTrip;
  route: StoreRoute;
  cargo: StoreCargoDetails;
};

function resolvePaidCargoShipment(
  booking: StoreBooking,
  store: DataStore
): ResolvedShipment | null {
  if (booking.bookingType !== "cargo" || booking.status !== "paid") return null;
  const trip = store.trips.find((t) => t.id === booking.tripId);
  const route = trip ? store.routes.find((r) => r.id === trip.routeId) : undefined;
  const cargo = store.cargoDetails.find((c) => c.bookingId === booking.id);
  if (!trip || !route || !cargo) return null;
  return { booking, trip, route, cargo };
}

async function recordDeliveryMessage(params: {
  bookingId: string;
  reference: string;
  stage: CargoDeliveryStatus;
  recipient: "sender" | "receiver";
  phone: string;
  body: string;
  agentId?: string;
}) {
  const now = new Date().toISOString();
  await mutateStore((s) => {
    s.deliveryMessages.push({
      id: crypto.randomUUID(),
      bookingId: params.bookingId,
      reference: params.reference,
      stage: params.stage,
      recipient: params.recipient,
      phone: params.phone,
      body: params.body,
      sentAt: now,
      agentId: params.agentId,
    });
  });
}

async function notifyCargoDeliveryStage(
  bookingId: string,
  stage: CargoDeliveryStatus,
  agentId?: string,
  options?: { skipSender?: boolean; skipReceiver?: boolean }
) {
  const store = await getStore();
  const booking = store.bookings.find((b) => b.id === bookingId);
  const cargo = store.cargoDetails.find((c) => c.bookingId === bookingId);
  if (!booking || !cargo) return;

  const trip = store.trips.find((t) => t.id === booking.tripId)!;
  const route = store.routes.find((r) => r.id === trip.routeId)!;
  const rider = cargo.riderId
    ? (store.riders ?? []).find((r) => r.id === cargo.riderId)
    : undefined;

  const smsParams = {
    stage,
    reference: booking.reference,
    from: route.origin,
    to: route.destination,
    date: trip.travelDate,
    time: trip.departureTime,
    weightKg: cargo.weightKg,
    description: cargo.description,
    senderName: cargo.senderName,
    receiverName: cargo.receiverName,
    deliveryAddress: cargo.deliveryAddress,
    riderName: rider?.name,
    riderPhone: rider?.phone,
    riderVehicle: rider?.vehicle,
  };

  if (!options?.skipSender) {
    const body = formatDeliveryStageSms({ ...smsParams, recipient: "sender" });
    await recordDeliveryMessage({
      bookingId,
      reference: booking.reference,
      stage,
      recipient: "sender",
      phone: cargo.senderPhone,
      body,
      agentId,
    });
    logSms({
      phone: cargo.senderPhone,
      body,
      reference: booking.reference,
      bookingId,
      stage,
      recipient: "sender",
    });
  }

  if (!options?.skipReceiver) {
    const body = formatDeliveryStageSms({ ...smsParams, recipient: "receiver" });
    await recordDeliveryMessage({
      bookingId,
      reference: booking.reference,
      stage,
      recipient: "receiver",
      phone: cargo.receiverPhone,
      body,
      agentId,
    });
    logSms({
      phone: cargo.receiverPhone,
      body,
      reference: booking.reference,
      bookingId,
      stage,
      recipient: "receiver",
    });
  }
}

export async function onCargoPaymentConfirmed(params: {
  bookingId: string;
  reference: string;
  smsBody: string;
  senderPhone: string;
  agentId?: string;
}) {
  await recordDeliveryMessage({
    bookingId: params.bookingId,
    reference: params.reference,
    stage: "confirmed",
    recipient: "sender",
    phone: params.senderPhone,
    body: params.smsBody,
    agentId: params.agentId,
  });
  await notifyCargoDeliveryStage(params.bookingId, "confirmed", params.agentId, {
    skipSender: true,
  });
}

function getDeliveryMessagesFromStore(store: DataStore, bookingId: string) {
  const messages = store.deliveryMessages ?? [];
  return messages
    .filter((m) => m.bookingId === bookingId)
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
}

export async function getDeliveryMessagesForBooking(bookingId: string) {
  await ensureSeeded();
  const store = await getStore();
  return getDeliveryMessagesFromStore(store, bookingId);
}

function syncRiderAvailabilityInStore(store: DataStore, riderId?: string) {
  if (!riderId) return;
  const rider = (store.riders ?? []).find((r) => r.id === riderId);
  if (!rider || rider.status === "off_duty") return;

  const activeCount = store.cargoDetails.filter(
    (c) => c.riderId === riderId && c.deliveryStatus === "out_for_delivery"
  ).length;

  rider.status = activeCount > 0 ? "on_delivery" : "available";
}

function mapRiderRow(rider: NonNullable<DataStore["riders"]>[number], store: DataStore) {
  const activeDeliveries = store.cargoDetails.filter(
    (c) => c.riderId === rider.id && c.deliveryStatus === "out_for_delivery"
  ).length;

  return {
    id: rider.id,
    name: rider.name,
    phone: rider.phone,
    city: rider.city,
    vehicle: rider.vehicle,
    status: rider.status as RiderStatus,
    statusLabel: RIDER_STATUS_LABELS[rider.status as RiderStatus] ?? rider.status,
    isActive: rider.isActive,
    activeDeliveries,
  };
}

function buildCargoDeliveryRow(
  resolved: ResolvedShipment,
  store: DataStore
) {
  const { booking, trip, route, cargo } = resolved;
  const messages = getDeliveryMessagesFromStore(store, booking.id);
  const deliveryStatus = (cargo.deliveryStatus ?? "confirmed") as CargoDeliveryStatus;
  const nextStage = getNextDeliveryStage(deliveryStatus, cargo.lastMileDelivery);
  const rider = cargo.riderId
    ? (store.riders ?? []).find((r) => r.id === cargo.riderId)
    : undefined;

  return {
    reference: booking.reference,
    bookingId: booking.id,
    from: route.origin,
    to: route.destination,
    date: trip.travelDate,
    time: trip.departureTime,
    senderName: cargo.senderName,
    senderPhone: cargo.senderPhone,
    receiverName: cargo.receiverName,
    receiverPhone: cargo.receiverPhone,
    weightKg: cargo.weightKg,
    description: cargo.description,
    lastMileDelivery: cargo.lastMileDelivery,
    deliveryAddress: cargo.deliveryAddress,
    deliveryStatus,
    deliveryStatusUpdatedAt: cargo.deliveryStatusUpdatedAt,
    riderId: cargo.riderId,
    rider: rider
      ? {
          id: rider.id,
          name: rider.name,
          phone: rider.phone,
          vehicle: rider.vehicle,
          city: rider.city,
          status: rider.status,
        }
      : null,
    nextStage,
    nextStageLabel: getNextStageLabel(nextStage),
    messageCount: messages.length,
    lastMessageAt: messages[messages.length - 1]?.sentAt,
    paidAt: booking.paidAt,
  };
}

export async function listCargoDeliveries(filters?: {
  status?: "active" | "completed";
  search?: string;
}) {
  await ensureSeeded();
  const store = await getStore();

  return store.bookings
    .flatMap((booking) => {
      const resolved = resolvePaidCargoShipment(booking, store);
      return resolved ? [buildCargoDeliveryRow(resolved, store)] : [];
    })
    .filter((row) => {
      if (filters?.status === "active") {
        if (row.deliveryStatus === "delivered" || row.deliveryStatus === "failed_delivery") {
          return false;
        }
      }
      if (filters?.status === "completed") {
        if (row.deliveryStatus !== "delivered" && row.deliveryStatus !== "failed_delivery") {
          return false;
        }
      }
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        return (
          row.reference.toLowerCase().includes(q) ||
          row.senderName.toLowerCase().includes(q) ||
          row.receiverName.toLowerCase().includes(q) ||
          row.senderPhone.includes(q) ||
          row.receiverPhone.includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const aDone = a.deliveryStatus === "delivered" || a.deliveryStatus === "failed_delivery";
      const bDone = b.deliveryStatus === "delivered" || b.deliveryStatus === "failed_delivery";
      if (aDone !== bDone) return aDone ? 1 : -1;
      return (b.deliveryStatusUpdatedAt ?? b.paidAt ?? "").localeCompare(
        a.deliveryStatusUpdatedAt ?? a.paidAt ?? ""
      );
    });
}

export async function updateCargoDeliveryStatus(
  reference: string,
  agentId: string,
  targetStage?: CargoDeliveryStatus
) {
  await ensureSeeded();
  const store = await getStore();
  const booking = store.bookings.find((b) => b.reference === reference);
  if (!booking || booking.bookingType !== "cargo") {
    return { error: "Cargo booking not found.", status: 404 as const };
  }
  if (booking.status !== "paid") {
    return { error: "Only paid cargo can be tracked for delivery.", status: 409 as const };
  }

  const cargo = store.cargoDetails.find((c) => c.bookingId === booking.id);
  if (!cargo) return { error: "Cargo details not found.", status: 404 as const };

  const current = (cargo.deliveryStatus ?? "confirmed") as CargoDeliveryStatus;
  if (current === "delivered" || current === "failed_delivery") {
    return { error: "Delivery is already closed.", status: 409 as const };
  }

  const stage = targetStage ?? getNextDeliveryStage(current, cargo.lastMileDelivery);

  if (!stage) {
    return { error: "No further delivery stage available.", status: 409 as const };
  }

  if (!canAdvanceDeliveryStage(current, stage, cargo.lastMileDelivery)) {
    return {
      error: `Cannot move from "${current}" to "${stage}". Advance one stage at a time.`,
      status: 409 as const,
    };
  }

  if (stage === "out_for_delivery" && cargo.lastMileDelivery && !cargo.riderId) {
    return {
      error: "Assign a rider on the Last Mile page before dispatching.",
      status: 409 as const,
    };
  }

  const now = new Date().toISOString();

  await mutateStore((s) => {
    const c = s.cargoDetails.find((x) => x.bookingId === booking.id)!;
    c.deliveryStatus = stage;
    c.deliveryStatusUpdatedAt = now;

    if (stage === "out_for_delivery" && c.riderId) {
      const rider = (s.riders ?? []).find((r) => r.id === c.riderId);
      if (rider) rider.status = "on_delivery";
    }

    if (stage === "delivered" || stage === "failed_delivery") {
      syncRiderAvailabilityInStore(s, c.riderId);
    }
  });

  await notifyCargoDeliveryStage(booking.id, stage, agentId);

  await logAudit("cargo_delivery", booking.id, "stage_updated", "agent", agentId, {
    reference,
    from: current,
    to: stage,
  });

  const updatedStore = await getStore();
  const updated = updatedStore.cargoDetails.find((c) => c.bookingId === booking.id)!;
  const nextStage = getNextDeliveryStage(stage, updated.lastMileDelivery);
  const messages = await getDeliveryMessagesForBooking(booking.id);

  return {
    data: {
      reference,
      deliveryStatus: stage,
      deliveryStatusLabel: getDeliveryStageLabel(stage),
      nextStage,
      nextStageLabel: getNextStageLabel(nextStage),
      messages,
      message: `Client notified at "${stage}" stage (SMS sent to sender and receiver).`,
    },
    status: 200 as const,
  };
}

export async function listRiders(city?: string) {
  await ensureSeeded();
  const store = await getStore();
  return (store.riders ?? [])
    .filter((r) => r.isActive)
    .filter((r) => !city || r.city.toLowerCase() === city.toLowerCase())
    .map((r) => mapRiderRow(r, store))
    .sort((a, b) => {
      const order = { available: 0, on_delivery: 1, off_duty: 2 };
      const diff = order[a.status] - order[b.status];
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    });
}

export async function listLastMileDeliveries(filters?: {
  bucket?: "ready" | "active" | "upcoming" | "completed";
  search?: string;
}) {
  await ensureSeeded();
  const store = await getStore();

  return store.bookings
    .flatMap((booking) => {
      const resolved = resolvePaidCargoShipment(booking, store);
      if (!resolved?.cargo.lastMileDelivery) return [];

      const { trip, route, cargo } = resolved;
      const deliveryStatus = (cargo.deliveryStatus ?? "confirmed") as CargoDeliveryStatus;
      const rider = cargo.riderId
        ? (store.riders ?? []).find((r) => r.id === cargo.riderId)
        : undefined;

      let bucket: "ready" | "active" | "upcoming" | "completed";
      if (deliveryStatus === "delivered" || deliveryStatus === "failed_delivery") {
        bucket = "completed";
      } else if (deliveryStatus === "out_for_delivery") {
        bucket = "active";
      } else if (deliveryStatus === "arrived") {
        bucket = "ready";
      } else {
        bucket = "upcoming";
      }

      return [
        {
          reference: booking.reference,
          bookingId: booking.id,
          from: route.origin,
          to: route.destination,
          destinationCity: route.destination,
          date: trip.travelDate,
          time: trip.departureTime,
          receiverName: cargo.receiverName,
          receiverPhone: cargo.receiverPhone,
          weightKg: cargo.weightKg,
          description: cargo.description,
          deliveryAddress: cargo.deliveryAddress,
          deliveryStatus,
          deliveryStatusUpdatedAt: cargo.deliveryStatusUpdatedAt,
          riderId: cargo.riderId,
          rider: rider ? mapRiderRow(rider, store) : null,
          bucket,
          canAssignRider:
            deliveryStatus === "arrived" || deliveryStatus === "out_for_delivery",
          canDispatch: deliveryStatus === "arrived" && Boolean(cargo.riderId),
        },
      ];
    })
    .filter((row) => {
      if (filters?.bucket && row.bucket !== filters.bucket) return false;
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        return (
          row.reference.toLowerCase().includes(q) ||
          row.receiverName.toLowerCase().includes(q) ||
          row.deliveryAddress?.toLowerCase().includes(q) ||
          row.rider?.name.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      const bucketOrder = { ready: 0, active: 1, upcoming: 2, completed: 3 };
      const diff = bucketOrder[a.bucket] - bucketOrder[b.bucket];
      if (diff !== 0) return diff;
      return (b.deliveryStatusUpdatedAt ?? "").localeCompare(a.deliveryStatusUpdatedAt ?? "");
    });
}

export async function assignRiderToCargo(
  reference: string,
  riderId: string,
  agentId: string,
  options?: { dispatch?: boolean }
) {
  await ensureSeeded();
  const store = await getStore();
  const booking = store.bookings.find((b) => b.reference === reference);
  if (!booking || booking.bookingType !== "cargo") {
    return { error: "Cargo booking not found.", status: 404 as const };
  }
  if (booking.status !== "paid") {
    return { error: "Only paid cargo can be assigned a rider.", status: 409 as const };
  }

  const cargo = store.cargoDetails.find((c) => c.bookingId === booking.id);
  if (!cargo?.lastMileDelivery) {
    return { error: "This shipment does not include last mile delivery.", status: 400 as const };
  }

  const deliveryStatus = (cargo.deliveryStatus ?? "confirmed") as CargoDeliveryStatus;
  if (deliveryStatus === "delivered" || deliveryStatus === "failed_delivery") {
    return { error: "Delivery is already closed.", status: 409 as const };
  }
  if (!["arrived", "out_for_delivery"].includes(deliveryStatus) && !options?.dispatch) {
    return {
      error: "Rider can be assigned once cargo has arrived at the destination hub.",
      status: 409 as const,
    };
  }

  const rider = (store.riders ?? []).find((r) => r.id === riderId && r.isActive);
  if (!rider) return { error: "Rider not found.", status: 404 as const };
  if (rider.status === "off_duty") {
    return { error: `${rider.name} is off duty. Choose another rider.`, status: 409 as const };
  }

  const trip = store.trips.find((t) => t.id === booking.tripId)!;
  const route = store.routes.find((r) => r.id === trip.routeId)!;
  if (rider.city !== route.destination) {
    return {
      error: `${rider.name} operates in ${rider.city}, but this delivery is in ${route.destination}.`,
      status: 409 as const,
    };
  }

  const now = new Date().toISOString();
  const previousRiderId = cargo.riderId;

  await mutateStore((s) => {
    const c = s.cargoDetails.find((x) => x.bookingId === booking.id)!;
    if (previousRiderId && previousRiderId !== riderId) {
      syncRiderAvailabilityInStore(s, previousRiderId);
    }
    c.riderId = riderId;
    c.riderAssignedAt = now;

    const assignedRider = (s.riders ?? []).find((r) => r.id === riderId)!;
    if (deliveryStatus === "out_for_delivery" || options?.dispatch) {
      assignedRider.status = "on_delivery";
    }
  });

  await logAudit("cargo_delivery", booking.id, "rider_assigned", "agent", agentId, {
    reference,
    riderId,
    riderName: rider.name,
  });

  if (options?.dispatch) {
    if (deliveryStatus !== "arrived") {
      return {
        error: "Cargo must be at the destination hub before dispatching to rider.",
        status: 409 as const,
      };
    }
    return updateCargoDeliveryStatus(reference, agentId, "out_for_delivery");
  }

  const refreshedStore = await getStore();
  const updatedRider = mapRiderRow(
    (refreshedStore.riders ?? []).find((r) => r.id === riderId)!,
    refreshedStore
  );

  return {
    data: {
      reference,
      riderId,
      rider: updatedRider,
      message: `${rider.name} assigned to ${reference}.`,
    },
    status: 200 as const,
  };
}

export type CargoDeliveryRow = Awaited<ReturnType<typeof listCargoDeliveries>>[number];
export type LastMileDeliveryRow = Awaited<ReturnType<typeof listLastMileDeliveries>>[number];
export type RiderSummary = Awaited<ReturnType<typeof listRiders>>[number];
export type DeliveryMessageRecord = Awaited<
  ReturnType<typeof getDeliveryMessagesForBooking>
>[number];
