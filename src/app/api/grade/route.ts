import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import Anthropic from "@anthropic-ai/sdk";
import { rateLimit } from "@/lib/rateLimit";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `You are an expert trading card grader with PSA/BGS/CGC certification experience. Analyze the card images provided and return ONLY valid JSON with no preamble:
{
  "grade_estimate": "PSA 8",
  "grade_range": ["PSA 7", "PSA 9"],
  "centering": "60/40 front",
  "corners": "slight wear on bottom-left",
  "surfaces": "minor scratch near top",
  "edges": "clean",
  "confidence": 0.78,
  "value_low": 240,
  "value_high": 310,
  "currency": "USD",
  "notes": "Strong candidate for PSA 8. Surface scratch may prevent 9."
}`;

type AllowedMediaType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

function toMediaType(mimeType: string): AllowedMediaType {
  if (mimeType === "image/png") return "image/png";
  if (mimeType === "image/gif") return "image/gif";
  if (mimeType === "image/webp") return "image/webp";
  return "image/jpeg";
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gradeKey = `rate:grade:${userId}`;
  const { allowed } = await rateLimit(gradeKey, 5, 24 * 60 * 60);
  if (!allowed) return NextResponse.json({ error: "Too many requests — try again later" }, { status: 429 });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const front = formData.get("front") as File | null;
  const back = formData.get("back") as File | null;

  if (!front) {
    return NextResponse.json({ error: "Front image is required" }, { status: 400 });
  }

  // Convert uploaded files to base64 for the Claude vision API.
  const frontBuffer = await front.arrayBuffer();
  const frontBase64 = Buffer.from(frontBuffer).toString("base64");
  const frontMediaType = toMediaType(front.type);

  const contentBlocks: Anthropic.Messages.ContentBlockParam[] = [
    {
      type: "image",
      source: { type: "base64", media_type: frontMediaType, data: frontBase64 },
    },
  ];

  if (back) {
    const backBuffer = await back.arrayBuffer();
    const backBase64 = Buffer.from(backBuffer).toString("base64");
    const backMediaType = toMediaType(back.type);
    contentBlocks.push({
      type: "image",
      source: { type: "base64", media_type: backMediaType, data: backBase64 },
    });
  }

  contentBlocks.push({
    type: "text",
    text: "Grade this trading card based on the image(s) provided. Return ONLY the JSON object, no other text.",
  });

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: contentBlocks }],
    });

    const text =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Strip any accidental markdown code fences.
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    const gradeResult = JSON.parse(cleaned) as Record<string, unknown>;
    return NextResponse.json(gradeResult);
  } catch (err) {
    console.error("[/api/grade] Claude error:", err);
    return NextResponse.json(
      { error: "Grading failed. Please try again." },
      { status: 500 },
    );
  }
}
