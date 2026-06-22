"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PhoneVerify from "./PhoneVerify";

export default function OnboardingClient({ skipToPhone }: { skipToPhone: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState<"profile" | "phone">(skipToPhone ? "phone" : "profile");

  // Step 1 state
  const [dob, setDob] = useState("");
  const [username, setUsername] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 3600 * 1000)) : null;
  const isMinor = age !== null && age < 18;

  async function submitProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!dob) { setError("Date of birth is required."); return; }
    if (!username.trim()) { setError("Username is required."); return; }
    if (username.trim().length < 3) { setError("Username must be at least 3 characters."); return; }
    if (!agreed) { setError("You must agree to the terms."); return; }
    if (isMinor && !parentEmail.trim()) { setError("Parent email is required for users under 18."); return; }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dob, username: username.trim(), parentEmail: isMinor ? parentEmail.trim() : undefined }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setStep("phone");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setLoading(false);
    }
  }

  if (step === "phone") {
    return <PhoneVerify onVerified={() => router.push("/dashboard")} />;
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <p className="text-3xl font-bold">
          Card<span className="text-suns-gold">Strike</span>
        </p>
        <h1 className="mt-3 text-xl font-semibold text-white">Welcome! Let&apos;s set up your account</h1>
        <p className="mt-1 text-sm text-white/50">Step 1 of 2 — Profile &amp; Age Verification</p>
      </div>

      <form onSubmit={submitProfile} className="rounded-2xl border border-white/10 bg-suns-purple/60 p-6 space-y-4 backdrop-blur">
        <div className="space-y-1">
          <label className="text-xs text-white/50">Username *</label>
          <input
            className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-suns-orange focus:outline-none"
            placeholder="e.g. CardKing99"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-white/50">Date of birth *</label>
          <input
            type="date"
            className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white focus:border-suns-orange focus:outline-none [color-scheme:dark]"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
            max={new Date().toISOString().split("T")[0]}
          />
          {age !== null && (
            <p className={`text-xs ${isMinor ? "text-suns-orange" : "text-green-400"}`}>
              {isMinor ? `⚠️ Age ${age} — junior account (parental approval required)` : `✓ Age ${age} — adult account`}
            </p>
          )}
        </div>

        {isMinor && (
          <div className="space-y-1">
            <label className="text-xs text-white/50">Parent / guardian email *</label>
            <input
              type="email"
              className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-suns-orange focus:outline-none"
              placeholder="parent@example.com"
              value={parentEmail}
              onChange={(e) => setParentEmail(e.target.value)}
            />
            <p className="text-xs text-white/40">We&apos;ll send an approval email before your account is fully active.</p>
          </div>
        )}

        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            className="mt-0.5 accent-suns-orange"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span className="text-xs text-white/60">
            I agree to the CardStrike{" "}
            <a href="#" className="text-suns-orange hover:underline">Terms of Service</a>{" "}
            and{" "}
            <a href="#" className="text-suns-orange hover:underline">Privacy Policy</a>.
          </span>
        </label>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-suns-orange py-3 text-sm font-semibold text-white hover:bg-suns-orange-soft disabled:opacity-50 transition-colors"
        >
          {loading ? "Saving…" : "Continue →"}
        </button>
      </form>
    </div>
  );
}
