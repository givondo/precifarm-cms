"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BrandMark from "@/components/BrandMark";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Login failed.");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="pf-login">
      <section className="pf-panel" aria-label="Precifarm">
        <div className="pf-mark">
          <BrandMark size={22} />
        </div>
        <div>
          <h1>Operations, one desk.</h1>
          <p>Home installs, charging sessions, customers and M-Pesa for Precifarm Kenya, in one place.</p>
        </div>
        <small>Precifarm AI Ltd, Nairobi</small>
      </section>

      <div className="pf-form-side">
        <form onSubmit={handleSubmit} className="pf-form" noValidate={false}>
          <h2>Sign in</h2>
          <p className="sub">Use the email and password for your Precifarm account.</p>
          <div className="space-y-4">
            <div>
              <label htmlFor="email">Email</label>
              <input id="email" type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required autoFocus />
            </div>
            <div>
              <label htmlFor="password">Password</label>
              <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            </div>
            {error ? (
              <p className="err" role="alert">
                {error}
              </p>
            ) : null}
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
