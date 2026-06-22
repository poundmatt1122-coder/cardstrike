import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------

async function getProfileData(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      createdAt: true,
      phoneVerified: true,
      isMinor: true,
    },
  });

  if (!user) return null;

  const [listings, ratingStats, completedTradeCount] = await Promise.all([
    prisma.tradeListing.findMany({
      where: { userId, status: "active" },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.tradeRating.aggregate({
      where: { ratedUserId: userId },
      _avg: { rating: true },
      _count: { rating: true },
    }),
    prisma.tradeOffer.count({
      where: {
        status: "completed",
        OR: [{ fromUserId: userId }, { toUserId: userId }],
      },
    }),
  ]);

  // Rating breakdown (1-5 stars).
  const breakdown = await prisma.tradeRating.groupBy({
    by: ["rating"],
    where: { ratedUserId: userId },
    _count: { rating: true },
    orderBy: { rating: "desc" },
  });

  return { user, listings, ratingStats, breakdown, completedTradeCount };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtVal(n: number) {
  return `$${n.toFixed(2)}`;
}

const GAME_COLORS: Record<string, string> = {
  Pokémon: "bg-yellow-500/20 text-yellow-400",
  Sports: "bg-suns-orange/20 text-suns-orange",
  Magic: "bg-purple-500/20 text-purple-400",
  Other: "bg-white/10 text-white/40",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const data = await getProfileData(userId);
  if (!data) notFound();

  const { user, listings, ratingStats, breakdown, completedTradeCount } = data;
  const avgRating = ratingStats._avg.rating ?? 0;
  const totalTrades = ratingStats._count.rating;

  const accountAgeDays = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24));
  const isNewMember = accountAgeDays < 30 && completedTradeCount < 3;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-10">
      {/* Profile header */}
      <div className="flex items-center gap-6">
        {user.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.imageUrl}
            alt={user.name ?? ""}
            className="h-20 w-20 rounded-full object-cover border-2 border-white/10"
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-suns-purple-soft text-2xl font-bold text-white border-2 border-white/10">
            {(user.name ?? "?").slice(0, 2).toUpperCase()}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-white">{user.name ?? "Anonymous Trader"}</h1>
          <p className="text-sm text-white/40 mt-0.5">
            Member since {new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </p>
          {totalTrades > 0 ? (
            <p className="mt-1 text-sm text-suns-gold font-semibold">
              ⭐ {avgRating.toFixed(1)} <span className="text-white/40 font-normal">({totalTrades} completed trades)</span>
            </p>
          ) : (
            <p className="mt-1 text-sm text-white/40">No completed trades yet</p>
          )}
        </div>
      </div>

      {/* Trust badges */}
      <div className="flex flex-wrap gap-2">
        {user.phoneVerified && (
          <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs font-semibold text-green-400">✅ Verified</span>
        )}
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/60">
          📦 {completedTradeCount} trade{completedTradeCount !== 1 ? "s" : ""}
        </span>
        {avgRating > 0 && (
          <span className="rounded-full bg-suns-gold/20 px-3 py-1 text-xs font-semibold text-suns-gold">⭐ {avgRating.toFixed(1)}</span>
        )}
        <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/60">
          🛡️ Member since {new Date(user.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </span>
        {user.isMinor ? (
          <span className="rounded-full bg-blue-500/20 px-3 py-1 text-xs font-semibold text-blue-400">👤 Junior</span>
        ) : (
          <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-semibold text-purple-400">🔞 Adult</span>
        )}
        {isNewMember && (
          <span className="rounded-full bg-red-500/20 px-3 py-1 text-xs font-semibold text-red-400">🚨 New Member</span>
        )}
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Listings */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="font-semibold text-white">
            Cards for Trade
            <span className="ml-2 text-white/40 text-sm font-normal">({listings.length})</span>
          </h2>

          {listings.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-suns-purple/30 py-12 text-center">
              <p className="text-sm text-white/40">No active trade listings.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {listings.map((l) => (
                <div key={l.id} className="rounded-xl border border-white/10 bg-suns-purple/40 p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${GAME_COLORS[l.game] ?? GAME_COLORS.Other}`}>
                        {l.game}
                      </span>
                      <span className="text-xs text-white/40">{l.grade}</span>
                    </div>
                    <p className="font-medium text-white">{l.cardName}</p>
                    <p className="text-xs text-white/50">{l.setName}</p>
                    <p className="text-xs text-white/40 mt-1">Looking for: {l.lookingFor}</p>
                  </div>
                  <div className="text-right flex-shrink-0 space-y-2">
                    <p className="font-bold text-suns-gold">{fmtVal(l.estimatedValue)}</p>
                    <Link
                      href="/dashboard/trade"
                      className="block rounded-lg bg-suns-orange px-3 py-1.5 text-xs font-semibold text-white hover:bg-suns-orange-soft transition-colors"
                    >
                      Make Offer
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Rating sidebar */}
        <div className="space-y-4">
          <h2 className="font-semibold text-white">Trade Reputation</h2>
          {totalTrades === 0 ? (
            <div className="rounded-xl border border-white/10 bg-suns-purple/30 p-5 text-center">
              <p className="text-sm text-white/40">No ratings yet.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-white/10 bg-suns-purple/40 p-5 space-y-4">
              <div className="text-center">
                <p className="text-4xl font-bold text-suns-gold">{avgRating.toFixed(1)}</p>
                <p className="text-xs text-white/40 mt-1">{totalTrades} trades completed</p>
                <div className="mt-2 text-lg">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <span key={n} className={n <= Math.round(avgRating) ? "opacity-100" : "opacity-20"}>⭐</span>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = breakdown.find((b) => b.rating === star)?._count.rating ?? 0;
                  const pct = totalTrades > 0 ? (count / totalTrades) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-2 text-xs">
                      <span className="w-6 text-white/40 text-right">{star}★</span>
                      <div className="flex-1 h-1.5 rounded-full bg-white/10">
                        <div
                          className="h-1.5 rounded-full bg-suns-gold"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-6 text-white/40">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <Link
            href="/dashboard/trade"
            className="block w-full rounded-lg bg-suns-orange py-2.5 text-center text-sm font-semibold text-white hover:bg-suns-orange-soft transition-colors"
          >
            Send Trade Offer
          </Link>
        </div>
      </div>
    </div>
  );
}
