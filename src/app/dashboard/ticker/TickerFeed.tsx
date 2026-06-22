"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types (mirror src/app/api/ticker/route.ts)
// ---------------------------------------------------------------------------

interface TickerItem {
  id: string;
  cardName: string;
  grade: string;
  sport: string;
  fairValue: number;
  listingPrice: number;
  discountPct: number;
  listingUrl: string;
  sentAt: string | null;
}

type SportFilter = "ALL" | "BASKETBALL" | "FOOTBALL" | "BASEBALL" | "HOCKEY" | "SOCCER";

const SPORT_LABELS: Record<SportFilter, string> = {
  ALL: "All Sports",
  BASKETBALL: "Basketball",
  FOOTBALL: "Football",
  BASEBALL: "Baseball",
  HOCKEY: "Hockey",
  SOCCER: "Soccer",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cents(n: number) {
  return `$${(n / 100).toFixed(2)}`;
}

function discountBadge(pct: number) {
  if (pct >= 30)
    return "bg-suns-gold/20 text-suns-gold border border-suns-gold/40";
  if (pct >= 20)
    return "bg-suns-orange/20 text-suns-orange border border-suns-orange/40";
  return "bg-white/10 text-white/50 border border-white/10";
}

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Mock data (shown until /api/ticker has real records)
// ---------------------------------------------------------------------------

const MOCK_ITEMS: TickerItem[] = [
  { id: "m1", cardName: "Victor Wembanyama 2023-24 Prizm Silver RC", grade: "PSA 10", sport: "BASKETBALL", fairValue: 30000, listingPrice: 21000, discountPct: 30, listingUrl: "#", sentAt: new Date(Date.now() - 3_600_000).toISOString() },
  { id: "m2", cardName: "Patrick Mahomes 2017 National Treasures RPA", grade: "RAW", sport: "FOOTBALL", fairValue: 125000, listingPrice: 94000, discountPct: 25, listingUrl: "#", sentAt: new Date(Date.now() - 7_200_000).toISOString() },
  { id: "m3", cardName: "Connor Bedard 2023-24 Upper Deck Young Guns", grade: "RAW", sport: "HOCKEY", fairValue: 12900, listingPrice: 10320, discountPct: 20, listingUrl: "#", sentAt: new Date(Date.now() - 14_400_000).toISOString() },
  { id: "m4", cardName: "Shohei Ohtani 2018 Topps Chrome RC", grade: "PSA 9", sport: "BASEBALL", fairValue: 15000, listingPrice: 12450, discountPct: 17, listingUrl: "#", sentAt: new Date(Date.now() - 86_400_000).toISOString() },
  { id: "m5", cardName: "Caitlin Clark 2024 Prizm Draft Picks Silver", grade: "RAW", sport: "BASKETBALL", fairValue: 5200, listingPrice: 4420, discountPct: 15, listingUrl: "#", sentAt: new Date(Date.now() - 172_800_000).toISOString() },
];

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

function DealRow({ item, onSwap }: { item: TickerItem; onSwap: (item: TickerItem) => void }) {
  return (
    <div className="flex items-center gap-4 border-b border-white/5 px-4 py-3 transition-colors hover:bg-white/5">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">{item.cardName}</p>
        <p className="text-xs text-white/40">{item.grade} · {item.sport.charAt(0) + item.sport.slice(1).toLowerCase()}</p>
      </div>

      <div className="hidden flex-shrink-0 text-right sm:block">
        <p className="text-xs text-white/30 line-through">{cents(item.fairValue)}</p>
        <p className="text-sm font-semibold text-white">{cents(item.listingPrice)}</p>
      </div>

      <span className={`flex-shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${discountBadge(item.discountPct)}`}>
        {item.discountPct}% off
      </span>

      <div className="flex flex-shrink-0 items-center gap-2">
        <a
          href={item.listingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded px-2 py-1 text-xs text-suns-orange hover:bg-suns-orange/10 transition-colors"
        >
          View →
        </a>
        <button
          onClick={() => onSwap(item)}
          className="rounded px-2 py-1 text-xs text-white/40 hover:bg-white/10 hover:text-white transition-colors"
        >
          Afford?
        </button>
      </div>

      <span className="hidden flex-shrink-0 text-xs text-white/25 lg:block">
        {timeAgo(item.sentAt)}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Swap modal
// ---------------------------------------------------------------------------

function SwapModal({ item, onClose }: { item: TickerItem; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    sell_recommendations: { card_name: string; estimated_sale: number; reason: string }[];
    total_from_sales: number;
    target_price: number;
    net_position: number;
    summary: string;
  } | null>(null);
  const [error, setError] = useState("");

  async function analyze() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCard: {
            name: item.cardName,
            grade: item.grade,
            price: item.listingPrice,
            listingUrl: item.listingUrl,
          },
        }),
      });
      const data = await res.json() as typeof result & { error?: string };
      if (!res.ok) throw new Error(data?.error ?? "Analysis failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void analyze(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-suns-purple-deep shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h2 className="font-semibold text-white">Swap Advisor</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl leading-none">×</button>
        </div>

        <div className="p-6">
          <p className="text-sm text-white/60 mb-4">
            How to afford{" "}
            <span className="font-semibold text-white">{item.cardName}</span>{" "}
            at <span className="text-suns-gold font-semibold">{cents(item.listingPrice)}</span>?
          </p>

          {loading && (
            <div className="flex items-center gap-3 py-8 justify-center">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-suns-orange" />
              <span className="text-sm text-white/50">Analyzing your portfolio…</span>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          {result && (
            <div className="space-y-4">
              <div className="space-y-2">
                {result.sell_recommendations.map((rec, i) => (
                  <div key={i} className="rounded-lg border border-white/10 bg-white/5 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-white">{rec.card_name}</p>
                      <p className="text-sm font-semibold text-suns-orange">
                        {cents(rec.estimated_sale)}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-white/40">{rec.reason}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-suns-gold/30 bg-suns-gold/10 p-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-white/60">Total from sales</span>
                  <span className="font-semibold text-white">{cents(result.total_from_sales)}</span>
                </div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-white/60">Target price</span>
                  <span className="font-semibold text-white">{cents(result.target_price)}</span>
                </div>
                <div className="mt-2 border-t border-suns-gold/20 pt-2 flex justify-between text-sm">
                  <span className="text-white/60">Net position</span>
                  <span className={`font-bold ${result.net_position >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {result.net_position >= 0 ? "+" : ""}{cents(result.net_position)}
                  </span>
                </div>
              </div>

              <p className="text-xs text-white/50">{result.summary}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function TickerFeed() {
  const [items, setItems] = useState<TickerItem[]>(MOCK_ITEMS);
  const [filter, setFilter] = useState<SportFilter>("ALL");
  const [swapTarget, setSwapTarget] = useState<TickerItem | null>(null);
  const [lastPoll, setLastPoll] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/ticker");
      if (!res.ok) return;
      const data = (await res.json()) as { items: TickerItem[] };
      if (data.items.length > 0) setItems(data.items);
      setLastPoll(new Date());
    } catch {
      // silently skip failed polls
    }
  }, []);

  useEffect(() => {
    void poll();
    intervalRef.current = setInterval(() => void poll(), 30_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [poll]);

  const displayed =
    filter === "ALL" ? items : items.filter((i) => i.sport === filter);

  return (
    <>
      {swapTarget && (
        <SwapModal item={swapTarget} onClose={() => setSwapTarget(null)} />
      )}

      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Live Deal Ticker</h1>
            <p className="mt-0.5 text-sm text-white/50">
              Best current deals, sorted by discount. Updates every 30 seconds.
            </p>
          </div>
          {lastPoll && (
            <p className="text-xs text-white/25">
              Last updated {lastPoll.toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Sport filter */}
        <div className="flex flex-wrap gap-2">
          {(Object.keys(SPORT_LABELS) as SportFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors ${
                filter === s
                  ? "bg-suns-orange text-white"
                  : "border border-white/10 text-white/50 hover:text-white"
              }`}
            >
              {SPORT_LABELS[s]}
            </button>
          ))}
        </div>

        {/* Table header */}
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="grid grid-cols-[1fr_auto_auto_auto] border-b border-white/10 bg-suns-purple/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-white/30">
            <span>Card</span>
            <span className="hidden sm:block text-right pr-4">Price</span>
            <span>Discount</span>
            <span className="text-right">Action</span>
          </div>

          {displayed.length === 0 ? (
            <div className="bg-suns-purple/20 py-16 text-center text-sm text-white/30">
              No deals found for this filter.
            </div>
          ) : (
            <div className="bg-suns-purple/20 divide-y divide-white/5">
              {displayed.map((item) => (
                <DealRow
                  key={item.id}
                  item={item}
                  onSwap={(i) => setSwapTarget(i)}
                />
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-xs text-white/20">
          Mock data shown until eBay/TCGPlayer API approval. Live deals will appear automatically.
        </p>
      </div>
    </>
  );
}
