import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const VERIFY_SID = process.env.TWILIO_VERIFY_SERVICE_SID;
const TWILIO_CONFIGURED = !!(TWILIO_SID && TWILIO_TOKEN && VERIFY_SID);

async function twilioRequest(path: string, body: Record<string, string>) {
  const url = `https://verify.twilio.com/v2${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(body),
  });
  return res;
}

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  let body: { phone: string; action: "send" | "verify"; code?: string };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "Invalid body" }, { status: 400 }); }

  if (body.action === "send") {
    await prisma.user.update({ where: { id: user.id }, data: { phoneNumber: body.phone } });

    if (!TWILIO_CONFIGURED) {
      console.warn("[phone-verify] Twilio not configured — dev mode, skipping SMS");
      return NextResponse.json({ success: true, dev: true });
    }

    const res = await twilioRequest(`/Services/${VERIFY_SID}/Verifications`, {
      To: body.phone,
      Channel: "sms",
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("[phone-verify] Twilio send error:", err);
      return NextResponse.json({ error: "Failed to send code" }, { status: 502 });
    }
    return NextResponse.json({ success: true });
  }

  // verify action
  if (!TWILIO_CONFIGURED) {
    // Dev mode: accept any 6-digit code
    await prisma.user.update({ where: { id: user.id }, data: { phoneVerified: true } });
    return NextResponse.json({ success: true, dev: true });
  }

  const res = await twilioRequest(`/Services/${VERIFY_SID}/VerificationCheck`, {
    To: body.phone ?? user.phoneNumber ?? "",
    Code: body.code ?? "",
  });
  const data = await res.json() as { status?: string };
  if (!res.ok || data.status !== "approved") {
    return NextResponse.json({ error: "Invalid or expired code" }, { status: 400 });
  }

  await prisma.user.update({ where: { id: user.id }, data: { phoneVerified: true } });
  return NextResponse.json({ success: true });
}
