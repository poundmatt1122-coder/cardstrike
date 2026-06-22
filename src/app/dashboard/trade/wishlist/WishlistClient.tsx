"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WishlistItem {
  id: string;
  cardName: string;
  setName: string;
  game: string;
  grade: string;
  maxPrice: number | null;
  createdAt: string;
}

interface WishlistMatch {
  wishlistItem: WishlistItem;
  listing: {
    id: string;
    cardName: string;
    setName: string;
    grade: string;
    estimatedValue: number;
    user: { id: string; name: string | null };
  };
}

const GAMES = ["Pokémon", "Sports", "Magic", "Other"];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function WishlistClient() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [matches, setMatches] = useState<WishlistMatch[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [form, setForm] = useState({
    cardName: "", setName: "", game: "Pokémon", grade: "", maxPrice: "",
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [showForm, setShowForm] = useState(false);

  function setField(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setFormError("");
  }

  const loadData = useCallback(async () => {
    try {
      const [wRes, mRes] = await Promise.all([
        fetch("/api/trade/wishlist"),
        fetch("/api/trade/match"),
      ]);
      const wData = (await wRes.json()) as { items: WishlistItem[] };
      const mData = (await mRes.json()) as { matches: WishlistMatch[] };
      setItems(wData.items ?? []);
      setMatches(mData.matches ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!form.cardName.trim()) { setFormError("Card name is required."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/trade/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardName: form.cardName.trim(),
          setName: form.setName.trim(),
          game: form.game,
          grade: form.grade.trim(),
          maxPrice: form.maxPrice ? parseFloat(form.maxPrice) : undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setForm({ cardName: "", setName: "", game: "Pokémon", grade: "", maxPrice: "" });
      setShowForm(false);
      await loadData();
    } catch {
      setFormError("Failed to add item.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/trade/wishlist?id=${id}`, { method: "DELETE" });
    await loadData();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Wishlist</h1>
          <p className="mt-0.5 text-sm text-white/50">
            We&apos;ll alert you when a matching card is listed for trade.
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-suns-orange px-4 py-2 text-sm font-semibold text-white hover:bg-suns-orange-soft transition-colors"
        >
          + Add Card
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={addItem} className="rounded-xl border border-suns-orange/30 bg-suns-purple/60 p-5 space-y-4">
          <h3 className="text-sm font-semibold text-suns-gold">New Wishlist Item</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { label: "Card name *", key: "cardName" as const, placeholder: "e.g. Charizard Holo" },
              { label: "Set name", key: "setName" as const, placeholder: "e.g. Base Set" },
            ].map(({ label, key, placeholder }) => (
              <div key={key} className="space-y-1">
                <label className="text-xs text-white/50">{label}</label>
                <input
                  className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-suns-orange focus:outline-none"
                  placeholder={placeholder}
                  value={form[key]}
                  onChange={(e) => setField(key, e.target.value)}
                />
              </div>
            ))}
            <div className="space-y-1">
              <label className="text-xs text-white/50">Game</label>
              <select
                className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white focus:border-suns-orange focus:outline-none"
                value={form.game}
                onChange={(e) => setField("game", e.target.value)}
              >
                {GAMES.map((g) => <option key={g} value={g} className="bg-suns-purple-deep">{g}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs text-white/50">Min grade (optional)</label>
              <input
                className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-suns-orange focus:outline-none"
                placeholder="e.g. PSA 8"
                value={form.grade}
                onChange={(e) => setField("grade", e.target.value)}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs text-white/50">Max price (optional)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
                <input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={form.maxPrice}
                  onChange={(e) => setField("maxPrice", e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 pl-7 pr-3 py-2 text-sm text-white placeholder-white/30 focus:border-suns-orange focus:outline-none"
                />
              </div>
            </div>
          </div>
          {formError && <p className="text-xs text-red-400">{formError}</p>}
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="rounded-lg bg-suns-orange px-5 py-2 text-sm font-semibold text-white hover:bg-suns-orange-soft disabled:opacity-50">
              {saving ? "Saving…" : "Add to Wishlist"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-lg border border-white/10 px-5 py-2 text-sm text-white/50 hover:text-white">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Matches */}
      {matches.length > 0 && (
        <section>
          <h2 className="font-semibold text-suns-gold mb-3 flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            {matches.length} trade match{matches.length > 1 ? "es" : ""} found!
          </h2>
          <div className="space-y-3">
            {matches.map((m, i) => (
              <div key={i} className="rounded-xl border border-suns-gold/30 bg-suns-gold/5 p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-white">{m.listing.cardName}</p>
                  <p className="text-xs text-white/50">
                    {m.listing.setName} · {m.listing.grade} · listed by{" "}
                    <Link href={`/profile/${m.listing.user.id}`} className="text-suns-gold hover:underline">
                      {m.listing.user.name ?? "Unknown"}
                    </Link>
                  </p>
                  <p className="text-sm font-semibold text-suns-gold mt-1">${m.listing.estimatedValue.toFixed(2)}</p>
                </div>
                <Link
                  href="/dashboard/trade"
                  className="flex-shrink-0 rounded-lg bg-suns-orange px-4 py-2 text-xs font-semibold text-white hover:bg-suns-orange-soft transition-colors"
                >
                  View match →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Wishlist items */}
      <section>
        <h2 className="font-semibold text-white mb-3">Your Wishlist</h2>
        {loading ? (
          <div className="py-12 text-center text-white/40 text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-suns-purple/30 py-12 text-center">
            <p className="text-white/40">Your wishlist is empty.</p>
            <p className="text-xs text-white/25 mt-1">Add cards to get notified when they appear on the trade board.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="flex items-center gap-4 rounded-xl border border-white/10 bg-suns-purple/40 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-white">{item.cardName}</p>
                  <p className="text-xs text-white/50">
                    {item.setName ? `${item.setName} · ` : ""}{item.game}
                    {item.grade ? ` · min ${item.grade}` : ""}
                    {item.maxPrice ? ` · max $${item.maxPrice.toFixed(2)}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => void remove(item.id)}
                  className="text-xs text-red-400/60 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
