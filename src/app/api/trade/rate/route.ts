import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/trade/rate
 * Returns accepted offers that still need a rating from the current user.
 */
export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Find accepted offers involving this user where they haven't submitted a rating.
  const offers = await prisma.tradeOffer.findMany({
    where: {
      status: "accepted",
      OR: [{ fromUserId: user.id }, { toUserId: user.id }],
      rating: null,
    },
    include: {
      fromUser: { select: { id: true, name: true } },
      toUser: { select: { id: true, name: true } },
      listing: { select: { cardName: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Only include offers where this user hasn't already rated.
  const given = await prisma.tradeRating.findMany({
    where: { raterId: user.id },
    select: { offerId: true },
  });
  const ratedOfferIds = new Set(given.map((r) => r.offerId));

  const pending = offers.filter((o) => !ratedOfferIds.has(o.id));

  return NextResponse.json({ pending });
}

/**
 * POST /api/trade/rate
 * Submit a rating for a completed trade.
 */
export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let body: { offerId: string; rating: number; comment?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (body.rating < 1 || body.rating > 5) {
    return NextResponse.json({ error: "Rating must be 1–5" }, { status: 400 });
  }

  const offer = await prisma.tradeOffer.findUnique({
    where: { id: body.offerId },
  });
  if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  if (offer.status !== "accepted") {
    return NextResponse.json({ error: "Can only rate accepted trades" }, { status: 400 });
  }
  if (offer.fromUserId !== user.id && offer.toUserId !== user.id) {
    return NextResponse.json({ error: "Not your trade" }, { status: 403 });
  }

  // Determine who is being rated (the other party).
  const ratedUserId = offer.fromUserId === user.id ? offer.toUserId : offer.fromUserId;

  // Upsert: one rating per rater per offer.
  const existing = await prisma.tradeRating.findFirst({
    where: { raterId: user.id, offerId: body.offerId },
  });
  if (existing) {
    return NextResponse.json({ error: "Already rated this trade" }, { status: 400 });
  }

  const rating = await prisma.tradeRating.create({
    data: {
      raterId: user.id,
      ratedUserId,
      offerId: body.offerId,
      rating: body.rating,
      comment: body.comment ?? null,
    },
  });

  return NextResponse.json({ rating });
}
