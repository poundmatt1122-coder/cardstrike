import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function centsToDisplay(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function timeAgo(date: Date) {
  const diff = Date.now() - date.getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const SPORT_COLORS: Record<string, string> = {
  BASKETBALL: "bg-suns-orange/20 text-suns-orange",
  FOOTBALL: "bg-blue-500/20 text-blue-400",
  BASEBALL: "bg-red-500/20 text-red-400",
  HOCKEY: "bg-cyan-500/20 text-cyan-400",
  SOCCER: "bg-green-500/20 text-green-400",
};

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getDashboardData(clerkId: string) {
  // Resolve the DB user from the Clerk ID.
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, name: true },
  });

  if (!user) {
    return {
      userName: null,
      portfolioValueCents: 0,
      activeAlertCount: 0,
      strikesThisMonth: 0,
      recentStrikes: [],
      activeAlerts: [],
    };
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // Run queries in parallel.
  const [watches, triggeredThisMonth, recentNotifications] = await Promise.all([
    // All active watches with card data (for portfolio value + alert list).
    prisma.watch.findMany({
      where: { userId: user.id },
      include: { card: true },
      orderBy: { updatedAt: "desc" },
    }),

    // Count of notifications SENT this month (= "strikes").
    prisma.notification.count({
      where: {
        userId: user.id,
        status: "SENT",
        sentAt: { gte: monthStart },
      },
    }),

    // Last 3 delivered notifications as the "recent strikes" feed.
    prisma.notification.findMany({
      where: { userId: user.id, status: "SENT" },
      orderBy: { sentAt: "desc" },
      take: 3,
      include: { watch: { include: { card: true } } },
    }),
  ]);

  // Portfolio value = sum of lastPrice for all watched cards.
  // Uses lastPrice which is updated by the worker on every price-check run.
  const portfolioValueCents = watches.reduce(
    (sum, w) => sum + (w.card.lastPrice ?? 0),
    0,
  );

  const activeAlerts = watches.filter((w) => w.status === "ACTIVE");

  // Parse each notification body for deal details.
  const recentStrikes = recentNotifications.map((n) => {
    let body: {
      listingPrice?: number;
      fairValue?: number;
      discountPct?: number;
      listingUrl?: string;
    } = {};
    try { body = JSON.parse(n.body) as typeof body; } catch { /* ignore */ }

    return {
      id: n.id,
      player: n.watch?.card?.player ?? "Unknown",
      card: n.watch?.card?.name ?? "Unknown Card",
      condition: n.watch?.card?.condition ?? "",
      sport: n.watch?.card?.sport ?? "OTHER",
      dealPrice: body.listingPrice ?? 0,
      savedCents: Math.max(0, (body.fairValue ?? 0) - (body.listingPrice ?? 0)),
      listingUrl: body.listingUrl ?? "#",
      triggeredAt: n.sentAt ?? n.createdAt,
    };
  });

  return {
    userName: user.name,
    portfolioValueCents,
    activeAlertCount: activeAlerts.length,
    strikesThisMonth: triggeredThisMonth,
    recentStrikes,
    activeAlerts: activeAlerts.slice(0, 4).map((w) => {
      const pct =
        w.card.lastPrice && w.card.lastPrice > w.targetPrice
          ? Math.round(((w.card.lastPrice - w.targetPrice) / w.targetPrice) * 100)
          : 0;
      return {
        id: w.id,
        player: w.card.player,
        card: w.card.name,
        condition: w.card.condition,
        sport: w.card.sport,
        currentPrice: w.card.lastPrice ?? 0,
        targetPrice: w.targetPrice,
        pctAway: pct,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function DashboardPage() {
  const { userId: clerkId } = await auth();

  // clerkId is guaranteed non-null here — the layout redirects if missing.
  const data = await getDashboardData(clerkId!);

  const stats = [
    {
      label: "Portfolio Value",
      value: centsToDisplay(data.portfolioValueCents),
      delta: "sum of tracked card prices",
      positive: null as boolean | null,
      icon: "💼",
    },
    {
      label: "Active Alerts",
      value: String(data.activeAlertCount),
      delta: "watching for price drops",
      positive: null as boolean | null,
      icon: "🔔",
    },
    {
      label: "Strikes This Month",
      value: String(data.strikesThisMonth),
      delta: "alerts delivered",
      positive: data.strikesThisMonth > 0,
      icon: "⚡",
    },
    {
      label: "Est. Savings",
      value: centsToDisplay(
        data.recentStrikes.reduce((s, r) => s + r.savedCents, 0),
      ),
      delta: "vs. market on recent deals",
      positive: true,
      icon: "💰",
    },
  ];

  const greeting =
    data.userName
      ? `Good morning, ${data.userName.split(" ")[0]} 👋`
      : "Good morning 👋";

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">{greeting}</h1>
        <p className="mt-1 text-white/50 text-sm">
          Here&apos;s what&apos;s happening with your card portfolio today.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-white/10 bg-suns-purple/40 p-5 backdrop-blur"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wider text-white/40">
                {s.label}
              </span>
              <span className="text-lg">{s.icon}</span>
            </div>
            <p className="mt-3 text-2xl font-bold">{s.value}</p>
            <p
              className={`mt-1 text-xs ${
                s.positive === true
                  ? "text-green-400"
                  : s.positive === false
                  ? "text-red-400"
                  : "text-white/40"
              }`}
            >
              {s.delta}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Recent strikes */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">Recent Strikes</h2>
            <Link href="/dashboard/alerts" className="text-xs text-suns-gold hover:underline">
              View all alerts →
            </Link>
          </div>

          {data.recentStrikes.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-suns-purple/30 py-12 text-center">
              <p className="text-sm text-white/40">No strikes yet.</p>
              <p className="mt-1 text-xs text-white/25">
                Set an alert and we&apos;ll notify you when a deal hits.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.recentStrikes.map((deal) => (
                <a
                  key={deal.id}
                  href={deal.listingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-4 rounded-xl border border-white/10 bg-suns-purple/40 p-4 transition-colors hover:border-suns-orange/30"
                >
                  <div className="flex h-14 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-suns-purple-soft text-xl">
                    🃏
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-sm">{deal.player}</p>
                    <p className="truncate text-xs text-white/50">{deal.card}</p>
                    <p className="text-xs text-white/40">{deal.condition}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-suns-gold">
                      {centsToDisplay(deal.dealPrice)}
                    </p>
                    {deal.savedCents > 0 && (
                      <p className="text-xs text-green-400">
                        saved {centsToDisplay(deal.savedCents)}
                      </p>
                    )}
                    <p className="text-xs text-white/30">
                      {timeAgo(deal.triggeredAt)}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* Active alerts */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">Active Alerts</h2>
            <Link href="/dashboard/alerts" className="text-xs text-suns-gold hover:underline">
              Manage →
            </Link>
          </div>

          {data.activeAlerts.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-suns-purple/30 py-12 text-center">
              <p className="text-sm text-white/40">No active alerts.</p>
              <Link
                href="/dashboard/alerts"
                className="mt-2 block text-xs text-suns-orange hover:underline"
              >
                Create your first alert →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {data.activeAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-xl border border-white/10 bg-suns-purple/40 p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                            SPORT_COLORS[alert.sport] ?? "bg-white/10 text-white/60"
                          }`}
                        >
                          {alert.sport.slice(0, 4)}
                        </span>
                        <p className="truncate text-sm font-medium">
                          {alert.player}
                        </p>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-white/50">
                        {alert.card} · {alert.condition}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-white">
                        {centsToDisplay(alert.currentPrice)}
                      </p>
                      <p className="text-xs text-white/40">
                        target {centsToDisplay(alert.targetPrice)}
                      </p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-[10px] text-white/40">
                      <span>Progress to strike</span>
                      <span>{alert.pctAway}% away</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-white/10">
                      <div
                        className="h-1.5 rounded-full bg-suns-orange transition-all"
                        style={{ width: `${Math.max(0, 100 - alert.pctAway)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
