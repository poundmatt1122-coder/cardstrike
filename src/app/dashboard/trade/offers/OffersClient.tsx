"use client";

import { useCallback, useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OfferedCard {
  id: string;
  name: string;
  grade: string;
  estimatedValue: number;
}

interface TradeListing {
  id: string;
  cardName: string;
  setName: string;
  grade: string;
  estimatedValue: number;
}

interface TradeUser {
  id: string;
  name: string | null;
  imageUrl: string | null;
}

interface TradeOffer {
  id: string;
  fromUserId: string;
  toUserId: string;
  listingId: string;
  offeredCards: OfferedCard[];
  message: string | null;
  status: string;
  createdAt: string;
  fromUser?: TradeUser;
  toUser?: TradeUser;
  listing: TradeListing;
  rating: null | { id: string };
  fee: null | { totalFee: number; fromUserFee: number; toUserFee: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtVal(n: number) {
  return `$${n.toFixed(2)}`;
}

function timeAgo(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-suns-orange/15 text-suns-orange border border-suns-orange/30",
  accepted: "bg-green-500/15 text-green-400 border border-green-500/30",
  declined: "bg-red-500/15 text-red-400 border border-red-500/20",
  countered: "bg-blue-500/15 text-blue-400 border border-blue-500/20",
};

// ---------------------------------------------------------------------------
// Rate trade modal
// ---------------------------------------------------------------------------

function RateModal({
  offer,
  onClose,
  onRated,
}: {
  offer: TradeOffer;
  onClose: () => void;
  onRated: () => void;
}) {
  const [stars, setStars] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/trade/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId: offer.id, rating: stars, comment: comment.trim() || undefined }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onRated();
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
          <h2 className="font-semibold text-white">Rate Your Trade</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl">×</button>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-white/60">
            How was trading{" "}
            <span className="font-semibold text-white">{offer.listing.cardName}</span>?
          </p>

          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setStars(n)}
                className={`text-2xl transition-transform hover:scale-110 ${n <= stars ? "opacity-100" : "opacity-30"}`}
              >
                ⭐
              </button>
            ))}
          </div>

          <div>
            <label className="text-xs text-white/40">Comment (optional)</label>
            <textarea
              rows={2}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Great trade, fast shipper…"
              className="mt-1 w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-suns-orange focus:outline-none resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            onClick={submit}
            disabled={loading}
            className="w-full rounded-lg bg-suns-orange py-2.5 text-sm font-semibold text-white hover:bg-suns-orange-soft disabled:opacity-50"
          >
            {loading ? "Submitting…" : "Submit Rating"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Offer row
// ---------------------------------------------------------------------------

function ReceivedRow({
  offer,
  onAction,
  onRate,
}: {
  offer: TradeOffer;
  onAction: (id: string, action: "accept" | "decline") => void;
  onRate: (offer: TradeOffer) => void;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-suns-purple/40 p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-white">{offer.listing.cardName}</p>
          <p className="text-xs text-white/50">
            From <span className="text-white">{offer.fromUser?.name ?? "Unknown"}</span> · {timeAgo(offer.createdAt)}
          </p>
        </div>
        <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[offer.status] ?? ""}`}>
          {offer.status}
        </span>
      </div>

      <div className="rounded-lg bg-white/5 px-3 py-2.5 space-y-1">
        <p className="text-xs text-white/40">They&apos;re offering</p>
        {offer.offeredCards.map((c, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-white">{c.name} {c.grade && `· ${c.grade}`}</span>
            <span className="text-suns-gold">{fmtVal(c.estimatedValue)}</span>
          </div>
        ))}
      </div>

      {offer.message && (
        <p className="text-xs text-white/60 italic">&ldquo;{offer.message}&rdquo;</p>
      )}

      {offer.fee && (
        <p className="text-xs text-white/40">
          Platform fee: {fmtVal(offer.fee.totalFee)} — you pay {fmtVal(offer.fee.toUserFee)}
        </p>
      )}

      {offer.status === "pending" && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onAction(offer.id, "accept")}
            className="rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white hover:bg-green-500 transition-colors"
          >
            Accept
          </button>
          <button
            onClick={() => onAction(offer.id, "decline")}
            className="rounded-lg border border-white/10 px-4 py-2 text-xs font-medium text-white/60 hover:text-white transition-colors"
          >
            Decline
          </button>
        </div>
      )}

      {offer.status === "accepted" && !offer.rating && (
        <button
          onClick={() => onRate(offer)}
          className="text-xs text-suns-gold hover:underline"
        >
          ⭐ Rate this trade →
        </button>
      )}
    </div>
  );
}

function SentRow({ offer }: { offer: TradeOffer }) {
  return (
    <div className="rounded-xl border border-white/10 bg-suns-purple/40 p-5 space-y-2">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-white">{offer.listing.cardName}</p>
          <p className="text-xs text-white/50">
            To <span className="text-white">{offer.toUser?.name ?? "Unknown"}</span> · {timeAgo(offer.createdAt)}
          </p>
        </div>
        <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[offer.status] ?? ""}`}>
          {offer.status}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {offer.offeredCards.map((c, i) => (
          <span key={i} className="rounded bg-white/10 px-2 py-0.5 text-xs text-white/70">
            {c.name}{c.grade ? ` · ${c.grade}` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function OffersClient() {
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [received, setReceived] = useState<TradeOffer[]>([]);
  const [sent, setSent] = useState<TradeOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [rateTarget, setRateTarget] = useState<TradeOffer | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/trade/offer");
      const data = (await res.json()) as { received: TradeOffer[]; sent: TradeOffer[] };
      setReceived(data.received ?? []);
      setSent(data.sent ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function action(offerId: string, act: "accept" | "decline") {
    const res = await fetch("/api/trade/offer", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ offerId, action: act }),
    });
    if (res.ok) await load();
  }

  const counts = { received: received.length, sent: sent.length };

  return (
    <>
      {rateTarget && (
        <RateModal
          offer={rateTarget}
          onClose={() => setRateTarget(null)}
          onRated={() => { setRateTarget(null); void load(); }}
        />
      )}

      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Trade Offers</h1>
          <p className="mt-0.5 text-sm text-white/50">Manage offers you&apos;ve received and sent.</p>
        </div>

        <div className="flex gap-1 rounded-xl border border-white/10 bg-suns-purple/30 p-1 w-fit">
          {(["received", "sent"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg px-5 py-1.5 text-xs font-semibold transition-colors capitalize ${tab === t ? "bg-suns-orange text-white" : "text-white/50 hover:text-white"}`}
            >
              {t} <span className="opacity-60">({counts[t]})</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-16 text-center text-white/40 text-sm">Loading…</div>
        ) : tab === "received" ? (
          received.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-suns-purple/30 py-16 text-center">
              <p className="text-white/40">No offers received yet.</p>
              <p className="text-xs text-white/25 mt-1">List a card on the trade board to start receiving offers.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {received.map((o) => (
                <ReceivedRow key={o.id} offer={o} onAction={action} onRate={setRateTarget} />
              ))}
            </div>
          )
        ) : (
          sent.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-suns-purple/30 py-16 text-center">
              <p className="text-white/40">You haven&apos;t sent any offers yet.</p>
              <a href="/dashboard/trade" className="mt-3 block text-sm text-suns-orange hover:underline">Browse the Trade Board →</a>
            </div>
          ) : (
            <div className="space-y-4">
              {sent.map((o) => <SentRow key={o.id} offer={o} />)}
            </div>
          )
        )}
      </div>
    </>
  );
}
