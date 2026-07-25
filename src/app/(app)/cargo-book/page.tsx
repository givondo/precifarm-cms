"use client";

import { useState, useEffect, useCallback } from "react";
import { nairobiKisumuRoute } from "@/lib/route";
import { getLocalDateString, formatCurrency } from "@/lib/booking";
import {
  CARGO_CAPACITY_KG,
  CARGO_FARE_PER_KG,
  CARGO_VEHICLE,
  LAST_MILE_DELIVERY_FEE,
  calculateCargoFare,
} from "@/lib/cargo";
import { mpesaLabel } from "@/lib/payment-ui";
import { usePaymentMode } from "@/hooks/usePaymentMode";
import { useMpesaPaymentPoll } from "@/hooks/useMpesaPaymentPoll";

export default function CargoBookPage() {
  const paymentMode = usePaymentMode();
  const [date, setDate] = useState(getLocalDateString());
  const [time, setTime] = useState<string>(nairobiKisumuRoute.departures[0]);
  const [cargoAvailable, setCargoAvailable] = useState(CARGO_CAPACITY_KG);
  const [weightKg, setWeightKg] = useState("10");
  const [description, setDescription] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [senderIdNumber, setSenderIdNumber] = useState("");
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [receiverIdNumber, setReceiverIdNumber] = useState("");
  const [isFragile, setIsFragile] = useState(false);
  const [lastMileDelivery, setLastMileDelivery] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
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

  const loadCapacity = useCallback(async () => {
    const res = await fetch(`/api/v1/routes/nairobi-kisumu/trips?date=${date}`);
    const json = await res.json();
    const trip = json.data?.trips?.find((t: { departureTime: string }) => t.departureTime === time);
    setCargoAvailable(trip?.cargoAvailableKg ?? CARGO_CAPACITY_KG);
  }, [date, time]);

  useEffect(() => {
    loadCapacity();
  }, [loadCapacity]);

  useMpesaPaymentPoll(pendingPayment, {
    onPaid: (data) => {
      setSuccess({
        reference: data.reference,
        total: data.total,
        receipt: data.mpesaReceipt,
        demo: data.demo,
      });
      setPendingPayment(null);
      resetForm();
      loadCapacity();
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

  const weight = parseFloat(weightKg) || 0;
  const weightFare = Math.ceil(weight) * CARGO_FARE_PER_KG;
  const total = calculateCargoFare(weight, { lastMileDelivery });

  function resetForm() {
    setDescription("");
    setSenderName("");
    setSenderPhone("");
    setSenderIdNumber("");
    setReceiverName("");
    setReceiverPhone("");
    setReceiverIdNumber("");
    setLastMileDelivery(false);
    setDeliveryAddress("");
    setNotes("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(null);

    const res = await fetch("/api/v1/cargo/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        routeId: "nairobi-kisumu",
        date,
        time,
        weightKg: weight,
        description,
        senderName,
        senderPhone,
        senderIdNumber,
        receiverName,
        receiverPhone,
        receiverIdNumber,
        isFragile,
        lastMileDelivery,
        deliveryAddress: lastMileDelivery ? deliveryAddress : undefined,
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
    resetForm();
    loadCapacity();
  }

  if (pendingPayment) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Awaiting M-Pesa payment</h1>
        </div>
        <div className="card max-w-lg">
          <div className="text-amber-800 font-semibold text-lg mb-2">Check your phone</div>
          <p className="text-sm text-gray-600 mb-4">
            {pendingPayment.message ??
              "An M-Pesa Express STK prompt was sent. Enter your PIN to complete the cargo waybill."}
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
                <td className="py-1 text-gray-500">Sender phone</td>
                <td className="py-1 font-medium">{senderPhone}</td>
              </tr>
            </tbody>
          </table>
          <p className="text-xs text-gray-500 animate-pulse">Waiting for payment confirmation…</p>
          <button
            type="button"
            className="btn btn-secondary mt-4 text-sm"
            onClick={() => {
              setPendingPayment(null);
              setError("");
            }}
          >
            Cancel and edit booking
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Cargo waybill issued</h1>
        </div>
        <div className="card max-w-lg">
          <div className="text-green-700 font-semibold text-lg mb-2">Booking confirmed</div>
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
              Demo payment — no real M-Pesa charge. Set{" "}
              <code className="font-mono">DEMO_PAYMENT=false</code> in CMS .env for live STK.
            </p>
          )}
          <button className="btn btn-primary" onClick={() => setSuccess(null)}>
            Book another shipment
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cargo Book</h1>
        <p className="text-sm text-gray-500 mt-1">
          {CARGO_VEHICLE} · Nairobi – Kisumu · {formatCurrency(CARGO_FARE_PER_KG)}/kg · National ID
          required
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Shipment details</h2>
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">Departure</label>
                  <select className="input" value={time} onChange={(e) => setTime(e.target.value)}>
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
                  <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle</label>
                  <div className="input bg-gray-50 text-gray-600 text-xs">{CARGO_VEHICLE}</div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-3">
                Available capacity: <strong>{cargoAvailable.toFixed(0)} kg</strong> of{" "}
                {CARGO_CAPACITY_KG} kg
              </p>
            </div>

            <div className="card">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Cargo</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Weight (kg) *
                  </label>
                  <input
                    type="number"
                    className="input"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    min="0.1"
                    max={CARGO_CAPACITY_KG}
                    step="0.1"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Description *
                  </label>
                  <input
                    className="input"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="e.g. Electronics, documents, farm produce"
                    required
                  />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isFragile}
                    onChange={(e) => setIsFragile(e.target.checked)}
                  />
                  Fragile cargo
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={lastMileDelivery}
                    onChange={(e) => {
                      setLastMileDelivery(e.target.checked);
                      if (!e.target.checked) setDeliveryAddress("");
                    }}
                  />
                  Last mile delivery (+{formatCurrency(LAST_MILE_DELIVERY_FEE)})
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Sender</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                  <input
                    className="input"
                    value={senderName}
                    onChange={(e) => setSenderName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone *</label>
                  <input
                    className="input"
                    value={senderPhone}
                    onChange={(e) => setSenderPhone(e.target.value)}
                    placeholder="0712 345 678"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    National ID / Passport No. *
                  </label>
                  <input
                    className="input"
                    value={senderIdNumber}
                    onChange={(e) => setSenderIdNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. 12345678 or AB1234567"
                    minLength={6}
                    maxLength={20}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Receiver</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
                  <input
                    className="input"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Phone *</label>
                  <input
                    className="input"
                    value={receiverPhone}
                    onChange={(e) => setReceiverPhone(e.target.value)}
                    placeholder="0712 345 678"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    National ID / Passport No. *
                  </label>
                  <input
                    className="input"
                    value={receiverIdNumber}
                    onChange={(e) => setReceiverIdNumber(e.target.value.toUpperCase())}
                    placeholder="e.g. 12345678 or AB1234567"
                    minLength={6}
                    maxLength={20}
                    required
                  />
                </div>
                {lastMileDelivery && (
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Delivery address *
                    </label>
                    <textarea
                      className="input min-h-[72px]"
                      value={deliveryAddress}
                      onChange={(e) => setDeliveryAddress(e.target.value)}
                      placeholder="Estate, street, landmark, town"
                      required
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                  <input
                    className="input"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional agent notes"
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Payment</h2>
              <div className="flex gap-3 mb-3">
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
              <div className="bg-gray-50 border border-gray-200 rounded p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    {weight} kg × {formatCurrency(CARGO_FARE_PER_KG)}
                  </span>
                  <span>{formatCurrency(weightFare)}</span>
                </div>
                {lastMileDelivery && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Last mile delivery</span>
                    <span>{formatCurrency(LAST_MILE_DELIVERY_FEE)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-2 font-bold text-lg">
                  <span>Total</span>
                  <span>{formatCurrency(total)}</span>
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              className="btn btn-primary w-full py-3"
              disabled={
                loading ||
                weight <= 0 ||
                weight > cargoAvailable ||
                (lastMileDelivery && deliveryAddress.trim().length < 5)
              }
            >
              {loading ? "Processing…" : `Confirm cargo · ${formatCurrency(total)}`}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
