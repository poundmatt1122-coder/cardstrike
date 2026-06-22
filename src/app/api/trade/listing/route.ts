import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rateLimit";

// ---------------------------------------------------------------------------
// GET — fetch all active listings (with owner + rating summary)
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const game = searchParams.get("game");
  const userId = searchParams.get("userId"); // filter to one user's listings

  const listings = await prisma.tradeListing.findMany({
    where: {
      status: "active",
      ...(game && game !== "All" ? { game } : {}),
      ...(userId ? { userId } : {}),
    },
    include: {
      user: { select: { id: true, name: true, imageUrl: true, createdAt: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  // Attach average rating for each listing owner.
  const userIds = [...new Set(listings.map((l) => l.userId))];
  const ratings = await prisma.tradeRating.groupBy({
    by: ["ratedUserId"],
    where: { ratedUserId: { in: userIds } },
    _avg: { rating: true },
    _count: { rating: true },
  });
  const ratingMap = new Map(
    ratings.map((r) => [
      r.ratedUserId,
      { avg: r._avg.rating ?? 0, count: r._count.rating },
    ]),
  );

  const enriched = listings.map((l) => ({
    ...l,
    ownerRating: ratingMap.get(l.userId) ?? { avg: 0, count: 0 },
  }));

  return NextResponse.json({ listings: enriched });
}

// ---------------------------------------------------------------------------
// POST — create a new listing and run the wishlist match engine
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const listKey = `rate:listing:${user.id}`;
  const { allowed: listAllowed } = await rateLimit(listKey, 10, 24 * 60 * 60);
  if (!listAllowed) return NextResponse.json({ error: "Too many requests — try again later" }, { status: 429 });
  if (!user.phoneVerified) return NextResponse.json({ error: "Verify your phone to post trade listings" }, { status: 403 });
  if (user.isMinor && !user.parentApproved) return NextResponse.json({ error: "Account pending parent approval" }, { status: 403 });
  const reportCount = await prisma.report.count({ where: { reportedUserId: user.id, status: "pending" } });
  if (reportCount >= 3) return NextResponse.json({ error: "Your account is under review. Contact support@cardstrike.gg" }, { status: 403 });

  let body: {
    cardName: string;
    setName: string;
    game: string;
    grade: string;
    condition: string;
    estimatedValue: number;
    lookingFor: string;
    notes?: string;
    imageUrl?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const listing = await prisma.tradeListing.create({
    data: {
      userId: user.id,
      cardName: body.cardName,
      setName: body.setName,
      game: body.game,
      grade: body.grade,
      condition: body.condition,
      estimatedValue: body.estimatedValue,
      lookingFor: body.lookingFor,
      notes: body.notes ?? null,
      imageUrl: body.imageUrl ?? null,
    },
  });

  // Run wishlist match engine asynchronously (fire and forget).
  void runWishlistMatch(listing.id, user.id, body.cardName, body.game, body.grade);

  return NextResponse.json({ listing });
}

// ---------------------------------------------------------------------------
// Wishlist match engine — called after a new listing is created
// ---------------------------------------------------------------------------

async function runWishlistMatch(
  listingId: string,
  listingOwnerId: string,
  cardName: string,
  game: string,
  grade: string,
) {
  try {
    // Find wishlist entries that match this card (case-insensitive name contains + game).
    const matches = await prisma.wishlist.findMany({
      where: {
        game: { equals: game, mode: "insensitive" },
        cardName: { contains: cardName.split(" ")[0], mode: "insensitive" },
        userId: { not: listingOwnerId }, // don't notify the lister about their own listing
      },
      include: { user: true },
    });

    if (matches.length === 0) return;

    // Get the listing owner's wishlist so we can check for bidirectional matches.
    const ownerWishlist = await prisma.wishlist.findMany({
      where: { userId: listingOwnerId },
    });

    // Get all trade listings by the wishing users (to check if they have what owner wants).
    const wisherIds = matches.map((m) => m.userId);
    const wisherListings = await prisma.tradeListing.findMany({
      where: { userId: { in: wisherIds }, status: "active" },
    });

    for (const match of matches) {
      const gradeOk =
        !grade || grade.toLowerCase() === match.grade.toLowerCase() || match.grade === "";

      if (!gradeOk) continue;

      // Check bidirectional: does the wishing user have something the owner wants?
      const bidirectional = ownerWishlist.some((ow) =>
        wisherListings.some(
          (wl) =>
            wl.userId === match.userId &&
            wl.cardName.toLowerCase().includes(ow.cardName.split(" ")[0].toLowerCase()),
        ),
      );

      const subject = bidirectional
        ? `⚡ CardStrike — Perfect trade match found for ${match.cardName}!`
        : `⚡ CardStrike — Someone listed ${cardName} on the Trade Board`;

      const body = JSON.stringify({
        type: "trade_match",
        listingId,
        bidirectional,
        matchedCard: cardName,
        wantedCard: match.cardName,
      });

      await prisma.notification.create({
        data: {
          userId: match.userId,
          channel: "IN_APP",
          status: "SENT",
          subject,
          body,
          sentAt: new Date(),
        },
      });
    }
  } catch (err) {
    console.error("[trade/listing] wishlist match error:", err);
  }
}
