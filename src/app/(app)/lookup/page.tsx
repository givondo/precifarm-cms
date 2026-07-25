"use client";

import { useState } from "react";
import { formatCurrency, formatPhoneDisplay } from "@/lib/booking";
import { getDeliveryStageLabel } from "@/lib/cargo";

type DeliveryMessage = {
  stage: string;
  recipient: "sender" | "receiver";
  phone: string;
  body: string;
  sentAt: string;
};

type BookingData = {
  id: string;
  reference: string;
  bookingType: string;
  from: string;
  to: string;
  date: string;
  time: string;
  passengers?: number;
  seats?: string[];
  cargo?: {
    weightKg: number;
    description: string;
    senderIdNumber?: string;
    receiverIdNumber?: string;
    lastMileDelivery?: boolean;
    deliveryAddress?: string;
    deliveryStatus?: string;
    deliveryStatusUpdatedAt?: string;
  };
  deliveryMessages?: DeliveryMessage[];
  total: number;
  name: string;
  phone: string;
  idNumber?: string;
  status: string;
  mpesaReceipt?: string;
  ticket?: { code: string; status: string; smsSentAt?: string };
};

export default function LookupPage() {
  const [reference, setReference] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [refundMsg, setRefundMsg] = useState("");

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    setBooking(null);
    setRefundMsg("");

    const res = await fetch(`/api/v1/bookings/${encodeURIComponent(reference.trim())}`);
    const json = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(json.error?.message ?? "Booking not found.");
      return;
    }
    setBooking(json.data);
  }

  async function handleRefund() {
    if (!booking || !confirm(`Refund/cancel ${booking.reference}?`)) return;
    setRefundMsg("");
    const res = await fetch(`/api/v1/ops/bookings/${encodeURIComponent(booking.reference)}/refund`, {
      method: "POST",
    });
    const json = await res.json();
    if (!res.ok) {
      setRefundMsg(json.error?.message ?? "Refund failed.");
      return;
    }
    setRefundMsg(json.data.message);
    setBooking({ ...booking, status: json.data.status });
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Lookup</h1>
        <p className="text-sm text-gray-500 mt-1">Find a booking by reference and manage refunds</p>
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 mb-6 max-w-md">
        <input
          className="input font-mono"
          placeholder="PF-XXXXXX or PF-CXXXXX"
          value={reference}
          onChange={(e) => setReference(e.target.value.toUpperCase())}
          required
        />
        <button type="submit" className="btn btn-primary shrink-0" disabled={loading}>
          {loading ? "…" : "Search"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {booking && (
        <div className="card max-w-2xl">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="font-mono text-lg font-bold">{booking.reference}</div>
              <div className="text-sm text-gray-500 capitalize">
                {booking.bookingType} · {booking.status}
              </div>
            </div>
            {(booking.status === "paid" || booking.status === "pending") && (
              <button className="btn btn-secondary text-xs" onClick={handleRefund}>
                {booking.status === "paid" ? "Refund" : "Cancel"}
              </button>
            )}
          </div>

          <table className="w-full text-sm mb-4">
            <tbody>
              <tr>
                <td className="py-1 text-gray-500 w-32">Customer</td>
                <td className="py-1">{booking.name}</td>
              </tr>
              <tr>
                <td className="py-1 text-gray-500">Phone</td>
                <td className="py-1">{formatPhoneDisplay(booking.phone)}</td>
              </tr>
              {booking.idNumber && (
                <tr>
                  <td className="py-1 text-gray-500">ID / Passport</td>
                  <td className="py-1 font-mono text-xs">{booking.idNumber}</td>
                </tr>
              )}
              <tr>
                <td className="py-1 text-gray-500">Route</td>
                <td className="py-1">
                  {booking.from} → {booking.to}
                </td>
              </tr>
              <tr>
                <td className="py-1 text-gray-500">Travel</td>
                <td className="py-1">
                  {booking.date} · {booking.time}
                </td>
              </tr>
              {booking.seats && booking.seats.length > 0 && (
                <tr>
                  <td className="py-1 text-gray-500">Seats</td>
                  <td className="py-1">{booking.seats.join(", ")}</td>
                </tr>
              )}
              {booking.cargo && (
                <tr>
                  <td className="py-1 text-gray-500">Cargo</td>
                  <td className="py-1">
                    {booking.cargo.weightKg} kg — {booking.cargo.description}
                    {booking.cargo.deliveryStatus && (
                      <div className="text-xs text-green-700 mt-1 capitalize">
                        Delivery: {getDeliveryStageLabel(booking.cargo.deliveryStatus)}
                      </div>
                    )}
                    {booking.cargo.senderIdNumber && (
                      <div className="text-xs text-gray-500 mt-1">
                        Sender ID: {booking.cargo.senderIdNumber}
                      </div>
                    )}
                    {booking.cargo.receiverIdNumber && (
                      <div className="text-xs text-gray-500">
                        Receiver ID: {booking.cargo.receiverIdNumber}
                      </div>
                    )}
                    {booking.cargo.lastMileDelivery && (
                      <div className="text-xs text-green-700 mt-1">
                        Last mile: {booking.cargo.deliveryAddress ?? "Address on file"}
                      </div>
                    )}
                  </td>
                </tr>
              )}
              {booking.deliveryMessages && booking.deliveryMessages.length > 0 && (
                <tr>
                  <td className="py-1 text-gray-500 align-top">Messages</td>
                  <td className="py-1">
                    <div className="space-y-2">
                      {booking.deliveryMessages.map((msg, i) => (
                        <div
                          key={`${msg.sentAt}-${msg.recipient}-${i}`}
                          className="text-xs border border-gray-200 rounded p-2 bg-gray-50"
                        >
                          <div className="font-medium capitalize">
                            {getDeliveryStageLabel(msg.stage)} · {msg.recipient}
                          </div>
                          <div className="text-gray-500">{formatPhoneDisplay(msg.phone)}</div>
                          <pre className="whitespace-pre-wrap font-sans text-gray-700 mt-1">
                            {msg.body}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              <tr>
                <td className="py-1 text-gray-500">Total</td>
                <td className="py-1 font-medium">{formatCurrency(booking.total)}</td>
              </tr>
              {booking.mpesaReceipt && (
                <tr>
                  <td className="py-1 text-gray-500">M-Pesa receipt</td>
                  <td className="py-1 font-mono text-xs">{booking.mpesaReceipt}</td>
                </tr>
              )}
            </tbody>
          </table>

          {refundMsg && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
              {refundMsg}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
