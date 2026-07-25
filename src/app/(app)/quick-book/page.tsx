"use client";

import { useState, useEffect, useCallback } from "react";
import { ALL_SEATS, type SeatId } from "@/lib/seats";
import { nairobiKisumuRoute } from "@/lib/route";
import { getLocalDateString, formatCurrency } from "@/lib/booking";
import { mpesaLabel } from "@/lib/payment-ui";
import { usePaymentMode } from "@/hooks/usePaymentMode";
import { useMpesaPaymentPoll } from "@/hooks/useMpesaPaymentPoll";

type SeatStatus = "available" | "occupied" | "selected";

export default function QuickBookPage() {
  const paymentMode = usePaymentMode();
  const [date, setDate] = useState(getLocalDateString());
  const [time, setTime] = useState<string>(nairobiKisumuRoute.departures[0]);
  const [bookedSeats, setBookedSeats] = useState<string[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [email, setEmail] = useState("");
  const [channel, setChannel] = useState<"agent_walkin" | "agent_callin">("agent_walkin");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "mpesa">("cash");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{
    reference: string;
    total: number;
    smsBody?: string;
    receipt?: string;
    demo?: boolean;
  } | null>(null);
  const [pendingPayment, setPendingPayment] = useState<{
    bookingId: string;
    reference: string;
    total: number;
    message?: string;
  } | null>(null);

  const loadSeats = useCallback(async () => {
    const res = await fetch(
      `/api/v1/routes/nairobi-kisumu/seats?date=${date}&time=${time}`
    );
    const json = await res.json();
    setBookedSeats(json.data?.bookedSeats ?? []);
    setSelectedSeats([]);
  }, [date, time]);

  useEffect(() => {
    loadSeats();
  }, [loadSeats]);

  useMpesaPaymentPoll(pendingPayment, {
    onPaid: (data) => {
      setSuccess({
        reference: data.reference,
        total: data.total,
        receipt: data.mpesaReceipt,
        demo: data.demo,
      });
      setPendingPayment(null);
      setSelectedSeats([]);
      setName("");
      setPhone("");
      setIdNumber("");
      setEmail("");
      setNotes("");
      loadSeats();
    },
    onFailed: (message) => {
      setError(message);
      setPendingPayment(null);
    },
    onTimeout: (message) => {
      setError(message);
      setPendingPayment(null);
    },
  });

  function getSeatStatus(seatId: string): SeatStatus {
    if (selectedSeats.includes(seatId)) return "selected";
    if (bookedSeats.includes(seatId)) return "occupied";
    return "available";
  }

  function toggleSeat(seatId: SeatId) {
    const status = getSeatStatus(seatId);
    if (status === "occupied") return;
    setSelectedSeats((prev) =>
      prev.includes(seatId) ? prev.filter((s) => s !== seatId) : [...prev, seatId]
    );
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedSeats.length === 0) {
      setError("Select at least one seat.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess(null);

    const res = await fetch("/api/v1/agents/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        routeId: "nairobi-kisumu",
        date,
        time,
        passengers: selectedSeats.length,
        seats: selectedSeats,
        name,
        phone,
        idNumber,
        email: email || undefined,
        channel,
        paymentMethod,
        notes: notes || undefined,
      }),
    });

    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.error?.message ?? json.error ?? "Booking failed.");
      return;
    }

    if (json.data.status === "pending" && paymentMethod === "mpesa") {
      setPendingPayment({
        bookingId: json.data.bookingId,
        reference: json.data.reference,
        total: json.data.total,
        message: json.data.message,
      });
      return;
    }

    setSuccess({
      reference: json.data.reference,
      total: json.data.total,
      smsBody: json.data.smsBody,
      receipt: json.data.receipt,
      demo: json.data.demo,
    });
    setSelectedSeats([]);
    setName("");
    setPhone("");
    setIdNumber("");
    setEmail("");
    setNotes("");
    loadSeats();
  }

  const total = selectedSeats.length * nairobiKisumuRoute.fare;

  if (pendingPayment) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Awaiting M-Pesa payment</h1>
        </div>
        <div className="card max-w-lg">
          <div className="text-amber-700 font-semibold text-lg mb-2">
            STK push sent — enter PIN on customer phone
          </div>
          <p className="text-sm text-gray-600 mb-4">
            {pendingPayment.message ??
              "Ask the customer to check their phone and enter their M-Pesa PIN."}
          </p>
          <table className="w-full text-sm mb-4">
            <tbody>
              <tr>
                <td className="py-1 text-gray-500 w-32">Reference</td>
                <td className="py-1 font-mono font-bold">{pendingPayment.reference}</td>
              </tr>
              <tr>
                <td className="py-1 text-gray-500">Amount</td>
                <td className="py-1 font-medium">{formatCurrency(pendingPayment.total)}</td>
              </tr>
              <tr>
                <td className="py-1 text-gray-500">Phone</td>
                <td className="py-1 font-medium">{phone}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-gray-500 animate-pulse">Waiting for payment confirmation…</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Booking confirmed</h1>
        </div>
        <div className="card max-w-lg">
          <div className="text-green-700 font-semibold text-lg mb-2">Ticket issued</div>
          <table className="w-full text-sm mb-4">
            <tbody>
              <tr>
                <td className="py-1 text-gray-500 w-32">Reference</td>
                <td className="py-1 font-mono font-bold">{success.reference}</td>
              </tr>
              <tr>
                <td className="py-1 text-gray-500">Total</td>
                <td className="py-1 font-medium">{formatCurrency(success.total)}</td>
              </tr>
              {success.receipt && (
                <tr>
                  <td className="py-1 text-gray-500">Receipt</td>
                  <td className="py-1 font-mono text-xs">{success.receipt}</td>
                </tr>
              )}
            </tbody>
          </table>
          {success.smsBody && (
            <div className="bg-gray-50 border border-gray-200 rounded p-3 text-xs whitespace-pre-line text-gray-700 mb-4">
              {success.smsBody}
            </div>
          )}
          {success.demo && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2 mb-4">
              Demo payment — no real M-Pesa charge. Set <code className="font-mono">DEMO_PAYMENT=false</code> in CMS
              .env for live STK.
            </p>
          )}
          <button className="btn btn-primary" onClick={() => setSuccess(null)}>
            Book another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Quick Book</h1>
        <p className="text-sm text-gray-500 mt-1">
          Walk-in and call-in ticketing · Nairobi – Kisumu
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: trip + seats */}
          <div className="space-y-4">
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Trip details</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Date</label>
                  <input
                    type="date"
                    className="input"
                    value={date}
                    min={getLocalDateString()}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Departure
                  </label>
                  <select
                    className="input"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                  >
                    {nairobiKisumuRoute.departures.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Channel</label>
                  <select
                    className="input"
                    value={channel}
                    onChange={(e) =>
                      setChannel(e.target.value as "agent_walkin" | "agent_callin")
                    }
                  >
                    <option value="agent_walkin">Walk-in</option>
                    <option value="agent_callin">Call-in</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Fare</label>
                  <div className="input bg-gray-50 text-gray-600">
                    {formatCurrency(nairobiKisumuRoute.fare)} / seat
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-gray-900">Seat selection</h2>
                <span className="text-xs text-gray-500">
                  {selectedSeats.length} selected · {bookedSeats.length} booked
                </span>
              </div>

              <div className="text-center text-xs text-gray-400 mb-2">Front of coach</div>

              <div className="space-y-1.5">
                {Array.from({ length: 12 }, (_, i) => i + 1).map((row) => (
                  <div key={row} className="flex items-center justify-center gap-2">
                    <span className="w-6 text-xs text-gray-400 text-right">{row}</span>
                    <div className="flex gap-1.5">
                      {(["A", "B"] as const).map((letter) => {
                        const id = `${row}${letter}` as SeatId;
                        const status = getSeatStatus(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => toggleSeat(id)}
                            disabled={status === "occupied"}
                            className={`w-10 h-9 rounded text-xs font-medium border transition-colors ${
                              status === "selected"
                                ? "bg-green-700 text-white border-green-700"
                                : status === "occupied"
                                  ? "bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed"
                                  : "bg-white text-gray-700 border-gray-300 hover:border-green-500"
                            }`}
                          >
                            {letter}
                          </button>
                        );
                      })}
                    </div>
                    <div className="w-4" />
                    <div className="flex gap-1.5">
                      {(["C", "D"] as const).map((letter) => {
                        const id = `${row}${letter}` as SeatId;
                        const status = getSeatStatus(id);
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => toggleSeat(id)}
                            disabled={status === "occupied"}
                            className={`w-10 h-9 rounded text-xs font-medium border transition-colors ${
                              status === "selected"
                                ? "bg-green-700 text-white border-green-700"
                                : status === "occupied"
                                  ? "bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed"
                                  : "bg-white text-gray-700 border-gray-300 hover:border-green-500"
                            }`}
                          >
                            {letter}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-4 mt-3 text-xs text-gray-500 justify-center">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 border border-gray-300 rounded bg-white" /> Available
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-green-700" /> Selected
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-gray-100 border border-gray-200" /> Booked
                </span>
              </div>
            </div>
          </div>

          {/* Right: customer + payment */}
          <div className="space-y-4">
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Customer details</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Full name *
                  </label>
                  <input
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    placeholder="Jane Wanjiku"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Phone *
                  </label>
                  <input
                    className="input"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    placeholder="0712 345 678"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    National ID / Passport No. *
                  </label>
                  <input
                    className="input"
                    value={idNumber}
                    onChange={(e) => setIdNumber(e.target.value.toUpperCase())}
                    required
                    placeholder="e.g. 12345678 or AB1234567"
                    minLength={6}
                    maxLength={20}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
                  <input
                    type="email"
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="optional"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <input
                    className="input"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Agent notes (optional)"
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Payment</h2>
              <div className="space-y-3">
                <div className="flex gap-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === "cash"}
                      onChange={() => setPaymentMethod("cash")}
                    />
                    Cash
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="payment"
                      checked={paymentMethod === "mpesa"}
                      onChange={() => setPaymentMethod("mpesa")}
                    />
                    {mpesaLabel(paymentMode)}
                  </label>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded p-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">
                      {selectedSeats.length} seat{selectedSeats.length !== 1 ? "s" : ""} ×{" "}
                      {formatCurrency(nairobiKisumuRoute.fare)}
                    </span>
                    <span className="font-bold text-lg">{formatCurrency(total)}</span>
                  </div>
                  {selectedSeats.length > 0 && (
                    <div className="text-xs text-gray-500 mt-1">
                      Seats: {selectedSeats.join(", ")}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              className="btn btn-primary w-full py-3"
              disabled={loading || selectedSeats.length === 0}
            >
              {loading
                ? "Processing…"
                : `Confirm booking · ${formatCurrency(total)}`}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
