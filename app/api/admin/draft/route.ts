import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { getMemberMe } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";
import { EDITORIAL_GUIDE } from "@/lib/editorial-guide";

const DraftSchema = z.object({
  headline: z.string(),
  standfirst: z.string(),
  excerpt: z.string(),
  body: z.string().describe("Full article body as clean HTML — <p> paragraphs, <h2> subheadings if needed."),
  seo_title: z.string(),
  seo_description: z.string(),
  categories: z.array(z.string()),
  tags: z.array(z.string()),
});

export async function POST(request: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const profile = await getMemberMe(token);
  if (!profile?.is_editor) {
    return NextResponse.json({ error: "Editor access required." }, { status: 403 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "AI drafting isn't configured yet — ANTHROPIC_API_KEY is missing from the environment." },
      { status: 503 }
    );
  }

  const data = await request.json().catch(() => ({}));
  const notes = typeof data.notes === "string" ? data.notes.trim() : "";
  const images: Array<{ mediaType: string; data: string }> = Array.isArray(data.images) ? data.images : [];

  if (!notes && images.length === 0) {
    return NextResponse.json({ error: "Add some notes or a photo to draft from." }, { status: 400 });
  }

  const client = new Anthropic();

  try {
    const response = await client.messages.parse({
      model: "claude-opus-5",
      max_tokens: 8000,
      system: EDITORIAL_GUIDE,
      messages: [
        {
          role: "user",
          content: [
            ...images.map((img) => ({
              type: "image" as const,
              source: { type: "base64" as const, media_type: img.mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: img.data },
            })),
            {
              type: "text" as const,
              text: notes || "Write the article from the attached photo(s) alone — describe what's shown and why it might be newsworthy for Secret Carshalton, flagging clearly that no written notes were supplied.",
            },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(DraftSchema) },
    });

    if (!response.parsed_output) {
      return NextResponse.json({ error: "Claude didn't return a usable draft — try again." }, { status: 502 });
    }

    return NextResponse.json(response.parsed_output);
  } catch (err) {
    const message = err instanceof Anthropic.APIError ? err.message : "Draft generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
