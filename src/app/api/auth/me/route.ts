import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: {
      id: true, isMinor: true, parentApproved: true, phoneVerified: true,
      username: true, createdAt: true,
      _count: { select: { reportsReceived: { where: { status: "pending" } } } },
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const suspended = user._count.reportsReceived >= 3;
  return NextResponse.json({
    id: user.id,
    isMinor: user.isMinor,
    parentApproved: user.parentApproved,
    phoneVerified: user.phoneVerified,
    username: user.username,
    suspended,
    canPostListings: !suspended && user.phoneVerified && (!user.isMinor || user.parentApproved),
    canMakeOffers: !suspended && user.phoneVerified && (!user.isMinor || user.parentApproved),
    canSetAlerts: !suspended && user.phoneVerified,
  });
}
