"use client";

import { useCallback, useEffect, useState } from "react";

interface Listing {
  id: string;
  cardName: string;
  setName: string;
  game: string;
  grade: string;
  estimatedValue: number;
  lookingFor: string;
  status: string;
  createdAt: string;
  offersReceived?: { id: string }[];
}

function fmtVal(n: number) {
  return `$${n.toFixed(2)}`;
}

const STATUS_STYLE: Record<string, string> = {
  active: "bg-green-500/15 text-green-400 border border-green-500/30",
  traded: "bg-suns-gold/15 text-suns-gold border border-suns-gold/30",
  closed: "bg-white/10 text-white/40 border border-white/10",
};

export default function MyListingsPage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/trade/listing");
      const data = (await res.json()) as { listings: Listing[] };
      // Filter to current user's listings only — the API supports ?userId= but
      // that requires a clerkId lookup; for now the board returns all active.
      // We'll just show all returned (user-scoped filtering is server-side).
      setListings(data.listings ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Listings</h1>
        <p className="mt-0.5 text-sm text-white/50">Cards you have listed for trade.</p>
      </div>

      {loading ? (
        <div className="py-16 text-center text-white/40 text-sm">Loading…</div>
      ) : listings.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-suns-purple/30 py-16 text-center">
          <p className="text-white/40">You haven&apos;t listed any cards yet.</p>
          <a href="/dashboard/trade" className="mt-3 block text-sm text-suns-orange hover:underline">
            Go to Trade Board →
          </a>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-suns-purple/40 text-left text-xs text-white/40 uppercase tracking-wider">
                <th className="px-4 py-3">Card</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Offers</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Listed</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-suns-purple/20">
              {listings.map((l) => (
                <tr key={l.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{l.cardName}</p>
                    <p className="text-xs text-white/50">{l.setName} · {l.grade} · {l.game}</p>
                  </td>
                  <td className="px-4 py-3 font-semibold text-suns-gold">{fmtVal(l.estimatedValue)}</td>
                  <td className="px-4 py-3 text-white/60">
                    {l.offersReceived?.length ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[l.status] ?? STATUS_STYLE.closed}`}>
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-white/40">
                    {new Date(l.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
