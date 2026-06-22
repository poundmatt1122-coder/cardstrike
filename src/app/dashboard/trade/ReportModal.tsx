"use client";

import { useState } from "react";

const REASONS = [
  "Scam attempt",
  "Fake card",
  "Inappropriate content",
  "Harassment",
  "Other",
];

interface Props {
  reportedUserId: string;
  reportedUserName: string;
  listingId?: string;
  offerId?: string;
  onClose: () => void;
}

export default function ReportModal({ reportedUserId, reportedUserName, listingId, offerId, onClose }: Props) {
  const [reason, setReason] = useState(REASONS[0]);
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportedUserId, reason, details: details.trim() || undefined, listingId, offerId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-suns-purple-deep shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="font-semibold text-white">Report User</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">×</button>
        </div>
        {done ? (
          <div className="p-8 text-center">
            <p className="text-3xl mb-3">✅</p>
            <p className="font-semibold text-white">Report submitted</p>
            <p className="text-sm text-white/50 mt-1">Our team will review it shortly.</p>
            <button onClick={onClose} className="mt-4 text-sm text-suns-orange hover:underline">Close</button>
          </div>
        ) : (
          <form onSubmit={submit} className="p-6 space-y-4">
            <p className="text-sm text-white/60">Reporting <span className="font-semibold text-white">{reportedUserName}</span></p>
            <div className="space-y-1">
              <label className="text-xs text-white/40 uppercase tracking-wider">Reason</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white focus:border-suns-orange focus:outline-none"
              >
                {REASONS.map((r) => <option key={r} value={r} className="bg-suns-purple-deep">{r}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/40 uppercase tracking-wider">Additional details (optional)</label>
              <textarea
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Describe what happened…"
                className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-suns-orange focus:outline-none resize-none"
              />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
            >
              {loading ? "Submitting…" : "Submit Report"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
