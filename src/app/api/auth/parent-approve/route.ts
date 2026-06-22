import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  if (!token) return new NextResponse("Invalid link.", { status: 400 });

  const user = await prisma.user.findUnique({ where: { parentApprovalToken: token } });
  if (!user) return new NextResponse("This approval link is invalid or has already been used.", { status: 404 });

  await prisma.user.update({
    where: { id: user.id },
    data: { parentApproved: true, parentApprovalToken: null },
  });

  return new NextResponse(
    `<!DOCTYPE html><html><head><title>CardStrike — Approved</title></head>
    <body style="margin:0;padding:0;background:#150B45;font-family:Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
      <div style="text-align:center;color:#fff;padding:32px;">
        <h1 style="font-size:28px;margin-bottom:12px;">✅ Account Approved</h1>
        <p style="color:rgba(255,255,255,0.6);font-size:16px;">${user.name ?? user.username}'s CardStrike account is now fully active.</p>
        <p style="margin-top:8px;color:rgba(255,255,255,0.4);font-size:14px;">They can now log in and start trading.</p>
      </div>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } },
  );
}
