import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { sendReportNotification } from "@/lib/email";

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const reporter = await prisma.user.findUnique({ where: { clerkId } });
  if (!reporter) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let body: { reportedUserId: string; reason: string; details?: string; listingId?: string; offerId?: string };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  if (reporter.id === body.reportedUserId) {
    return NextResponse.json({ error: "Cannot report yourself" }, { status: 400 });
  }

  const reportedUser = await prisma.user.findUnique({ where: { id: body.reportedUserId }, select: { name: true } });

  const report = await prisma.report.create({
    data: {
      reporterId: reporter.id,
      reportedUserId: body.reportedUserId,
      listingId: body.listingId ?? null,
      offerId: body.offerId ?? null,
      reason: body.reason,
      details: body.details ?? null,
    },
  });

  // Send admin notification email.
  try {
    await sendReportNotification({
      reporterName: reporter.name ?? reporter.id,
      reportedUserName: reportedUser?.name ?? body.reportedUserId,
      reason: body.reason,
      details: body.details ?? null,
      listingId: body.listingId ?? null,
      offerId: body.offerId ?? null,
    });
  } catch (err) {
    console.error("[report] email error:", err);
  }

  return NextResponse.json({ report });
}
