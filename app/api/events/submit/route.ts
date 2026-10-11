import { NextRequest, NextResponse } from "next/server";
import { submitEvent } from "@/lib/wordpress";
import { getSessionToken } from "@/lib/auth";
import { looksLikeSpam, SPAM_MESSAGE } from "@/lib/spam";

export async function POST(request: NextRequest) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Not logged in." }, { status: 401 });
  }

  const { website, form_ms, ...data } = await request.json().catch(() => ({}));
  if (looksLikeSpam(website, form_ms)) {
    return NextResponse.json({ error: SPAM_MESSAGE }, { status: 400 });
  }
  if (!data.title) {
    return NextResponse.json({ error: "An event title is required." }, { status: 400 });
  }
  if (!data.start) {
    return NextResponse.json({ error: "A start date/time is required." }, { status: 400 });
  }

  const result = await submitEvent(token, data);
  if ("id" in result) {
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: result.message }, { status: 400 });
}
