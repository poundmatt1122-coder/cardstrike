import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export interface TickerItem {
  id: string;
  cardName: string;
  grade: string;
  sport: string;
  fairValue: number;
  listingPrice: number;
  discountPct: number;
  listingUrl: string;
  sentAt: string | null;
}

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fetch the last 50 SENT notifications across all users (public deal feed).
  // In a multi-tenant context you'd gate this differently.
  const notifications = await prisma.notification.findMany({
    where: { status: "SENT" },
    orderBy: { sentAt: "desc" },
    take: 50,
    include: {
      watch: { include: { card: true } },
    },
  });

  const items: TickerItem[] = [];

  for (const n of notifications) {
    // Body is stored as JSON by the worker.
    let body: {
      listingUrl?: string;
      listingPrice?: number;
      fairValue?: number;
      discountPct?: number;
      cardName?: string;
      grade?: string;
    };

    try {
      body = JSON.parse(n.body) as typeof body;
    } catch {
      continue;
    }

    if (!body.listingUrl || !body.listingPrice || !body.fairValue) continue;

    items.push({
      id: n.id,
      cardName: body.cardName ?? n.watch?.card?.name ?? "Unknown Card",
      grade: body.grade ?? n.watch?.card?.condition ?? "",
      sport: n.watch?.card?.sport ?? "OTHER",
      fairValue: body.fairValue,
      listingPrice: body.listingPrice,
      discountPct: body.discountPct ?? 0,
      listingUrl: body.listingUrl,
      sentAt: n.sentAt?.toISOString() ?? null,
    });
  }

  // Sort by discount descending.
  items.sort((a, b) => b.discountPct - a.discountPct);

  return NextResponse.json({ items });
}
