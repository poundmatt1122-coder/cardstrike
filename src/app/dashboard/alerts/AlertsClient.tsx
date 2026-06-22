"use client";

import { useState } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WatchStatus = "ACTIVE" | "TRIGGERED" | "PAUSED";
type Sport = "BASKETBALL" | "FOOTBALL" | "BASEBALL" | "HOCKEY" | "SOCCER" | "OTHER";

interface AlertRule {
  id: string;
  player: string;
  card: string;
  condition: string;
  sport: Sport;
  targetPrice: number;
  currentPrice: number;
  status: WatchStatus;
  createdAt: string;
  triggeredAt?: string;
}

// ---------------------------------------------------------------------------
// Mock seed data
// ---------------------------------------------------------------------------

const SEED_ALERTS: AlertRule[] = [
  {
    id: "a1",
    player: "Victor Wembanyama",
    card: "2023-24 Prizm Silver RC",
    condition: "PSA 10",
    sport: "BASKETBALL",
    targetPrice: 28000,
    currentPrice: 30200,
    status: "ACTIVE",
    createdAt: "2026-06-01T10:00:00Z",
  },
  {
    id: "a2",
    player: "Patrick Mahomes",
    card: "2017 National Treasures RPA /99",
    condition: "RAW",
    sport: "FOOTBALL",
    targetPrice: 120000,
    currentPrice: 125000,
    status: "ACTIVE",
    createdAt: "2026-06-05T14:30:00Z",
  },
  {
    id: "a3",
    player: "Caitlin Clark",
    card: "2024 Prizm Draft Picks Silver",
    condition: "RAW",
    sport: "BASKETBALL",
    targetPrice: 4500,
    currentPrice: 5200,
    status: "ACTIVE",
    createdAt: "2026-06-10T08:00:00Z",
  },
  {
    id: "a4",
    player: "Shohei Ohtani",
    card: "2018 Topps Update RC",
    condition: "PSA 9",
    sport: "BASEBALL",
    targetPrice: 15000,
    currentPrice: 14800,
    status: "TRIGGERED",
    createdAt: "2026-05-20T11:00:00Z",
    triggeredAt: "2026-06-18T21:45:00Z",
  },
  {
    id: "a5",
    player: "Connor Bedard",
    card: "2023-24 Upper Deck Young Guns",
    condition: "RAW",
    sport: "HOCKEY",
    targetPrice: 12000,
    currentPrice: 12900,
    status: "PAUSED",
    createdAt: "2026-05-15T09:00:00Z",
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function centsToDisplay(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function parseDollarsToCents(val: string): number {
  return Math.round(parseFloat(val.replace(/[^0-9.]/g, "")) * 100);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const STATUS_STYLES: Record<WatchStatus, string> = {
  ACTIVE: "bg-green-500/15 text-green-400 border border-green-500/30",
  TRIGGERED: "bg-suns-gold/15 text-suns-gold border border-suns-gold/30",
  PAUSED: "bg-white/10 text-white/40 border border-white/10",
};

const SPORT_COLORS: Record<Sport, string> = {
  BASKETBALL: "text-suns-orange",
  FOOTBALL: "text-blue-400",
  BASEBALL: "text-red-400",
  HOCKEY: "text-cyan-400",
  SOCCER: "text-green-400",
  OTHER: "text-white/50",
};

const CONDITIONS = ["RAW", "PSA 10", "PSA 9", "BGS 9.5", "SGC 10", "OTHER"];
const SPORTS: Sport[] = ["BASKETBALL", "FOOTBALL", "BASEBALL", "HOCKEY", "SOCCER", "OTHER"];

// ---------------------------------------------------------------------------
// Create Alert Form
// ---------------------------------------------------------------------------

interface FormState {
  player: string;
  card: string;
  condition: string;
  sport: Sport;
  targetPrice: string;
}

const EMPTY_FORM: FormState = {
  player: "",
  card: "",
  condition: "RAW",
  sport: "BASKETBALL",
  targetPrice: "",
};

function CreateAlertForm({ onAdd, onCancel }: { onAdd: (a: AlertRule) => void; onCancel: () => void }) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState("");

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
    setError("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.player.trim()) { setError("Player name is required."); return; }
    if (!form.card.trim()) { setError("Card name is required."); return; }
    if (!form.targetPrice || isNaN(parseDollarsToCents(form.targetPrice))) {
      setError("Enter a valid target price."); return;
    }
    const cents = parseDollarsToCents(form.targetPrice);
    if (cents <= 0) { setError("Target price must be greater than $0."); return; }

    onAdd({
      id: `new-${Date.now()}`,
      player: form.player.trim(),
      card: form.card.trim(),
      condition: form.condition,
      sport: form.sport,
      targetPrice: cents,
      currentPrice: Math.round(cents * 1.12), // mock: 12% above target
      status: "ACTIVE",
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-xl border border-suns-orange/40 bg-suns-purple/60 p-6 backdrop-blur"
    >
      <h3 className="mb-5 font-semibold text-suns-gold">New Alert Rule</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="text-xs text-white/50">Player name *</label>
          <input
            className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-suns-orange focus:outline-none"
            placeholder="e.g. LeBron James"
            value={form.player}
            onChange={(e) => set("player", e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-white/50">Card name *</label>
          <input
            className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-suns-orange focus:outline-none"
            placeholder="e.g. 2003-04 Topps Chrome RC"
            value={form.card}
            onChange={(e) => set("card", e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-white/50">Sport</label>
          <select
            className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white focus:border-suns-orange focus:outline-none"
            value={form.sport}
            onChange={(e) => set("sport", e.target.value)}
          >
            {SPORTS.map((s) => (
              <option key={s} value={s} className="bg-suns-purple-deep">
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-white/50">Condition</label>
          <select
            className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 px-3 py-2 text-sm text-white focus:border-suns-orange focus:outline-none"
            value={form.condition}
            onChange={(e) => set("condition", e.target.value)}
          >
            {CONDITIONS.map((c) => (
              <option key={c} value={c} className="bg-suns-purple-deep">
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1 sm:col-span-2">
          <label className="text-xs text-white/50">Strike price (alert me when it drops to) *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">$</span>
            <input
              className="w-full rounded-lg border border-white/10 bg-suns-purple-soft/60 pl-7 pr-3 py-2 text-sm text-white placeholder-white/30 focus:border-suns-orange focus:outline-none"
              placeholder="0.00"
              type="number"
              min="0"
              step="0.01"
              value={form.targetPrice}
              onChange={(e) => set("targetPrice", e.target.value)}
            />
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-xs text-red-400">{error}</p>
      )}

      <div className="mt-5 flex gap-3">
        <button
          type="submit"
          className="rounded-lg bg-suns-orange px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-suns-orange-soft"
        >
          Create Alert
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-white/10 px-5 py-2 text-sm font-medium text-white/60 transition-colors hover:text-white"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export default function AlertsClient() {
  const [alerts, setAlerts] = useState<AlertRule[]>(SEED_ALERTS);
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState<WatchStatus | "ALL">("ALL");

  function addAlert(alert: AlertRule) {
    setAlerts((prev) => [alert, ...prev]);
    setShowForm(false);
  }

  function toggleStatus(id: string) {
    setAlerts((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: a.status === "ACTIVE" ? "PAUSED" : "ACTIVE" }
          : a
      )
    );
  }

  function deleteAlert(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  const filtered = filter === "ALL" ? alerts : alerts.filter((a) => a.status === filter);

  const counts = {
    ALL: alerts.length,
    ACTIVE: alerts.filter((a) => a.status === "ACTIVE").length,
    TRIGGERED: alerts.filter((a) => a.status === "TRIGGERED").length,
    PAUSED: alerts.filter((a) => a.status === "PAUSED").length,
  };

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Alert Rules</h1>
          <p className="mt-0.5 text-sm text-white/50">
            Get a strike notification the moment a price hits your target.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-suns-orange px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-suns-orange-soft"
          >
            <span className="text-base leading-none">+</span> New Alert
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <CreateAlertForm onAdd={addAlert} onCancel={() => setShowForm(false)} />
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-xl border border-white/10 bg-suns-purple/30 p-1 w-fit">
        {(["ALL", "ACTIVE", "TRIGGERED", "PAUSED"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
              filter === f
                ? "bg-suns-orange text-white"
                : "text-white/50 hover:text-white"
            }`}
          >
            {f} <span className="opacity-60">({counts[f]})</span>
          </button>
        ))}
      </div>

      {/* Alerts table */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-suns-purple/30 py-16 text-center">
          <p className="text-white/40">No {filter !== "ALL" ? filter.toLowerCase() : ""} alerts yet.</p>
          {filter === "ALL" && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-sm text-suns-orange hover:underline"
            >
              Create your first alert →
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-suns-purple/40 text-left text-xs text-white/40 uppercase tracking-wider">
                <th className="px-4 py-3">Card</th>
                <th className="px-4 py-3">Target</th>
                <th className="px-4 py-3">Current</th>
                <th className="px-4 py-3">Away</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 bg-suns-purple/20">
              {filtered.map((alert) => {
                const pctAway =
                  alert.currentPrice > alert.targetPrice
                    ? Math.round(((alert.currentPrice - alert.targetPrice) / alert.targetPrice) * 100)
                    : 0;

                return (
                  <tr key={alert.id} className="transition-colors hover:bg-white/5">
                    <td className="px-4 py-3">
                      <p className="font-medium text-white">{alert.player}</p>
                      <p className="text-xs text-white/50">{alert.card}</p>
                      <p className={`text-[10px] font-semibold ${SPORT_COLORS[alert.sport]}`}>
                        {alert.condition} · {alert.sport.slice(0, 4)}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-semibold text-suns-gold">
                      {centsToDisplay(alert.targetPrice)}
                    </td>
                    <td className="px-4 py-3 text-white">
                      {centsToDisplay(alert.currentPrice)}
                    </td>
                    <td className="px-4 py-3">
                      {alert.status === "TRIGGERED" ? (
                        <span className="text-suns-gold font-semibold">⚡ Hit!</span>
                      ) : (
                        <span className={pctAway <= 5 ? "text-green-400 font-semibold" : "text-white/50"}>
                          {pctAway}%
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[alert.status]}`}>
                        {alert.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-white/40">
                      {formatDate(alert.createdAt)}
                      {alert.triggeredAt && (
                        <p className="text-suns-gold/60">
                          Struck {formatDate(alert.triggeredAt)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {alert.status !== "TRIGGERED" && (
                          <button
                            onClick={() => toggleStatus(alert.id)}
                            className="rounded px-2 py-1 text-xs text-white/50 hover:bg-white/10 hover:text-white transition-colors"
                            title={alert.status === "ACTIVE" ? "Pause alert" : "Resume alert"}
                          >
                            {alert.status === "ACTIVE" ? "Pause" : "Resume"}
                          </button>
                        )}
                        <button
                          onClick={() => deleteAlert(alert.id)}
                          className="rounded px-2 py-1 text-xs text-red-400/60 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                          title="Delete alert"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-center text-xs text-white/20">
        Showing mock data — live prices will update once marketplace API access is approved.
      </p>
    </div>
  );
}
