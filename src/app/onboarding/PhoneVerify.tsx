"use client";

import { useState } from "react";

export default function PhoneVerify({ onVerified }: { onVerified: () => void }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim()) { setError("Enter a phone number."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/phone-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), action: "send" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to send code");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) { setError("Enter the 6-digit code."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/phone-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.trim(), code, action: "verify" }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Invalid code");
      onVerified();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <p className="text-3xl font-bold">Card<span className="text-suns-gold">Strike</span></p>
        <h1 className="mt-3 text-xl font-semibold text-white">Verify your phone number</h1>
        <p className="mt-1 text-sm text-white/50">Step 2 of 2 — Required to post listings and make offers</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-suns-purple/60 p-6 space-y-4 backdrop-blur">
        {!sent ? (
          <form onSubmit={sendCode} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-white/50">Mobile phone number</label>
              <input
                type="tel"
                className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-suns-orange focus:outline-none"
                placeholder="+1 (619) 555-1234"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-suns-orange py-3 text-sm font-semibold text-white hover:bg-suns-orange-soft disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send Verification Code"}
            </button>
            <button
              type="button"
              onClick={onVerified}
              className="w-full text-center text-xs text-white/30 hover:text-white/50 transition-colors"
            >
              Skip for now (some features will be locked)
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="space-y-4">
            <p className="text-sm text-white/70">
              We sent a 6-digit code to <span className="font-semibold text-white">{phone}</span>.
            </p>
            <div className="space-y-1">
              <label className="text-xs text-white/50">Verification code</label>
              <input
                type="text"
                maxLength={6}
                inputMode="numeric"
                className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-center text-2xl font-mono tracking-[0.5em] text-white focus:border-suns-orange focus:outline-none"
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-suns-orange py-3 text-sm font-semibold text-white hover:bg-suns-orange-soft disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Verify Code"}
            </button>
            <button type="button" onClick={() => { setSent(false); setCode(""); setError(""); }} className="w-full text-center text-xs text-white/30 hover:text-white/50">
              Use a different number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
