import { getStore, mutateStore, ensureSeeded } from "@/db";
import crypto from "crypto";
import {
  validateBookingInput,
  generateBookingReference,
  normalizeKenyanPhone,
  calculateFare,
  getLocalDateString,
  formatTicketSms,
  type CreateBookingInput,
} from "@/lib/booking";
import { nairobiKisumuRoute } from "@/lib/route";
import { parseSeats, ALL_SEATS } from "@/lib/seats";
import { initiateStkPush, parseMpesaCallback, type MpesaCallbackBody } from "@/lib/mpesa";
import {
  validateCargoBookingInput,
  calculateCargoFare,
  generateCargoReference,
  formatCargoWaybillSms,
  normalizeIdNumber,
  CARGO_CAPACITY_KG,
  type CreateCargoBookingInput,
} from "@/lib/cargo";
import { logSms } from "@/lib/sms";
import { logAudit } from "@/lib/audit";
import {
  getDeliveryMessagesForBooking,
  listCargoDeliveries,
  listLastMileDeliveries,
  onCargoPaymentConfirmed,
} from "@/lib/cargo-delivery";

export {
  assignRiderToCargo,
  getDeliveryMessagesForBooking,
  listCargoDeliveries,
  listLastMileDeliveries,
  listRiders,
  updateCargoDeliveryStatus,
} from "@/lib/cargo-delivery";
export type {
  CargoDeliveryRow,
  DeliveryMessageRecord,
  LastMileDeliveryRow,
  RiderSummary,
} from "@/lib/cargo-delivery";

export function getOrCreateTrip(routeId: string, date: string, time: string) {
  ensureSeeded();
  const store = getStore();
  const existing = store.trips.find(
    (t) => t.routeId === routeId && t.travelDate === date && t.departureTime === time
  );
  if (existing) return existing;

  const now = new Date().toISOString();
  const trip = {
    id: crypto.randomUUID(),
    routeId,
    travelDate: date,
    departureTime: time,
    vehicleModel: nairobiKisumuRoute.vehicle,
    seatCapacity: ALL_SEATS.length,
    cargoCapacityKg: 500,
    status: "scheduled",
    createdAt: now,
    updatedAt: now,
  };

  mutateStore((s) => {
    s.trips.push(trip);
  });

  return trip;
}

export function getBookedSeats(tripId: string): string[] {
  ensureSeeded();
  const store = getStore();
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const allSeats: string[] = [];
  for (const b of store.bookings.filter((bk) => bk.tripId === tripId)) {
    if (b.status === "paid" || (b.status === "pending" && b.createdAt > tenMinutesAgo)) {
      allSeats.push(...parseSeats(b.seats));
    }
  }
  return allSeats;
}

export function areSeatsAvailable(tripId: string, seats: string[]): boolean {
  const booked = new Set(getBookedSeats(tripId));
  return seats.every((s) => !booked.has(s));
}

function upsertCustomer(name: string, phone: string, email?: string): string {
  const phoneE164 = normalizeKenyanPhone(phone)!;
  const now = new Date().toISOString();
  const store = getStore();
  const existing = store.customers.find((c) => c.phoneE164 === phoneE164);

  if (existing) {
    mutateStore((s) => {
      const c = s.customers.find((x) => x.id === existing.id)!;
      c.name = name;
      c.email = email ?? c.email;
      c.updatedAt = now;
    });
    return existing.id;
  }

  const id = crypto.randomUUID();
  mutateStore((s) => {
    s.customers.push({ id, phoneE164, name, email, createdAt: now, updatedAt: now });
  });
  return id;
}

export function createBooking(input: CreateBookingInput) {
  const error = validateBookingInput(input);
  if (error) return { error, status: 400 as const };

  const trip = getOrCreateTrip(input.routeId, input.date, input.time);
  if (!areSeatsAvailable(trip.id, input.seats)) {
    return {
      error: "One or more selected seats are no longer available. Please choose different seats.",
      status: 409 as const,
    };
  }

  const now = new Date().toISOString();
  const customerId = upsertCustomer(input.name, input.phone, input.email);
  const bookingId = crypto.randomUUID();
  const reference = generateBookingReference();

  const booking = {
    id: bookingId,
    reference,
    tripId: trip.id,
    customerId,
    agentId: input.agentId,
    bookingType: "passenger",
    channel: input.channel ?? "web",
    passengerCount: input.passengers,
    seats: JSON.stringify(input.seats),
    farePerUnit: nairobiKisumuRoute.fare,
    totalAmount: calculateFare(input.passengers),
    status: "pending",
    contactName: input.name.trim(),
    contactPhone: normalizeKenyanPhone(input.phone)!,
    contactIdNumber: input.idNumber.trim().replace(/\s/g, "").toUpperCase(),
    contactEmail: input.email?.trim(),
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };

  mutateStore((s) => {
    s.bookings.push(booking);
  });

  logAudit("booking", bookingId, "created", input.agentId ? "agent" : "customer", input.agentId, {
    reference,
    seats: input.seats,
  });

  return {
    data: {
      bookingId,
      reference,
      total: calculateFare(input.passengers),
      status: "pending" as const,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    },
    status: 201 as const,
  };
}

export function completePayment(
  bookingId: string,
  method: "mpesa" | "cash",
  options: {
    agentId?: string;
    cashSessionId?: string;
    isDemo?: boolean;
    mpesaReceipt?: string;
    existingPaymentId?: string;
  } = {}
) {
  const store = getStore();
  const booking = store.bookings.find((b) => b.id === bookingId);
  if (!booking) return { error: "Booking not found.", status: 404 as const };
  if (booking.status === "paid") return { error: "Booking already paid.", status: 409 as const };

  const now = new Date().toISOString();
  const receipt =
    method === "mpesa"
      ? options.mpesaReceipt ??
        (options.isDemo
          ? `DEMO${Date.now().toString().slice(-8)}`
          : `MP${Date.now().toString().slice(-8)}`)
      : `CSH-${now.slice(0, 10).replace(/-/g, "")}-${Math.floor(Math.random() * 9999)
          .toString()
          .padStart(4, "0")}`;

  const paymentId = options.existingPaymentId ?? crypto.randomUUID();
  const trip = store.trips.find((t) => t.id === booking.tripId)!;
  const route = store.routes.find((r) => r.id === trip.routeId)!;
  const seats = parseSeats(booking.seats);
  const cargo = store.cargoDetails.find((c) => c.bookingId === bookingId);

  const smsBody =
    booking.bookingType === "cargo" && cargo
      ? formatCargoWaybillSms({
          reference: booking.reference,
          from: route.origin,
          to: route.destination,
          date: trip.travelDate,
          time: trip.departureTime,
          weightKg: cargo.weightKg,
          description: cargo.description,
          total: booking.totalAmount,
          receiverName: cargo.receiverName,
          lastMileDelivery: cargo.lastMileDelivery,
          deliveryAddress: cargo.deliveryAddress,
        })
      : formatTicketSms({
          reference: booking.reference,
          from: route.origin,
          to: route.destination,
          date: trip.travelDate,
          time: trip.departureTime,
          seats,
          total: booking.totalAmount,
        });

  mutateStore((s) => {
    if (options.existingPaymentId) {
      const p = s.payments.find((x) => x.id === options.existingPaymentId)!;
      p.status = "completed";
      p.mpesaReceipt = method === "mpesa" ? receipt : undefined;
      p.completedAt = now;
    } else {
      s.payments.push({
        id: paymentId,
        bookingId,
        method,
        amount: booking.totalAmount,
        status: "completed",
        idempotencyKey: crypto.randomUUID(),
        mpesaReceipt: method === "mpesa" ? receipt : undefined,
        mpesaPhone: method === "mpesa" ? booking.contactPhone : undefined,
        cashSessionId: options.cashSessionId,
        isDemo: options.isDemo ?? false,
        completedAt: now,
        createdAt: now,
      });
    }

    const bk = s.bookings.find((b) => b.id === bookingId)!;
    bk.status = "paid";
    bk.paidAt = now;
    bk.updatedAt = now;

    s.tickets.push({
      id: crypto.randomUUID(),
      bookingId,
      ticketCode: booking.reference,
      status: "valid",
      smsSentAt: now,
      smsBody,
      createdAt: now,
    });

    if (options.cashSessionId) {
      const session = s.cashSessions.find((cs) => cs.id === options.cashSessionId);
      if (session) session.cashCollected += booking.totalAmount;
    }

    if (booking.bookingType === "cargo" && cargo) {
      const c = s.cargoDetails.find((x) => x.bookingId === bookingId)!;
      c.deliveryStatus = "confirmed";
      c.deliveryStatusUpdatedAt = now;
    }
  });

  logAudit("payment", paymentId, "completed", options.agentId ? "agent" : "system", options.agentId, {
    method,
    receipt,
  });

  logSms({
    phone: booking.contactPhone,
    body: smsBody,
    reference: booking.reference,
    bookingId,
    stage: booking.bookingType === "cargo" ? "confirmed" : undefined,
    recipient: booking.bookingType === "cargo" ? "sender" : undefined,
  });

  if (booking.bookingType === "cargo" && cargo) {
    onCargoPaymentConfirmed({
      bookingId,
      reference: booking.reference,
      smsBody,
      senderPhone: cargo.senderPhone,
      agentId: options.agentId,
    });
  }

  return {
    data: {
      status: "success" as const,
      reference: booking.reference,
      mpesaReceipt: method === "mpesa" ? receipt : undefined,
      cashReceipt: method === "cash" ? receipt : undefined,
      paidAt: now,
      demo: options.isDemo ?? false,
      smsBody,
    },
    status: 200 as const,
  };
}

export function listBookings(filters?: {
  date?: string;
  status?: string;
  channel?: string;
  search?: string;
}) {
  ensureSeeded();
  const store = getStore();

  let results = store.bookings
    .map((booking) => ({
      booking,
      trip: store.trips.find((t) => t.id === booking.tripId)!,
      route: store.routes.find((r) => r.id === store.trips.find((t) => t.id === booking.tripId)?.routeId)!,
      cargo:
        booking.bookingType === "cargo"
          ? store.cargoDetails.find((c) => c.bookingId === booking.id)
          : undefined,
    }))
    .filter((r) => r.trip && r.route)
    .sort((a, b) => b.booking.createdAt.localeCompare(a.booking.createdAt));

  if (filters?.date) results = results.filter((r) => r.trip.travelDate === filters.date);
  if (filters?.status) results = results.filter((r) => r.booking.status === filters.status);
  if (filters?.channel) results = results.filter((r) => r.booking.channel === filters.channel);
  if (filters?.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(
      (r) =>
        r.booking.reference.toLowerCase().includes(q) ||
        r.booking.contactName.toLowerCase().includes(q) ||
        r.booking.contactPhone.includes(q) ||
        (r.booking.contactIdNumber?.toLowerCase().includes(q) ?? false)
    );
  }

  return results;
}

export function getDashboardStats() {
  ensureSeeded();
  const today = getLocalDateString();
  const store = getStore();
  const allBookings = store.bookings;
  const passengerBookings = allBookings.filter((b) => b.bookingType !== "cargo");
  const cargoBookings = allBookings.filter((b) => b.bookingType === "cargo");

  return {
    totalBookings: allBookings.length,
    todayBookings: passengerBookings.filter((b) => b.createdAt.startsWith(today)).length,
    paidBookings: allBookings.filter((b) => b.status === "paid").length,
    pendingBookings: allBookings.filter((b) => b.status === "pending").length,
    totalRevenue: allBookings
      .filter((b) => b.status === "paid")
      .reduce((sum, b) => sum + b.totalAmount, 0),
    agentBookings: allBookings.filter((b) => b.channel.startsWith("agent_")).length,
    cargoBookings: cargoBookings.length,
    todayCargo: cargoBookings.filter((b) => b.createdAt.startsWith(today)).length,
    activeDeliveries: listCargoDeliveries({ status: "active" }).length,
    lastMileReady: listLastMileDeliveries({ bucket: "ready" }).length,
  };
}

export function getOpenCashSession(agentId: string) {
  return getStore().cashSessions.find(
    (s) => s.agentId === agentId && s.status === "open"
  );
}

export function openCashSession(agentId: string, openingFloat: number) {
  if (getOpenCashSession(agentId)) {
    return { error: "You already have an open cash session.", status: 409 as const };
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  mutateStore((s) => {
    s.cashSessions.push({
      id,
      agentId,
      openedAt: now,
      openingFloat,
      cashCollected: 0,
      status: "open",
    });
  });

  return { data: { id, openedAt: now, openingFloat, cashCollected: 0, status: "open" }, status: 201 as const };
}

export function closeCashSession(
  sessionId: string,
  agentId: string,
  actualCash: number,
  notes?: string
) {
  const store = getStore();
  const session = store.cashSessions.find((s) => s.id === sessionId);
  if (!session || session.agentId !== agentId) {
    return { error: "Session not found.", status: 404 as const };
  }
  if (session.status === "closed") {
    return { error: "Session already closed.", status: 409 as const };
  }

  const expected = session.openingFloat + session.cashCollected;
  const discrepancy = actualCash - expected;
  const now = new Date().toISOString();

  mutateStore((s) => {
    const cs = s.cashSessions.find((x) => x.id === sessionId)!;
    cs.status = "closed";
    cs.closedAt = now;
    cs.actualCash = actualCash;
    cs.discrepancy = discrepancy;
    cs.notes = notes;
  });

  return {
    data: { expectedCash: expected, actualCash, discrepancy, closedAt: now },
    status: 200 as const,
  };
}

export function getRoutes() {
  ensureSeeded();
  return getStore().routes.map((route) => ({
    id: route.id,
    label: route.label,
    from: route.origin,
    to: route.destination,
    duration: `${Math.floor(route.durationMinutes / 60)}h ${route.durationMinutes % 60}m`,
    distance: `~${route.distanceKm} km`,
    vehicle: route.vehicleModel,
    fare: route.farePerSeat,
    departures: nairobiKisumuRoute.departures,
    status: route.status === "current" ? "current" : route.status,
  }));
}

export function getTripById(tripId: string) {
  ensureSeeded();
  return getStore().trips.find((t) => t.id === tripId) ?? null;
}

export function listTripsForRoute(routeId: string, date: string) {
  ensureSeeded();
  const store = getStore();
  const route = store.routes.find((r) => r.id === routeId);
  if (!route) return { error: "Route not found.", status: 404 as const };

  const departures = store.departures.filter((d) => d.routeId === routeId);
  const trips = departures.map((dep) => {
    const trip = getOrCreateTrip(routeId, date, dep.departureTime);
    const bookedSeats = getBookedSeats(trip.id);
    return {
      tripId: trip.id,
      departureTime: dep.departureTime,
      seatsAvailable: trip.seatCapacity - bookedSeats.length,
      seatCapacity: trip.seatCapacity,
      cargoAvailableKg: getCargoAvailableKg(trip.id),
      cargoCapacityKg: trip.cargoCapacityKg ?? CARGO_CAPACITY_KG,
      status: trip.status,
    };
  });

  return {
    data: { routeId, date, trips },
    status: 200 as const,
  };
}

export function getCargoBookedKg(tripId: string): number {
  ensureSeeded();
  const store = getStore();
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  let total = 0;
  for (const b of store.bookings.filter((bk) => bk.tripId === tripId && bk.bookingType === "cargo")) {
    if (b.status === "paid" || (b.status === "pending" && b.createdAt > tenMinutesAgo)) {
      const details = store.cargoDetails.find((c) => c.bookingId === b.id);
      if (details) total += details.weightKg;
    }
  }
  return total;
}

export function getCargoAvailableKg(tripId: string): number {
  const trip = getTripById(tripId);
  if (!trip) return 0;
  return (trip.cargoCapacityKg ?? CARGO_CAPACITY_KG) - getCargoBookedKg(tripId);
}

export function getBookingByReference(reference: string) {
  ensureSeeded();
  const store = getStore();
  const booking = store.bookings.find((b) => b.reference === reference);
  if (!booking) return { error: "Booking not found.", status: 404 as const };

  const trip = store.trips.find((t) => t.id === booking.tripId)!;
  const route = store.routes.find((r) => r.id === trip.routeId)!;
  const payment = store.payments.find((p) => p.bookingId === booking.id && p.status === "completed");
  const ticket = store.tickets.find((t) => t.bookingId === booking.id);
  const cargo = store.cargoDetails.find((c) => c.bookingId === booking.id);

  return {
    data: {
      id: booking.id,
      reference: booking.reference,
      bookingType: booking.bookingType,
      routeId: route.id,
      from: route.origin,
      to: route.destination,
      date: trip.travelDate,
      time: trip.departureTime,
      passengers: booking.passengerCount,
      seats: booking.bookingType === "passenger" ? parseSeats(booking.seats) : undefined,
      cargo: cargo
        ? {
          weightKg: cargo.weightKg,
          description: cargo.description,
          senderName: cargo.senderName,
          senderPhone: cargo.senderPhone,
          receiverName: cargo.receiverName,
          receiverPhone: cargo.receiverPhone,
          senderIdNumber: cargo.senderIdNumber,
          receiverIdNumber: cargo.receiverIdNumber,
          lastMileDelivery: cargo.lastMileDelivery,
          deliveryAddress: cargo.deliveryAddress,
          deliveryStatus: cargo.deliveryStatus,
          deliveryStatusUpdatedAt: cargo.deliveryStatusUpdatedAt,
          riderId: cargo.riderId,
          riderAssignedAt: cargo.riderAssignedAt,
          rider: cargo.riderId
            ? (() => {
                const r = store.riders.find((x) => x.id === cargo.riderId);
                return r
                  ? { id: r.id, name: r.name, phone: r.phone, vehicle: r.vehicle, city: r.city }
                  : undefined;
              })()
            : undefined,
        }
        : undefined,
      deliveryMessages:
        booking.bookingType === "cargo"
          ? getDeliveryMessagesForBooking(booking.id)
          : undefined,
      farePerUnit: booking.farePerUnit,
      total: booking.totalAmount,
      name: booking.contactName,
      phone: booking.contactPhone,
      idNumber: booking.contactIdNumber,
      status: booking.status,
      mpesaReceipt: payment?.mpesaReceipt,
      paidAt: booking.paidAt,
      createdAt: booking.createdAt,
      ticket: ticket
        ? { code: ticket.ticketCode, status: ticket.status, smsSentAt: ticket.smsSentAt }
        : undefined,
    },
    status: 200 as const,
  };
}

export async function processStkPayment(bookingId: string) {
  ensureSeeded();
  const store = getStore();
  const booking = store.bookings.find((b) => b.id === bookingId);
  if (!booking) return { error: "Booking not found.", status: 404 as const };
  if (booking.status === "paid") return { error: "Booking already paid.", status: 409 as const };

  const trip = store.trips.find((t) => t.id === booking.tripId)!;
  const route = store.routes.find((r) => r.id === trip.routeId)!;

  const pendingPayment = store.payments.find(
    (p) => p.bookingId === bookingId && p.status === "pending" && p.method === "mpesa"
  );
  if (pendingPayment) {
    return {
      data: {
        status: "pending" as const,
        reference: booking.reference,
        checkoutRequestId: pendingPayment.mpesaCheckoutId,
        message: "STK push already sent. Awaiting customer PIN.",
      },
      status: 200 as const,
    };
  }

  const stkResult = await initiateStkPush({
    id: booking.id,
    reference: booking.reference,
    total: booking.totalAmount,
    phone: booking.contactPhone,
    from: route.origin,
    to: route.destination,
  });

  if (stkResult.status === "failed") {
    return { error: stkResult.message, status: 422 as const };
  }

  if (stkResult.mode === "demo") {
    return completePayment(bookingId, "mpesa", { isDemo: true });
  }

  const now = new Date().toISOString();
  const paymentId = crypto.randomUUID();

  mutateStore((s) => {
    s.payments.push({
      id: paymentId,
      bookingId,
      method: "mpesa",
      amount: booking.totalAmount,
      status: "pending",
      idempotencyKey: crypto.randomUUID(),
      mpesaCheckoutId: stkResult.checkoutRequestId,
      mpesaPhone: booking.contactPhone,
      isDemo: false,
      createdAt: now,
    });
  });

  logAudit("payment", paymentId, "stk_initiated", "system", undefined, {
    checkoutRequestId: stkResult.checkoutRequestId,
  });

  return {
    data: {
      status: "pending" as const,
      reference: booking.reference,
      checkoutRequestId: stkResult.checkoutRequestId,
      message: stkResult.message,
      demo: false,
    },
    status: 200 as const,
  };
}

export function handleMpesaCallback(body: MpesaCallbackBody) {
  const parsed = parseMpesaCallback(body);
  if (!parsed) return { error: "Invalid callback payload.", status: 400 as const };

  ensureSeeded();
  const store = getStore();
  const payment = store.payments.find(
    (p) => p.mpesaCheckoutId === parsed.checkoutRequestId && p.method === "mpesa"
  );

  logAudit("payment", payment?.id ?? parsed.checkoutRequestId, "mpesa_callback", "webhook", undefined, body);

  if (!payment) {
    return { error: "Payment not found for checkout request.", status: 404 as const };
  }

  if (payment.status === "completed") {
    return { data: { status: "already_processed" }, status: 200 as const };
  }

  if (!parsed.success) {
    mutateStore((s) => {
      const p = s.payments.find((x) => x.id === payment.id)!;
      p.status = "failed";
      p.failureReason = parsed.resultDesc;
    });
    return { data: { status: "failed", reason: parsed.resultDesc }, status: 200 as const };
  }

  return completePayment(payment.bookingId, "mpesa", {
    isDemo: false,
    mpesaReceipt: parsed.mpesaReceipt,
    existingPaymentId: payment.id,
  });
}

export function getPaymentStatus(bookingId: string) {
  ensureSeeded();
  const store = getStore();
  const booking = store.bookings.find((b) => b.id === bookingId);
  if (!booking) return { error: "Booking not found.", status: 404 as const };

  const payment = store.payments
    .filter((p) => p.bookingId === bookingId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  return {
    data: {
      bookingId,
      reference: booking.reference,
      paymentStatus: payment?.status ?? "none",
      bookingStatus: booking.status,
      mpesaReceipt: payment?.mpesaReceipt,
    },
    status: 200 as const,
  };
}

export function createCargoBooking(input: CreateCargoBookingInput) {
  const error = validateCargoBookingInput(input);
  if (error) return { error, status: 400 as const };

  const trip = getOrCreateTrip(input.routeId, input.date, input.time);
  const available = getCargoAvailableKg(trip.id);
  if (input.weightKg > available) {
    return {
      error: `Only ${available.toFixed(1)} kg cargo capacity remaining on this departure.`,
      status: 409 as const,
    };
  }

  const now = new Date().toISOString();
  const customerId = upsertCustomer(input.senderName, input.senderPhone);
  const bookingId = crypto.randomUUID();
  const reference = generateCargoReference();
  const total = calculateCargoFare(input.weightKg, {
    lastMileDelivery: input.lastMileDelivery,
  });

  const booking = {
    id: bookingId,
    reference,
    tripId: trip.id,
    customerId,
    agentId: input.agentId,
    bookingType: "cargo",
    channel: input.channel ?? "web",
    passengerCount: undefined,
    seats: "[]",
    farePerUnit: calculateCargoFare(1),
    totalAmount: total,
    status: "pending",
    contactName: input.senderName.trim(),
    contactPhone: normalizeKenyanPhone(input.senderPhone)!,
    contactIdNumber: normalizeIdNumber(input.senderIdNumber),
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  };

  const cargoDetails = {
    id: crypto.randomUUID(),
    bookingId,
    weightKg: input.weightKg,
    description: input.description.trim(),
    senderName: input.senderName.trim(),
    senderPhone: normalizeKenyanPhone(input.senderPhone)!,
    senderIdNumber: normalizeIdNumber(input.senderIdNumber),
    receiverName: input.receiverName.trim(),
    receiverPhone: normalizeKenyanPhone(input.receiverPhone)!,
    receiverIdNumber: normalizeIdNumber(input.receiverIdNumber),
    isFragile: input.isFragile ?? false,
    lastMileDelivery: input.lastMileDelivery ?? false,
    deliveryAddress: input.lastMileDelivery ? input.deliveryAddress?.trim() : undefined,
  };

  mutateStore((s) => {
    s.bookings.push(booking);
    s.cargoDetails.push(cargoDetails);
  });

  logAudit("booking", bookingId, "cargo_created", input.agentId ? "agent" : "customer", input.agentId, {
    reference,
    weightKg: input.weightKg,
    lastMileDelivery: input.lastMileDelivery ?? false,
  });

  return {
    data: {
      bookingId,
      reference,
      total,
      status: "pending" as const,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    },
    status: 201 as const,
  };
}

export function listCustomers() {
  ensureSeeded();
  const store = getStore();

  return store.customers
    .map((customer) => {
      const customerBookings = store.bookings.filter((b) => b.customerId === customer.id);
      return {
        ...customer,
        bookingCount: customerBookings.length,
        paidCount: customerBookings.filter((b) => b.status === "paid").length,
        lastBooking: customerBookings.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0],
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getReconciliationReport(date: string) {
  ensureSeeded();
  const store = getStore();

  const dayPayments = store.payments.filter(
    (p) => p.createdAt.startsWith(date) || (p.completedAt?.startsWith(date) ?? false)
  );
  const mpesaPayments = dayPayments.filter((p) => p.method === "mpesa");
  const cashPayments = dayPayments.filter((p) => p.method === "cash" && p.status === "completed");

  const dayBookings = store.bookings.filter((b) => b.createdAt.startsWith(date));
  const paidBookings = store.bookings.filter(
    (b) => b.status === "paid" && (b.paidAt?.startsWith(date) ?? b.createdAt.startsWith(date))
  );

  const channels = ["web", "pwa", "agent_walkin", "agent_callin"] as const;
  const bookingsByChannel = Object.fromEntries(
    channels.map((ch) => [ch, dayBookings.filter((b) => b.channel === ch).length])
  );

  const dayTickets = store.tickets.filter((t) => t.createdAt.startsWith(date));
  const smsSent = dayTickets.filter((t) => t.smsSentAt?.startsWith(date)).length;

  const sessions = store.cashSessions.filter(
    (s) => s.openedAt.startsWith(date) || (s.closedAt?.startsWith(date) ?? false)
  );

  const completedWithoutTicket = store.payments
    .filter((p) => p.status === "completed" && (p.completedAt?.startsWith(date) ?? false))
    .filter((p) => !store.tickets.some((t) => t.bookingId === p.bookingId));

  const paidWithoutPayment = paidBookings.filter(
    (b) => !store.payments.some((p) => p.bookingId === b.id && p.status === "completed")
  );

  return {
    date,
    mpesa: {
      total: mpesaPayments.filter((p) => p.status === "completed").length,
      amount: mpesaPayments
        .filter((p) => p.status === "completed")
        .reduce((s, p) => s + p.amount, 0),
      failed: mpesaPayments.filter((p) => p.status === "failed").length,
      demo: mpesaPayments.filter((p) => p.isDemo && p.status === "completed").length,
      pending: mpesaPayments.filter((p) => p.status === "pending").length,
    },
    cash: {
      sessionsOpened: sessions.length,
      totalCollected: cashPayments.reduce((s, p) => s + p.amount, 0),
      discrepancies: sessions
        .filter((s) => s.discrepancy != null && s.discrepancy !== 0)
        .map((s) => ({
          sessionId: s.id,
          agentId: s.agentId,
          discrepancy: s.discrepancy!,
        })),
    },
    bookings: {
      created: dayBookings.length,
      paid: paidBookings.length,
      cancelled: dayBookings.filter((b) => b.status === "cancelled").length,
      refunded: dayBookings.filter((b) => b.status === "refunded").length,
      byChannel: bookingsByChannel,
      revenue: paidBookings.reduce((s, b) => s + b.totalAmount, 0),
    },
    tickets: {
      issued: dayTickets.length,
      smsSent,
      smsFailed: dayTickets.length - smsSent,
    },
    unmatched: {
      paymentsWithoutTickets: completedWithoutTicket.length,
      paidBookingsWithoutPayments: paidWithoutPayment.length,
    },
    agentSessions: sessions.map((s) => {
      const agent = store.agents.find((a) => a.id === s.agentId);
      return {
        agentName: agent?.name ?? "Unknown",
        openedAt: s.openedAt,
        closedAt: s.closedAt,
        openingFloat: s.openingFloat,
        cashCollected: s.cashCollected,
        expectedCash: s.openingFloat + s.cashCollected,
        actualCash: s.actualCash,
        discrepancy: s.discrepancy,
        status: s.status,
      };
    }),
  };
}

export function refundBooking(reference: string, agentId?: string) {
  ensureSeeded();
  const store = getStore();
  const booking = store.bookings.find((b) => b.reference === reference);
  if (!booking) return { error: "Booking not found.", status: 404 as const };
  if (booking.status === "refunded") {
    return { error: "Booking already refunded.", status: 409 as const };
  }
  if (booking.status === "cancelled") {
    return { error: "Booking already cancelled.", status: 409 as const };
  }

  const now = new Date().toISOString();
  const priorStatus = booking.status;

  mutateStore((s) => {
    const bk = s.bookings.find((b) => b.id === booking.id)!;
    bk.status = priorStatus === "paid" ? "refunded" : "cancelled";
    bk.cancelledAt = now;
    bk.updatedAt = now;

    const ticket = s.tickets.find((t) => t.bookingId === booking.id);
    if (ticket) ticket.status = "refunded";

    const payment = s.payments.find((p) => p.bookingId === booking.id && p.status === "completed");
    if (payment) payment.status = "reversed";
  });

  logAudit("booking", booking.id, "refunded", agentId ? "agent" : "system", agentId, {
    reference,
    priorStatus,
  });

  return {
    data: {
      reference,
      status: priorStatus === "paid" ? "refunded" : "cancelled",
      refundInitiated: priorStatus === "paid",
      message:
        priorStatus === "paid"
          ? "Marked refunded. Process M-Pesa reversal manually if applicable."
          : "Pending booking cancelled.",
    },
    status: 200 as const,
  };
}
