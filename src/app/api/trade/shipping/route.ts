import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL ?? "alerts@cardstrike.gg";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function GET(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { searchParams } = new URL(request.url);
  const offerId = searchParams.get("offerId");
  if (!offerId) return NextResponse.json({ error: "offerId required" }, { status: 400 });

  const shipments = await prisma.tradeShipment.findMany({
    where: { offerId },
    include: { user: { select: { id: true, name: true } } },
  });

  const offer = await prisma.tradeOffer.findUnique({
    where: { id: offerId },
    include: {
      listing: { select: { cardName: true } },
      fromUser: { select: { id: true, name: true, email: true } },
      toUser: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ shipments, offer });
}

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: { offerId: string; action: "ship" | "confirm"; trackingNumber?: string; carrier?: string };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const offer = await prisma.tradeOffer.findUnique({
    where: { id: body.offerId },
    include: {
      fromUser: { select: { id: true, name: true, email: true } },
      toUser: { select: { id: true, name: true, email: true } },
      listing: { select: { cardName: true } },
    },
  });
  if (!offer) return NextResponse.json({ error: "Offer not found" }, { status: 404 });
  if (offer.fromUserId !== user.id && offer.toUserId !== user.id) {
    return NextResponse.json({ error: "Not your trade" }, { status: 403 });
  }

  if (body.action === "ship") {
    const existingShipment = await prisma.tradeShipment.findFirst({
      where: { offerId: body.offerId, userId: user.id },
    });

    let shipment;
    if (existingShipment) {
      shipment = await prisma.tradeShipment.update({
        where: { id: existingShipment.id },
        data: {
          trackingNumber: body.trackingNumber ?? null,
          carrier: body.carrier ?? null,
          shippedAt: new Date(),
          status: "shipped",
        },
      });
    } else {
      shipment = await prisma.tradeShipment.create({
        data: {
          offerId: body.offerId,
          userId: user.id,
          trackingNumber: body.trackingNumber ?? null,
          carrier: body.carrier ?? null,
          shippedAt: new Date(),
          status: "shipped",
        },
      });
    }

    // Email the other party with tracking info.
    const otherParty = offer.fromUserId === user.id ? offer.toUser : offer.fromUser;
    try {
      await resend.emails.send({
        from: FROM,
        to: otherParty.email,
        subject: `📦 CardStrike — ${user.name} has shipped their card`,
        html: `<div style="font-family:Arial;background:#150B45;color:#fff;padding:32px;border-radius:12px;">
          <h2 style="color:#F9AD1B;">Card Shipped!</h2>
          <p><strong>${user.name}</strong> has shipped their card for the trade of <strong>${offer.listing.cardName}</strong>.</p>
          ${body.trackingNumber ? `<p>Tracking: <strong>${body.carrier ?? ""} ${body.trackingNumber}</strong></p>` : ""}
          <a href="${APP_URL}/dashboard/trade/shipping/${body.offerId}" style="display:inline-block;background:#E56020;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">View Trade →</a>
        </div>`,
      });
    } catch (err) {
      console.error("[shipping] email error:", err);
    }

    return NextResponse.json({ shipment });
  }

  // confirm action
  const myShipment = await prisma.tradeShipment.findFirst({
    where: { offerId: body.offerId, userId: user.id },
  });

  if (myShipment) {
    await prisma.tradeShipment.update({
      where: { id: myShipment.id },
      data: { confirmedAt: new Date(), status: "confirmed" },
    });
  }

  // Check if both parties confirmed → mark trade complete.
  const allShipments = await prisma.tradeShipment.findMany({ where: { offerId: body.offerId } });
  const bothConfirmed = allShipments.length >= 2 && allShipments.every((s) => s.confirmedAt);
  if (bothConfirmed) {
    await prisma.tradeOffer.update({ where: { id: body.offerId }, data: { status: "completed" } });
  }

  return NextResponse.json({ success: true, bothConfirmed });
}
