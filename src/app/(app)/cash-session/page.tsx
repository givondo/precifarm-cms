"use client";

import { useState, useEffect } from "react";
import { formatCurrency } from "@/lib/booking";

type Session = {
  id: string;
  openedAt: string;
  openingFloat: number;
  cashCollected: number;
  status: string;
};

export default function CashSessionPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [openingFloat, setOpeningFloat] = useState("5000");
  const [actualCash, setActualCash] = useState("");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [closeResult, setCloseResult] = useState<{
    expectedCash: number;
    actualCash: number;
    discrepancy: number;
  } | null>(null);

  async function loadSession() {
    const res = await fetch("/api/v1/agents/cash-session");
    const json = await res.json();
    setSession(json.data?.session ?? null);
  }

  useEffect(() => {
    loadSession();
  }, []);

  async function openSession() {
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/v1/agents/cash-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ openingFloat: parseInt(openingFloat, 10) }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(json.error?.message ?? json.error ?? "Failed to open session.");
      return;
    }
    setSession(json.data);
    setMessage("Cash session opened.");
  }

  async function closeSession() {
    if (!session) return;
    setLoading(true);
    setMessage("");
    const res = await fetch("/api/v1/agents/cash-session/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.id,
        actualCash: parseInt(actualCash, 10),
        notes,
      }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(json.error?.message ?? json.error ?? "Failed to close session.");
      return;
    }
    setCloseResult(json.data);
    setSession(null);
    setMessage("Session closed.");
  }

  const expectedCash = session
    ? session.openingFloat + (session.cashCollected ?? 0)
    : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Cash Session</h1>
        <p className="text-sm text-gray-500 mt-1">
          Open and close your cash drawer for walk-in reconciliation
        </p>
      </div>

      {message && (
        <div className="mb-4 text-sm text-green-700 bg-green-50 border border-green-200 rounded px-4 py-2">
          {message}
        </div>
      )}

      {closeResult && (
        <div className="card max-w-md mb-6">
          <h2 className="text-sm font-semibold mb-3">Session closed</h2>
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="py-1 text-gray-500">Expected cash</td>
                <td className="py-1 font-medium">{formatCurrency(closeResult.expectedCash)}</td>
              </tr>
              <tr>
                <td className="py-1 text-gray-500">Actual cash</td>
                <td className="py-1 font-medium">{formatCurrency(closeResult.actualCash)}</td>
              </tr>
              <tr>
                <td className="py-1 text-gray-500">Discrepancy</td>
                <td
                  className={`py-1 font-medium ${
                    closeResult.discrepancy !== 0 ? "text-red-600" : "text-green-700"
                  }`}
                >
                  {formatCurrency(closeResult.discrepancy)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {!session ? (
        <div className="card max-w-md">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Open new session</h2>
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Opening float (KSh)
            </label>
            <input
              type="number"
              className="input"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(e.target.value)}
              min="0"
            />
          </div>
          <button className="btn btn-primary" onClick={openSession} disabled={loading}>
            Open cash session
          </button>
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Active session</h2>
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-2 text-gray-500 w-40">Opened at</td>
                  <td className="py-2">
                    {new Date(session.openedAt).toLocaleString("en-KE")}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-500">Opening float</td>
                  <td className="py-2 font-medium">{formatCurrency(session.openingFloat)}</td>
                </tr>
                <tr>
                  <td className="py-2 text-gray-500">Cash collected</td>
                  <td className="py-2 font-medium text-green-700">
                    {formatCurrency(session.cashCollected ?? 0)}
                  </td>
                </tr>
                <tr className="border-t border-gray-200">
                  <td className="py-2 text-gray-500 font-medium">Expected in drawer</td>
                  <td className="py-2 font-bold text-lg">{formatCurrency(expectedCash)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="card">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Close session</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Actual cash counted (KSh)
                </label>
                <input
                  type="number"
                  className="input"
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  placeholder={String(expectedCash)}
                  min="0"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <input
                  className="input"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={closeSession}
                disabled={loading || !actualCash}
              >
                Close session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
