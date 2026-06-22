"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { tradeFeeSummary } from "@/lib/tradeFee";
import ReportModal from "./ReportModal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TradeUser {
  id: string;
  name: string | null;
  imageUrl: string | null;
}

interface TradeListing {
  id: string;
  cardName: string;
  setName: string;
  game: string;
  grade: string;
  condition: string;
  estimatedValue: number;
  lookingFor: string;
  notes: string | null;
  imageUrl: string | null;
  status: string;
  createdAt: string;
  user: TradeUser;
  ownerRating: { avg: number; count: number };
}

interface PortfolioCard {
  id: string;
  name: string;
  grade: string;
  estimatedValue: number;
}

type GameFilter = "All" | "Pokémon" | "Sports" | "Magic" | "Other";

// ---------------------------------------------------------------------------
// Mock data (shown until real listings exist)
// ---------------------------------------------------------------------------

const MOCK_LISTINGS: TradeListing[] = [
  { id: "m1", cardName: "Charizard Holo 1st Edition", setName: "Base Set", game: "Pokémon", grade: "PSA 8", condition: "PSA 8", estimatedValue: 12000, lookingFor: "Blastoise Holo Base Set PSA 8+, or top cash offers", notes: "Been in my collection for 10 years. Centering is 55/45.", imageUrl: null, status: "active", createdAt: new Date(Date.now() - 3_600_000).toISOString(), user: { id: "u1", name: "PokéCollector99", imageUrl: null }, ownerRating: { avg: 4.8, count: 23 } },
  { id: "m2", cardName: "LeBron James 2003-04 Topps Chrome RC", setName: "Topps Chrome", game: "Sports", grade: "PSA 9", condition: "PSA 9", estimatedValue: 3500, lookingFor: "Kobe Bryant RC PSA 9+, or Giannis RC PSA 10", notes: "Clean card, great eye appeal.", imageUrl: null, status: "active", createdAt: new Date(Date.now() - 86_400_000).toISOString(), user: { id: "u2", name: "HoopsTrader", imageUrl: null }, ownerRating: { avg: 4.6, count: 8 } },
  { id: "m3", cardName: "Black Lotus Alpha", setName: "Alpha", game: "Magic", grade: "BGS 6.5", condition: "BGS 6.5", estimatedValue: 45000, lookingFor: "Cash + other Power 9 pieces considered", notes: "Graded by BGS. Authentic, tracked throughout.", imageUrl: null, status: "active", createdAt: new Date(Date.now() - 172_800_000).toISOString(), user: { id: "u3", name: "MTGVault", imageUrl: null }, ownerRating: { avg: 5.0, count: 42 } },
  { id: "m4", cardName: "Patrick Mahomes 2017 Prizm RC", setName: "Panini Prizm", game: "Sports", grade: "PSA 10", condition: "PSA 10", estimatedValue: 8500, lookingFor: "Josh Allen PSA 10 Prizm RC, or equivalent value offers", notes: null, imageUrl: null, status: "active", createdAt: new Date(Date.now() - 259_200_000).toISOString(), user: { id: "u4", name: "GridironCollector", imageUrl: null }, ownerRating: { avg: 4.9, count: 15 } },
  { id: "m5", cardName: "Pikachu Illustrator", setName: "CoroCoro Illustration Contest", game: "Pokémon", grade: "CGC 7", condition: "CGC 7", estimatedValue: 175000, lookingFor: "Trophy cards, high-end Japanese exclusives, or serious cash offers", notes: "One of the rarest Pokémon cards ever made.", imageUrl: null, status: "active", createdAt: new Date(Date.now() - 432_000_000).toISOString(), user: { id: "u5", name: "RareCardKing", imageUrl: null }, ownerRating: { avg: 5.0, count: 67 } },
];

const GAMES: GameFilter[] = ["All", "Pokémon", "Sports", "Magic", "Other"];
const GRADES = ["RAW", "PSA 10", "PSA 9", "PSA 8", "PSA 7", "BGS 9.5", "BGS 9", "CGC 10", "CGC 9.5", "Other"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtVal(n: number) {
  return `$${n.toFixed(2)}`;
}

function timeAgo(iso: string) {
  const h = Math.floor((Date.now() - new Date(iso).getTime()) / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function StarRating({ avg, count }: { avg: number; count: number }) {
  if (count === 0) return <span className="text-xs text-white/30">New member</span>;
  return (
    <span className="text-xs text-suns-gold">
      ⭐ {avg.toFixed(1)} <span className="text-white/40">({count} trades)</span>
    </span>
  );
}

function Avatar({ user }: { user: TradeUser }) {
  if (user.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={user.imageUrl} alt={user.name ?? ""} className="h-8 w-8 rounded-full object-cover" />;
  }
  const initials = (user.name ?? "?").slice(0, 2).toUpperCase();
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-suns-purple-soft text-xs font-bold text-white">
      {initials}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Offer modal
// ---------------------------------------------------------------------------

function OfferModal({
  listing,
  onClose,
  onSuccess,
}: {
  listing: TradeListing;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [portfolio, setPortfolio] = useState<PortfolioCard[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cashAddon, setCashAddon] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchingPortfolio, setFetchingPortfolio] = useState(true);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch("/api/trade/offer?type=portfolio")
      .then((r) => r.json())
      .then((d: { portfolio: PortfolioCard[] }) => { setPortfolio(d.portfolio ?? []); })
      .catch(() => setPortfolio([]))
      .finally(() => setFetchingPortfolio(false));
  }, []);

  const [lopsidedAcknowledged, setLopsidedAcknowledged] = useState(false);

  const selectedCards = portfolio.filter((c) => selected.has(c.id));
  const offeredValue = selectedCards.reduce((s, c) => s + c.estimatedValue, 0);
  const cash = parseFloat(cashAddon) || 0;
  const fee = tradeFeeSummary(offeredValue + cash, listing.estimatedValue);

  const totalOffered = offeredValue + cash;
  const lopsidedPct =
    totalOffered > 0 && listing.estimatedValue > 0
      ? Math.abs(totalOffered - listing.estimatedValue) / Math.max(totalOffered, listing.estimatedValue)
      : 0;
  const isLopsided40 = lopsidedPct >= 0.4;
  const isLopsided70 = lopsidedPct >= 0.7;

  function toggleCard(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function submit() {
    if (selected.size === 0 && cash <= 0) {
      setError("Select at least one card or add a cash amount.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/trade/offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId: listing.id,
          offeredCards: selectedCards,
          cashAddon: cash > 0 ? cash : undefined,
          message: message.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      setSubmitted(true);
      setTimeout(onSuccess, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send offer.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 bg-suns-purple-deep shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-suns-purple-deep px-6 py-4">
          <div>
            <h2 className="font-semibold text-white">Make an Offer</h2>
            <p className="text-xs text-white/50 mt-0.5">for {listing.cardName}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl leading-none">×</button>
        </div>

        {submitted ? (
          <div className="p-8 text-center">
            <p className="text-4xl mb-3">🤝</p>
            <p className="font-semibold text-white">Offer sent!</p>
            <p className="text-sm text-white/50 mt-1">{listing.user.name} has been notified.</p>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            {/* Their card */}
            <div className="rounded-lg border border-white/10 bg-white/5 p-4">
              <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">You&apos;re offering for</p>
              <p className="font-semibold text-white">{listing.cardName}</p>
              <p className="text-sm text-white/50">{listing.setName} · {listing.grade}</p>
              <p className="text-sm text-suns-gold font-semibold mt-1">{fmtVal(listing.estimatedValue)}</p>
            </div>

            {/* Portfolio cards */}
            <div>
              <p className="text-xs text-white/40 mb-2 uppercase tracking-wider">Select card(s) to offer</p>
              {fetchingPortfolio ? (
                <p className="text-sm text-white/40">Loading your portfolio…</p>
              ) : portfolio.length === 0 ? (
                <p className="text-sm text-white/40">No tracked cards in your portfolio yet. <Link href="/dashboard/alerts" className="text-suns-orange">Add some alerts</Link> first.</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {portfolio.map((c) => (
                    <label
                      key={c.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${selected.has(c.id) ? "border-suns-orange bg-suns-orange/10" : "border-white/10 bg-white/5 hover:border-white/30"}`}
                    >
                      <input
                        type="checkbox"
                        className="accent-suns-orange"
                        checked={selected.has(c.id)}
                        onChange={() => toggleCard(c.id)}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-white">{c.name}</p>
                        <p className="text-xs text-white/40">{c.grade}</p>
                      </div>
                      <span className="text-sm font-semibold text-suns-gold">{fmtVal(c.estimatedValue)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Cash add-on */}
            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider">Cash add-on (optional)</label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={cashAddon}
                  onChange={(e) => setCashAddon(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 pl-7 pr-3 py-2 text-sm text-white placeholder-white/30 focus:border-suns-orange focus:outline-none"
                />
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="text-xs text-white/40 uppercase tracking-wider">Message (optional)</label>
              <textarea
                rows={2}
                placeholder="Say something about your offer…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="mt-1 w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-suns-orange focus:outline-none resize-none"
              />
            </div>

            {/* Fee breakdown */}
            {(selectedCards.length > 0 || cash > 0) && (
              <div className="rounded-lg border border-white/10 bg-white/5 p-4 text-xs space-y-1">
                <p className="text-white/40 font-semibold uppercase tracking-wider mb-2">Platform fee breakdown</p>
                <div className="flex justify-between"><span className="text-white/60">Fee on your offer ({fmtVal(offeredValue + cash)})</span><span className="text-white">{fmtVal(fee.feeOnOfferedCard)}</span></div>
                <div className="flex justify-between"><span className="text-white/60">Fee on listed card ({fmtVal(listing.estimatedValue)})</span><span className="text-white">{fmtVal(fee.feeOnListedCard)}</span></div>
                <div className="flex justify-between border-t border-white/10 pt-1 mt-1 font-semibold"><span className="text-white/80">You pay (your share)</span><span className="text-suns-gold">{fmtVal(fee.eachPays)}</span></div>
              </div>
            )}

            {/* Lopsided trade warning */}
            {isLopsided70 && (
              <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-4 space-y-2">
                <p className="text-sm font-semibold text-red-400">⚠️ Heavily lopsided trade</p>
                <p className="text-xs text-red-300/80">
                  The value difference is over 70%. Make sure you understand what you&apos;re agreeing to before sending.
                </p>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-red-500"
                    checked={lopsidedAcknowledged}
                    onChange={(e) => setLopsidedAcknowledged(e.target.checked)}
                  />
                  <span className="text-xs text-red-300">I understand this is a heavily unequal trade</span>
                </label>
              </div>
            )}
            {!isLopsided70 && isLopsided40 && (
              <div className="rounded-lg border border-suns-orange/40 bg-suns-orange/10 p-3">
                <p className="text-sm text-suns-orange">⚠️ Lopsided trade — value difference exceeds 40%</p>
                <p className="text-xs text-suns-orange/70 mt-1">Double-check the values before sending your offer.</p>
              </div>
            )}

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              onClick={submit}
              disabled={loading || (isLopsided70 && !lopsidedAcknowledged)}
              className="w-full rounded-lg bg-suns-orange py-3 text-sm font-semibold text-white transition-colors hover:bg-suns-orange-soft disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send Offer 🤝"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// List card slide-out form
// ---------------------------------------------------------------------------

function ListCardSlideout({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    cardName: "", setName: "", game: "Pokémon", grade: "RAW",
    condition: "RAW", estimatedValue: "", lookingFor: "", notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function set(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cardName.trim()) { setError("Card name is required."); return; }
    if (!form.lookingFor.trim()) { setError("What you're looking for is required."); return; }
    const val = parseFloat(form.estimatedValue);
    if (!val || val <= 0) { setError("Enter a valid estimated value."); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/trade/listing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, estimatedValue: val }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
      setLoading(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-md overflow-y-auto bg-suns-purple-deep shadow-2xl border-l border-white/10">
        <div className="sticky top-0 flex items-center justify-between border-b border-white/10 bg-suns-purple-deep px-6 py-4">
          <h2 className="font-semibold text-white">List a Card for Trade</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-2xl">×</button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {[
            { label: "Card name *", key: "cardName" as const, placeholder: "e.g. Charizard Holo 1st Edition" },
            { label: "Set name *", key: "setName" as const, placeholder: "e.g. Base Set" },
            { label: "What you're looking for *", key: "lookingFor" as const, placeholder: "e.g. Blastoise Holo Base Set PSA 8+" },
          ].map(({ label, key, placeholder }) => (
            <div key={key} className="space-y-1">
              <label className="text-xs text-white/50">{label}</label>
              <input
                className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-suns-orange focus:outline-none"
                placeholder={placeholder}
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
              />
            </div>
          ))}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-white/50">Game</label>
              <select
                className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white focus:border-suns-orange focus:outline-none"
                value={form.game}
                onChange={(e) => set("game", e.target.value)}
              >
                {["Pokémon", "Sports", "Magic", "Other"].map((g) => (
                  <option key={g} value={g} className="bg-suns-purple-deep">{g}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/50">Grade / Condition</label>
              <select
                className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white focus:border-suns-orange focus:outline-none"
                value={form.grade}
                onChange={(e) => { set("grade", e.target.value); set("condition", e.target.value); }}
              >
                {GRADES.map((g) => (
                  <option key={g} value={g} className="bg-suns-purple-deep">{g}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/50">Estimated value *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
              <input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.estimatedValue}
                onChange={(e) => set("estimatedValue", e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 pl-7 pr-3 py-2 text-sm text-white placeholder-white/30 focus:border-suns-orange focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/50">Notes (optional)</label>
            <textarea
              rows={3}
              placeholder="Condition notes, provenance, etc."
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-suns-orange focus:outline-none resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-suns-orange py-3 text-sm font-semibold text-white transition-colors hover:bg-suns-orange-soft disabled:opacity-50"
          >
            {loading ? "Listing…" : "List for Trade"}
          </button>
        </form>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Listing card
// ---------------------------------------------------------------------------

function ListingCard({ listing, onOffer, onReport }: { listing: TradeListing; onOffer: (l: TradeListing) => void; onReport: (l: TradeListing) => void }) {
  const gameColors: Record<string, string> = {
    Pokémon: "bg-yellow-500/20 text-yellow-400",
    Sports: "bg-suns-orange/20 text-suns-orange",
    Magic: "bg-purple-500/20 text-purple-400",
    Other: "bg-white/10 text-white/50",
  };

  return (
    <div className="flex flex-col rounded-xl border border-white/10 bg-suns-purple/40 p-5 gap-4 hover:border-white/20 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${gameColors[listing.game] ?? gameColors.Other}`}>
              {listing.game}
            </span>
            <span className="text-xs text-white/40">{listing.grade}</span>
          </div>
          <p className="font-semibold text-white leading-tight">{listing.cardName}</p>
          <p className="text-xs text-white/50 mt-0.5">{listing.setName}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-lg font-bold text-suns-gold">{fmtVal(listing.estimatedValue)}</p>
          <p className="text-xs text-white/30">{timeAgo(listing.createdAt)}</p>
        </div>
      </div>

      <div className="rounded-lg bg-white/5 px-3 py-2.5">
        <p className="text-xs text-white/40 mb-1">Looking for</p>
        <p className="text-sm text-white/80">{listing.lookingFor}</p>
      </div>

      {listing.notes && (
        <p className="text-xs text-white/40 leading-relaxed">{listing.notes}</p>
      )}

      <div className="flex items-center justify-between pt-1 border-t border-white/5">
        <Link href={`/profile/${listing.user.id}`} className="flex items-center gap-2 group">
          <Avatar user={listing.user} />
          <div>
            <p className="text-xs font-medium text-white group-hover:text-suns-gold transition-colors">
              {listing.user.name ?? "Unknown"}
            </p>
            <StarRating avg={listing.ownerRating.avg} count={listing.ownerRating.count} />
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onReport(listing)}
            className="rounded-lg border border-white/10 px-2 py-2 text-xs text-white/30 transition-colors hover:border-red-500/40 hover:text-red-400"
            title="Report this listing"
          >
            🚩
          </button>
          <button
            onClick={() => onOffer(listing)}
            className="rounded-lg bg-suns-orange px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-suns-orange-soft"
          >
            Make Offer
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TradeBoard({ initialShowForm = false }: { initialShowForm?: boolean }) {
  const [listings, setListings] = useState<TradeListing[]>(MOCK_LISTINGS);
  const [filter, setFilter] = useState<GameFilter>("All");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(initialShowForm);
  const [offerTarget, setOfferTarget] = useState<TradeListing | null>(null);
  const [reportTarget, setReportTarget] = useState<TradeListing | null>(null);
  const loadedRef = useRef(false);

  const load = useCallback(async (game?: string) => {
    try {
      const params = new URLSearchParams();
      if (game && game !== "All") params.set("game", game);
      const res = await fetch(`/api/trade/listing?${params.toString()}`);
      if (!res.ok) return;
      const data = (await res.json()) as { listings: TradeListing[] };
      if (data.listings.length > 0) setListings(data.listings);
    } catch {
      // keep mock data on error
    }
  }, []);

  useEffect(() => {
    if (!loadedRef.current) {
      loadedRef.current = true;
      void load();
    }
  }, [load]);

  useEffect(() => { void load(filter); }, [filter, load]);

  const displayed = listings.filter((l) => {
    const matchesFilter = filter === "All" || l.game === filter;
    const matchesSearch =
      !search ||
      l.cardName.toLowerCase().includes(search.toLowerCase()) ||
      l.setName.toLowerCase().includes(search.toLowerCase()) ||
      (l.user.name ?? "").toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <>
      {showForm && (
        <ListCardSlideout
          onClose={() => setShowForm(false)}
          onCreated={() => { setShowForm(false); void load(filter); }}
        />
      )}
      {offerTarget && (
        <OfferModal
          listing={offerTarget}
          onClose={() => setOfferTarget(null)}
          onSuccess={() => setOfferTarget(null)}
        />
      )}
      {reportTarget && (
        <ReportModal
          reportedUserId={reportTarget.user.id}
          reportedUserName={reportTarget.user.name ?? "Unknown"}
          listingId={reportTarget.id}
          onClose={() => setReportTarget(null)}
        />
      )}

      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Trade Board</h1>
            <p className="mt-0.5 text-sm text-white/50">
              Browse member listings and trade directly — no cash needed.
            </p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-suns-orange px-4 py-2 text-sm font-semibold text-white hover:bg-suns-orange-soft transition-colors"
          >
            + List a Card
          </button>
        </div>

        {/* Filters + search */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-xl border border-white/10 bg-suns-purple/30 p-1">
            {GAMES.map((g) => (
              <button
                key={g}
                onClick={() => setFilter(g)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${filter === g ? "bg-suns-orange text-white" : "text-white/50 hover:text-white"}`}
              >
                {g}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Search card name, set, or user…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-48 rounded-lg border border-white/10 bg-suns-purple/40 px-4 py-2 text-sm text-white placeholder-white/30 focus:border-suns-orange focus:outline-none"
          />
        </div>

        {/* Listings grid */}
        {displayed.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-suns-purple/30 py-16 text-center">
            <p className="text-white/40">No listings match your search.</p>
            <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-suns-orange hover:underline">
              Be the first to list →
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {displayed.map((l) => (
              <ListingCard key={l.id} listing={l} onOffer={(l) => setOfferTarget(l)} onReport={(l) => setReportTarget(l)} />
            ))}
          </div>
        )}

        <p className="text-center text-xs text-white/20">
          Showing mock listings — real community trades appear once members post.
        </p>
      </div>
    </>
  );
}
