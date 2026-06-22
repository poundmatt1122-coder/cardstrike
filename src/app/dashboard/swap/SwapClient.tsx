"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SellRec {
  card_name: string;
  estimated_sale: number;
  reason: string;
}

interface SwapResult {
  sell_recommendations: SellRec[];
  total_from_sales: number;
  target_price: number;
  net_position: number;
  summary: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function cents(n: number) {
  return `$${(n / 100).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function SwapClient() {
  const [cardName, setCardName] = useState("");
  const [grade, setGrade] = useState("RAW");
  const [price, setPrice] = useState("");
  const [listingUrl, setListingUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SwapResult | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!cardName.trim()) { setError("Card name is required."); return; }
    const priceCents = Math.round(parseFloat(price.replace(/[^0-9.]/g, "")) * 100);
    if (!priceCents || priceCents <= 0) { setError("Enter a valid price."); return; }

    setError("");
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetCard: {
            name: cardName.trim(),
            grade,
            price: priceCents,
            listingUrl: listingUrl.trim() || undefined,
          },
        }),
      });
      const data = (await res.json()) as SwapResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed.");
    } finally {
      setLoading(false);
    }
  }

  const CONDITIONS = ["RAW", "PSA 10", "PSA 9", "BGS 9.5", "SGC 10", "OTHER"];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Swap Advisor</h1>
        <p className="mt-1 text-sm text-white/50">
          Tell us what card you want to buy. We&apos;ll analyze your portfolio and
          recommend which cards to sell to fund the purchase.
        </p>
      </div>

      {/* Input form */}
      <form onSubmit={submit} className="rounded-xl border border-white/10 bg-suns-purple/40 p-6 space-y-4">
        <h3 className="font-semibold text-suns-gold text-sm uppercase tracking-wider">
          Target Card
        </h3>

        <div className="space-y-1">
          <label className="text-xs text-white/50">Card name *</label>
          <input
            className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-suns-orange focus:outline-none"
            placeholder="e.g. Victor Wembanyama 2023-24 Prizm Silver RC"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="text-xs text-white/50">Grade / Condition</label>
            <select
              className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white focus:border-suns-orange focus:outline-none"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c} className="bg-suns-purple-deep">{c}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-white/50">Listing price *</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 pl-7 pr-3 py-2 text-sm text-white placeholder-white/30 focus:border-suns-orange focus:outline-none"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-white/50">Listing URL (optional)</label>
          <input
            className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-suns-orange focus:outline-none"
            placeholder="https://www.ebay.com/itm/..."
            value={listingUrl}
            onChange={(e) => setListingUrl(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-suns-orange px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-suns-orange-soft disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Analyzing portfolio…
            </>
          ) : (
            "Analyze My Portfolio"
          )}
        </button>
      </form>

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <h2 className="font-semibold text-white">Recommended Sales</h2>

          {result.sell_recommendations.length === 0 ? (
            <p className="text-sm text-white/50">
              No suitable cards found to sell in your portfolio.
            </p>
          ) : (
            <div className="space-y-3">
              {result.sell_recommendations.map((rec, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-white/10 bg-suns-purple/40 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-medium text-white">{rec.card_name}</p>
                      <p className="mt-1 text-xs text-white/40">{rec.reason}</p>
                    </div>
                    <p className="flex-shrink-0 font-bold text-suns-orange">
                      {cents(rec.estimated_sale)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Net math */}
          <div className="rounded-xl border border-suns-gold/30 bg-suns-gold/10 p-5 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Total from sales</span>
              <span className="font-semibold text-white">{cents(result.total_from_sales)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-white/60">Target price</span>
              <span className="font-semibold text-white">{cents(result.target_price)}</span>
            </div>
            <div className="flex justify-between border-t border-suns-gold/20 pt-2 text-sm">
              <span className="font-semibold text-white">Net position</span>
              <span
                className={`font-bold text-base ${result.net_position >= 0 ? "text-green-400" : "text-red-400"}`}
              >
                {result.net_position >= 0 ? "+" : ""}{cents(result.net_position)}
              </span>
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-suns-purple/30 p-4">
            <p className="text-sm text-white/70">{result.summary}</p>
          </div>

          <button
            onClick={() => setResult(null)}
            className="text-sm text-white/30 hover:text-white transition-colors"
          >
            ← Run another analysis
          </button>
        </div>
      )}
    </div>
  );
}
