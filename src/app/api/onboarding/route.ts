import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import { sendParentApprovalEmail } from "@/lib/email";
import crypto from "node:crypto";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { dob: string; username: string; parentEmail?: string };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  const dob = new Date(body.dob);
  if (isNaN(dob.getTime())) return NextResponse.json({ error: "Invalid date" }, { status: 400 });

  const ageMs = Date.now() - dob.getTime();
  const age = Math.floor(ageMs / (365.25 * 24 * 3600 * 1000));
  const isMinor = age < 18;

  // Check username uniqueness.
  const existing = await prisma.user.findUnique({ where: { username: body.username } });
  if (existing) return NextResponse.json({ error: "Username already taken." }, { status: 400 });

  // First, look up existing user record (might already exist from a previous attempt).
  const existingUser = await prisma.user.findUnique({ where: { clerkId } });

  const parentApprovalToken = isMinor ? crypto.randomUUID() : null;

  const user = await prisma.user.upsert({
    where: { clerkId },
    create: {
      clerkId,
      email: existingUser?.email ?? `${clerkId}@placeholder.cardstrike`,
      name: body.username,
      username: body.username,
      dateOfBirth: dob,
      isMinor,
      parentEmail: isMinor ? (body.parentEmail ?? null) : null,
      parentApprovalToken,
      parentApproved: !isMinor,
    },
    update: {
      username: body.username,
      dateOfBirth: dob,
      isMinor,
      parentEmail: isMinor ? (body.parentEmail ?? null) : null,
      parentApprovalToken,
      parentApproved: !isMinor,
    },
  });

  // Send parent approval email if minor.
  if (isMinor && body.parentEmail && parentApprovalToken) {
    try {
      await sendParentApprovalEmail({
        toEmail: body.parentEmail,
        childUsername: body.username,
        approvalUrl: `${APP_URL}/api/auth/parent-approve?token=${parentApprovalToken}`,
      });
    } catch (err) {
      console.error("[onboarding] parent email error:", err);
    }
  }

  void user;
  return NextResponse.json({ success: true });
}
