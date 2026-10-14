import { test, before, afterEach } from "node:test";
import assert from "node:assert/strict";

let handlers: Array<{ name: string; call: () => Promise<Response> }>;
let stkPost: (request: Request) => Promise<Response>;

function jsonRequest(url: string, body: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

before(async () => {
  delete process.env.DATABASE_URL;
  delete process.env.SUPABASE_DB_PASSWORD;
  delete process.env.BOOKING_ENABLED;
  const bookings = await import("../src/app/api/v1/bookings/route");
  const agentBookings = await import("../src/app/api/v1/agents/bookings/route");
  const cargo = await import("../src/app/api/v1/cargo/bookings/route");
  const stk = await import("../src/app/api/v1/payments/stk/route");
  const routeSeats = await import("../src/app/api/v1/routes/[routeId]/seats/route");
  const tripSeats = await import("../src/app/api/v1/trips/[tripId]/seats/route");
  const bookingByRef = await import("../src/app/api/v1/bookings/[reference]/route");
  const paymentStatus = await import("../src/app/api/v1/payments/[bookingId]/status/route");
  const cash = await import("../src/app/api/v1/payments/cash/route");
  const routeTrips = await import("../src/app/api/v1/routes/[routeId]/trips/route");
  stkPost = stk.POST;

  handlers = [
    { name: "POST /bookings", call: () => bookings.POST(jsonRequest("http://localhost/api/v1/bookings", {})) },
    {
      name: "POST /agents/bookings",
      call: () => agentBookings.POST(jsonRequest("http://localhost/api/v1/agents/bookings", {})),
    },
    { name: "POST /cargo/bookings", call: () => cargo.POST(jsonRequest("http://localhost/api/v1/cargo/bookings", {})) },
    {
      name: "POST /payments/stk",
      call: () => stk.POST(jsonRequest("http://localhost/api/v1/payments/stk", { bookingId: "x" })),
    },
    {
      name: "GET /routes/:id/seats",
      call: () =>
        routeSeats.GET(
          new Request("http://localhost/api/v1/routes/nairobi-kisumu/seats?date=2030-01-01&time=08:00"),
          { params: Promise.resolve({ routeId: "nairobi-kisumu" }) }
        ),
    },
    {
      name: "GET /trips/:id/seats",
      call: () =>
        tripSeats.GET(new Request("http://localhost/api/v1/trips/t1/seats"), {
          params: Promise.resolve({ tripId: "t1" }),
        }),
    },
    {
      name: "GET /bookings/:reference",
      call: () =>
        bookingByRef.GET(new Request("http://localhost/api/v1/bookings/PF-000001"), {
          params: Promise.resolve({ reference: "PF-000001" }),
        }),
    },
    {
      name: "GET /payments/:bookingId/status",
      call: () =>
        paymentStatus.GET(new Request("http://localhost/api/v1/payments/b1/status"), {
          params: Promise.resolve({ bookingId: "b1" }),
        }),
    },
    {
      name: "POST /payments/cash",
      call: () => cash.POST(jsonRequest("http://localhost/api/v1/payments/cash", { bookingId: "b1" })),
    },
    {
      name: "GET /routes/:id/trips",
      call: () =>
        routeTrips.GET(new Request("http://localhost/api/v1/routes/nairobi-kisumu/trips?date=2030-01-01"), {
          params: Promise.resolve({ routeId: "nairobi-kisumu" }),
        }),
    },
  ];
});

afterEach(() => {
  delete process.env.BOOKING_ENABLED;
});

test("booking, seat and STK routes return 410 when BOOKING_ENABLED is unset", async () => {
  for (const h of handlers) {
    const res = await h.call();
    assert.equal(res.status, 410, h.name);
    const body = await res.json();
    assert.equal(body.error.code, "BOOKING_RETIRED", h.name);
  }
});

test("BOOKING_ENABLED=false also returns 410", async () => {
  process.env.BOOKING_ENABLED = "false";
  for (const h of handlers) {
    assert.equal((await h.call()).status, 410, h.name);
  }
});

test("STK route is rate limited when booking is enabled", async () => {
  process.env.BOOKING_ENABLED = "true";
  const statuses: number[] = [];
  for (let i = 0; i < 7; i++) {
    const res = await stkPost(
      jsonRequest("http://localhost/api/v1/payments/stk", {}, { "x-forwarded-for": "203.0.113.7" })
    );
    statuses.push(res.status);
  }
  assert.deepEqual(statuses.slice(0, 5), [400, 400, 400, 400, 400]);
  assert.equal(statuses[5], 429);
  assert.equal(statuses[6], 429);
});
