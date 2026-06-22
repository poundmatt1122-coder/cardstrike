import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are a trading card portfolio advisor. Return ONLY valid JSON:
{
  "sell_recommendations": [
    {"card_name": "...", "estimated_sale": 340, "reason": "..."},
    {"card_name": "...", "estimated_sale": 180, "reason": "..."}
  ],
  "total_from_sales": 520,
  "target_price": 490,
  "net_position": 30,
  "summary": "Selling these 2 cards fully funds the purchase with $30 left over."
}`;

interface SwapRequest {
  targetCard: {
    name: string;
    grade: string;
    price: number; // cents
    listingUrl?: string;
  };
}

export async function POST(request: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: SwapRequest;
  try {
    body = (await request.json()) as SwapRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Look up user in DB.
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  // Get user's top 10 watches by card lastPrice descending.
  const watches = await prisma.watch.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    include: { card: true },
    orderBy: { card: { lastPrice: "desc" } },
    take: 10,
  });

  const portfolioItems = watches.map((w) => ({
    card_name: `${w.card.player} ${w.card.name}`,
    grade: w.card.condition,
    estimated_value: w.card.lastPrice ?? 0,
    target_price: w.targetPrice,
  }));

  const prompt = `My portfolio (top items by value):
${JSON.stringify(portfolioItems, null, 2)}

I want to buy:
${JSON.stringify(body.targetCard, null, 2)}

Which cards should I sell to fund this purchase? Recommend the minimum number of cards whose combined estimated sale prices cover the target price. Be concise. All monetary values are in cents.`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";
    const cleaned = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const result = JSON.parse(cleaned) as Record<string, unknown>;
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/swap] Claude error:", err);
    return NextResponse.json({ error: "Swap analysis failed." }, { status: 500 });
  }
}
