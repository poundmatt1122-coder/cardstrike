import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { calculateTradeFee } from "@/lib/tradeFee";
import { sendTradeOfferEmail, sendTradeAcceptedEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rateLimit";
import { sanitizeMessage } from "@/lib/sanitize";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// GET — portfolio cards (for offer modal) OR received/sent offers
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") ?? "both";

  if (type === "portfolio") {
    // Return watches with card data for the offer modal.
    const watches = await prisma.watch.findMany({
      where: { userId: user.id },
      include: { card: true },
      take: 20,
    });
    const portfolio = watches.map((w) => ({
      id: w.card.id,
      name: `${w.card.player} ${w.card.name}`,
      grade: w.card.condition,
      estimatedValue: w.card.lastPrice ? w.card.lastPrice / 100 : 0,
    }));
    return NextResponse.json({ portfolio });
  }

  const [received, sent] = await Promise.all([
    prisma.tradeOffer.findMany({
      where: { toUserId: user.id },
      include: {
        fromUser: { select: { id: true, name: true, imageUrl: true } },
        listing: true,
        rating: true,
        fee: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.tradeOffer.findMany({
      where: { fromUserId: user.id },
      include: {
        toUser: { select: { id: true, name: true, imageUrl: true } },
        listing: true,
        rating: true,
        fee: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({ received, sent });
}

// ---------------------------------------------------------------------------
// POST — create a new trade offer
// ---------------------------------------------------------------------------

interface OfferedCard {
  id: string;
  name: string;
  grade: string;
  estimatedValue: number;
}

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fromUser = await prisma.user.findUnique({ where: { clerkId } });
  if (!fromUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const offerKey = `rate:offer:${fromUser.id}`;
  const { allowed: offerAllowed } = await rateLimit(offerKey, 20, 24 * 60 * 60);
  if (!offerAllowed) return NextResponse.json({ error: "Too many requests — try again later" }, { status: 429 });
  if (!fromUser.phoneVerified) return NextResponse.json({ error: "Verify your phone to make trade offers" }, { status: 403 });
  if (fromUser.isMinor && !fromUser.parentApproved) return NextResponse.json({ error: "Account pending parent approval" }, { status: 403 });

  let body: {
    listingId: string;
    offeredCards: OfferedCard[];
    cashAddon?: number;
    message?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const listing = await prisma.tradeListing.findUnique({
    where: { id: body.listingId },
    include: { user: true },
  });
  if (!listing) return NextResponse.json({ error: "Listing not found" }, { status: 404 });
  if (listing.userId === fromUser.id) {
    return NextResponse.json({ error: "Cannot offer on your own listing" }, { status: 400 });
  }

  const offeredCardsWithCash = body.cashAddon
    ? [...body.offeredCards, { id: "cash", name: `$${body.cashAddon.toFixed(2)} cash add-on`, grade: "", estimatedValue: body.cashAddon }]
    : body.offeredCards;

  const sanitizedMessage = body.message ? sanitizeMessage(body.message) : null;

  const offer = await prisma.tradeOffer.create({
    data: {
      fromUserId: fromUser.id,
      toUserId: listing.userId,
      listingId: listing.id,
      offeredCards: offeredCardsWithCash as unknown as import("@/generated/prisma/client").Prisma.InputJsonValue,
      message: sanitizedMessage,
    },
  });

  // Send email to listing owner.
  try {
    await sendTradeOfferEmail({
      toEmail: listing.user.email,
      toName: listing.user.name,
      listingCardName: listing.cardName,
      offererName: fromUser.name ?? "A CardStrike member",
      offeredCards: body.offeredCards,
      cashAddon: body.cashAddon ?? 0,
      message: body.message ?? null,
      offerUrl: `${APP_URL}/dashboard/trade/offers`,
    });
  } catch (err) {
    console.error("[trade/offer] email error:", err);
  }

  return NextResponse.json({ offer });
}

// ---------------------------------------------------------------------------
// PATCH — accept or decline an offer
// ---------------------------------------------------------------------------

export async function PATCH(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let body: { offerId: string; action: "accept" | "decline" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const offer = await prisma.tradeOffer.findUnique({
    where: { id: body.offerId },
    include: {
      fromUser: true,
      toUser: true,
      listing: true,
    },
  });

  if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  if (offer.toUserId !== user.id) {
    return NextResponse.json({ error: "Not your offer to action" }, { status: 403 });
  }
  if (offer.status !== "pending") {
    return NextResponse.json({ error: "Offer already actioned" }, { status: 400 });
  }

  if (body.action === "decline") {
    const updated = await prisma.tradeOffer.update({
      where: { id: offer.id },
      data: { status: "declined" },
    });
    return NextResponse.json({ offer: updated });
  }

  // Accept: update statuses, calculate fee, send emails.
  const offeredCards = offer.offeredCards as unknown as OfferedCard[];
  const offeredValue = offeredCards.reduce((s, c) => s + (c.estimatedValue ?? 0), 0);
  const listedValue = offer.listing.estimatedValue;

  const feeOnOffered = calculateTradeFee(offeredValue);
  const feeOnListed = calculateTradeFee(listedValue);
  const totalFee = feeOnOffered + feeOnListed;

  await prisma.$transaction([
    prisma.tradeOffer.update({ where: { id: offer.id }, data: { status: "accepted" } }),
    prisma.tradeListing.update({ where: { id: offer.listingId }, data: { status: "traded" } }),
    prisma.tradeFee.create({
      data: {
        offerId: offer.id,
        fromUserId: offer.fromUserId,
        toUserId: offer.toUserId,
        cardValueFrom: offeredValue,
        cardValueTo: listedValue,
        totalFee,
        fromUserFee: totalFee / 2,
        toUserFee: totalFee / 2,
      },
    }),
  ]);

  const tradeUrl = `${APP_URL}/dashboard/trade/offers`;

  // Notify both parties.
  try {
    await Promise.all([
      sendTradeAcceptedEmail({
        toEmail: offer.fromUser.email,
        toName: offer.fromUser.name,
        yourCardName: offeredCards[0]?.name ?? "your card",
        theirCardName: offer.listing.cardName,
        traderName: offer.toUser.name ?? "your trade partner",
        tradeUrl,
      }),
      sendTradeAcceptedEmail({
        toEmail: offer.toUser.email,
        toName: offer.toUser.name,
        yourCardName: offer.listing.cardName,
        theirCardName: offeredCards[0]?.name ?? "their card",
        traderName: offer.fromUser.name ?? "your trade partner",
        tradeUrl,
      }),
    ]);
  } catch (err) {
    console.error("[trade/offer] accept email error:", err);
  }

  return NextResponse.json({ success: true, totalFee, eachPays: totalFee / 2 });
}
