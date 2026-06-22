import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/trade/match
 * Returns active trade listings that match items on the current user's wishlist.
 */
export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const wishlist = await prisma.wishlist.findMany({ where: { userId: user.id } });
  if (wishlist.length === 0) return NextResponse.json({ matches: [] });

  // Find listings matching any wishlist item.
  const matches = [];

  for (const wish of wishlist) {
    const listings = await prisma.tradeListing.findMany({
      where: {
        status: "active",
        userId: { not: user.id },
        game: { equals: wish.game, mode: "insensitive" },
        cardName: { contains: wish.cardName.split(" ")[0], mode: "insensitive" },
        ...(wish.maxPrice ? { estimatedValue: { lte: wish.maxPrice } } : {}),
      },
      include: {
        user: { select: { id: true, name: true, imageUrl: true } },
      },
      take: 5,
    });

    for (const listing of listings) {
      matches.push({ wishlistItem: wish, listing });
    }
  }

  return NextResponse.json({ matches });
}
