"use client";

import { useCallback, useEffect, useState } from "react";

const CARRIERS = ["USPS", "UPS", "FedEx", "DHL", "Other"];

interface ShipmentData {
  id: string;
  userId: string;
  trackingNumber: string | null;
  carrier: string | null;
  shippedAt: string | null;
  confirmedAt: string | null;
  status: string;
  user: { id: string; name: string | null };
}

interface OfferData {
  id: string;
  status: string;
  listing: { cardName: string };
  fromUser: { id: string; name: string | null; email: string };
  toUser: { id: string; name: string | null; email: string };
}

interface Props { offerId: string; }

export default function ShippingClient({ offerId }: Props) {
  const [shipments, setShipments] = useState<ShipmentData[]>([]);
  const [offer, setOffer] = useState<OfferData | null>(null);
  const [loading, setLoading] = useState(true);
  const [trackingNumber, setTrackingNumber] = useState("");
  const [carrier, setCarrier] = useState("USPS");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/trade/shipping?offerId=${offerId}`);
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json() as { shipments: ShipmentData[]; offer: OfferData | null };
      setShipments(data.shipments ?? []);
      setOffer(data.offer);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [offerId]);

  useEffect(() => { void load(); }, [load]);

  async function markShipped() {
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/trade/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId, action: "ship", trackingNumber, carrier }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setSubmitting(false); }
  }

  async function confirmReceipt() {
    setSubmitting(true); setError("");
    try {
      const res = await fetch("/api/trade/shipping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offerId, action: "confirm" }),
      });
      const data = await res.json() as { error?: string; bothConfirmed?: boolean };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setSubmitting(false); }
  }

  if (loading) return <div className="py-20 text-center text-white/40 text-sm">Loading…</div>;

  if (!offer) return (
    <div className="mx-auto max-w-2xl py-20 text-center">
      <p className="text-xl text-white/40">Trade not found.</p>
      <p className="text-sm text-white/25 mt-2">The offer ID &ldquo;{offerId}&rdquo; does not exist or you don&apos;t have access.</p>
      <a href="/dashboard/trade/offers" className="mt-6 inline-block text-sm text-suns-orange hover:underline">← Back to Offers</a>
    </div>
  );

  const myShipment = shipments.find((s) => s.user && offer && (s.userId === offer.fromUser.id || s.userId === offer.toUser.id));
  const theirShipment = shipments.find((s) => s !== myShipment);
  const isComplete = offer.status === "completed";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Shipping Checklist</h1>
        <p className="mt-0.5 text-sm text-white/50">
          Trade: <span className="text-white">{offer.listing.cardName}</span> between{" "}
          <span className="text-white">{offer.fromUser.name}</span> and{" "}
          <span className="text-white">{offer.toUser.name}</span>
        </p>
      </div>

      {isComplete && (
        <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-5 text-center">
          <p className="text-2xl mb-2">🎉</p>
          <p className="font-semibold text-green-400">Trade Complete!</p>
          <p className="text-sm text-white/50 mt-1">Both parties have confirmed receipt. You can now rate each other.</p>
          <a href="/dashboard/trade/offers" className="mt-3 inline-block text-sm text-suns-orange hover:underline">Rate your trade →</a>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-suns-purple/40 p-5 space-y-4">
          <h2 className="font-semibold text-white">Your Shipment</h2>
          {myShipment?.status === "confirmed" ? (
            <p className="text-sm text-green-400">✓ Receipt confirmed</p>
          ) : myShipment?.shippedAt ? (
            <div className="space-y-2">
              <p className="text-sm text-suns-gold">📦 Shipped</p>
              {myShipment.trackingNumber && (
                <p className="text-xs text-white/60">{myShipment.carrier} · {myShipment.trackingNumber}</p>
              )}
              {!isComplete && (
                <button onClick={confirmReceipt} disabled={submitting} className="w-full rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50">
                  ✓ Confirm Receipt
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs text-white/40">Carrier</label>
                <select value={carrier} onChange={(e) => setCarrier(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white focus:border-suns-orange focus:outline-none">
                  {CARRIERS.map((c) => <option key={c} value={c} className="bg-suns-purple-deep">{c}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-white/40">Tracking number</label>
                <input value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Optional"
                  className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-suns-orange focus:outline-none"/>
              </div>
              <button onClick={markShipped} disabled={submitting} className="w-full rounded-lg bg-suns-orange py-2.5 text-sm font-semibold text-white hover:bg-suns-orange-soft disabled:opacity-50">
                {submitting ? "Saving…" : "Mark as Shipped"}
              </button>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-white/10 bg-suns-purple/40 p-5 space-y-4">
          <h2 className="font-semibold text-white">Their Shipment</h2>
          {!theirShipment ? (
            <p className="text-sm text-white/40">Waiting for them to ship…</p>
          ) : theirShipment.status === "confirmed" ? (
            <p className="text-sm text-green-400">✓ They confirmed receipt</p>
          ) : theirShipment.shippedAt ? (
            <div>
              <p className="text-sm text-suns-gold">📦 Shipped</p>
              {theirShipment.trackingNumber && (
                <p className="text-xs text-white/60 mt-1">{theirShipment.carrier} · {theirShipment.trackingNumber}</p>
              )}
            </div>
          ) : (
            <p className="text-sm text-white/40">Not yet shipped</p>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="rounded-xl border border-white/10 bg-suns-purple/30 p-4 text-xs text-white/40 space-y-1">
        <p>📌 If the other party hasn&apos;t confirmed receipt after <strong className="text-white/60">14 days</strong>, a reminder will be sent automatically.</p>
        <p>🚨 After <strong className="text-white/60">21 days</strong> without confirmation, a dispute will be opened with CardStrike support.</p>
      </div>
    </div>
  );
}
